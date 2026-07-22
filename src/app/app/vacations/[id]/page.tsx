"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import { CreateSpotForm, SpotList } from "./spot-ui";
import { SpotMap } from "./spot-map";
import { EditVacationForm } from "./vacation-edit";
import { summarizeRatings, type RaterOption, type SpotRating } from "@/lib/ratings";
import { resolveSpotPreviewImage } from "@/lib/geo";
import { isSpotRelevant } from "@/lib/spots";
import { healVacationSpotCoords } from "./maps-coords-actions";
import {
  VacationTabBar,
  type VacationTabId,
} from "@/components/app/vacation-tabbar";
import { VacationTabPanel } from "@/components/app/vacation-tab-panel";
import { DayPlanPanel } from "./day-plan-ui";
import { isCompleteEmail } from "@/lib/email";
import { isStaleServerActionError } from "@/lib/stale-action";

type Vacation = Database["public"]["Tables"]["vacations"]["Row"];
type Member = Database["public"]["Tables"]["vacation_members"]["Row"];
type Spot = Database["public"]["Tables"]["spots"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

function readInitialTab(): VacationTabId {
  if (typeof window === "undefined") return "spots";
  const value = new URLSearchParams(window.location.search).get("tab");
  if (
    value === "urlaub" ||
    value === "spots" ||
    value === "karte" ||
    value === "plan" ||
    value === "team"
  ) {
    return value;
  }
  return "spots";
}

export default function VacationDetailPage() {
  const params = useParams<{ id: string }>();
  const vacationId = params.id;
  const [vacation, setVacation] = useState<Vacation | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [ratings, setRatings] = useState<SpotRating[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [memberBusyId, setMemberBusyId] = useState<string | null>(null);
  const [showSpotForm, setShowSpotForm] = useState(false);
  const [spotFormKey, setSpotFormKey] = useState(0);
  const [editingVacation, setEditingVacation] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [tab, setTab] = useState<VacationTabId>("spots");
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<VacationTabId>>(
    () => new Set<VacationTabId>(["spots"]),
  );

  useEffect(() => {
    const initial = readInitialTab();
    setTab(initial);
    setVisitedTabs(new Set<VacationTabId>([initial]));
  }, []);

  function changeTab(next: VacationTabId) {
    setTab(next);
    setVisitedTabs((prev) => {
      if (prev.has(next)) return prev;
      const nextVisited = new Set(prev);
      nextVisited.add(next);
      return nextVisited;
    });
    if (next !== "spots") setShowSpotForm(false);
    if (next !== "urlaub") setEditingVacation(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
  }

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      const [{ data: vacationData }, { data: memberData }, { data: spotData }] =
        await Promise.all([
          supabase.from("vacations").select("*").eq("id", vacationId).single(),
          supabase
            .from("vacation_members")
            .select("*")
            .eq("vacation_id", vacationId)
            .order("created_at"),
          supabase
            .from("spots")
            .select("*")
            .eq("vacation_id", vacationId)
            .order("created_at", { ascending: false }),
        ]);

      const spotIds = (spotData ?? []).map((spot) => spot.id);
      const userIds = (memberData ?? [])
        .map((member) => member.user_id)
        .filter((id): id is string => Boolean(id));

      const [{ data: ratingData }, { data: profileData }] = await Promise.all([
        spotIds.length
          ? supabase.from("spot_ratings").select("*").in("spot_id", spotIds)
          : Promise.resolve({ data: [] as SpotRating[] }),
        userIds.length
          ? supabase.from("profiles").select("*").in("id", userIds)
          : Promise.resolve({ data: [] as Profile[] }),
      ]);

      setVacation(vacationData);
      setMembers(memberData ?? []);
      setSpots(
        (spotData ?? []).map((spot) => ({
          ...spot,
          image_url: resolveSpotPreviewImage(spot),
        })),
      );
      setRatings(ratingData ?? []);
      setProfiles(profileData ?? []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Urlaub konnte nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }, [vacationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const storageKey = `heal-spot-meta:v2:${vacationId}`;
    try {
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, "1");
    } catch {
      // private mode — still attempt once this mount
    }
    void (async () => {
      try {
        const { updated } = await healVacationSpotCoords(vacationId);
        if (!cancelled && updated > 0) {
          await load();
        }
      } catch (error) {
        if (isStaleServerActionError(error)) {
          // Background heal after deploy — ignore; next full load is fine.
          return;
        }
        // Background heal must never break the vacation page.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vacationId, load]);

  const summaries = useMemo(
    () => summarizeRatings(ratings, currentUserId),
    [ratings, currentUserId],
  );

  const applyMyRating = useCallback(
    (
      spotId: string,
      patch: { rating?: number | null; isFavorite?: boolean },
    ) => {
      if (!currentUserId) return;
      setRatings((prev) => {
        const index = prev.findIndex(
          (entry) => entry.spot_id === spotId && entry.user_id === currentUserId,
        );
        if (index >= 0) {
          const next = [...prev];
          const current = next[index];
          next[index] = {
            ...current,
            rating: patch.rating !== undefined ? patch.rating : current.rating,
            is_favorite:
              patch.isFavorite !== undefined ? patch.isFavorite : current.is_favorite,
            updated_at: new Date().toISOString(),
          };
          return next;
        }
        return [
          ...prev,
          {
            id: `local-${spotId}-${currentUserId}`,
            spot_id: spotId,
            user_id: currentUserId,
            rating: patch.rating ?? null,
            is_favorite: patch.isFavorite ?? false,
            note: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      });
    },
    [currentUserId],
  );

  const applySpotPatch = useCallback((spotId: string, patch: Partial<Spot>) => {
    setSpots((prev) =>
      prev.map((spot) => (spot.id === spotId ? { ...spot, ...patch } : spot)),
    );
  }, []);

  const relevantSpotCount = useMemo(
    () => spots.filter((spot) => isSpotRelevant(spot)).length,
    [spots],
  );

  const raters: RaterOption[] = useMemo(() => {
    return members
      .filter((member) => member.user_id && member.status === "active")
      .map((member) => {
        const profile = profiles.find((entry) => entry.id === member.user_id);
        return {
          userId: member.user_id as string,
          label: profile?.display_name || member.email,
        };
      });
  }, [members, profiles]);

  const canEditVacation = useMemo(() => {
    if (!currentUserId) return false;
    return members.some(
      (member) =>
        member.user_id === currentUserId &&
        member.status === "active" &&
        member.role === "admin",
    );
  }, [currentUserId, members]);

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!isCompleteEmail(inviteEmail)) {
      setError("Bitte gib eine vollständige E-Mail-Adresse ein (z. B. name@domain.de).");
      return;
    }

    setInviting(true);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/auth/set-password`;
      const { data, error: fnError } = await supabase.functions.invoke("invite-member", {
        body: {
          vacationId,
          email: inviteEmail.trim().toLowerCase(),
          redirectTo,
        },
      });
      const payload = (data ?? {}) as { error?: string; ok?: boolean; note?: string };

      if (fnError || payload.error) {
        // Fallback to Next API (Edge Function + service role paths).
        const response = await fetch("/api/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vacationId, email: inviteEmail }),
        });
        const apiPayload = (await response.json()) as {
          error?: string;
          ok?: boolean;
          note?: string;
        };
        if (!response.ok) {
          setError(apiPayload.error ?? payload.error ?? fnError?.message ?? "Einladung fehlgeschlagen");
          return;
        }
        setMessage(apiPayload.note ?? "Einladung gesendet.");
      } else if (payload.note && /invite:/i.test(payload.note)) {
        setMessage(
          "Person ist eingeladen, aber die E-Mail konnte nicht gesendet werden. Bitte erneut versuchen.",
        );
      } else {
        setMessage("Einladung per E-Mail gesendet.");
      }

      setInviteEmail("");
      setShowInvite(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Einladung fehlgeschlagen");
    } finally {
      setInviting(false);
    }
  }

  async function onResendInvite(member: Member) {
    setError(null);
    setMessage(null);
    setMemberBusyId(member.id);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/auth/set-password`;
      const { data, error: fnError } = await supabase.functions.invoke("invite-member", {
        body: {
          vacationId,
          email: member.email,
          redirectTo,
        },
      });
      const payload = (data ?? {}) as { error?: string; note?: string };

      if (fnError || payload.error) {
        const response = await fetch("/api/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vacationId,
            memberId: member.id,
            action: "resend",
          }),
        });
        const apiPayload = (await response.json()) as { error?: string; note?: string };
        if (!response.ok) {
          setError(apiPayload.error ?? payload.error ?? "Erneutes Senden fehlgeschlagen");
          return;
        }
        setMessage(apiPayload.note ?? "Einladung erneut gesendet.");
        return;
      }

      if (payload.note && /invite:/i.test(payload.note)) {
        setError("E-Mail konnte nicht gesendet werden. Bitte später erneut versuchen.");
        return;
      }
      setMessage("Einladung erneut gesendet.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erneutes Senden fehlgeschlagen");
    } finally {
      setMemberBusyId(null);
    }
  }

  async function onRemoveMember(member: Member) {
    const isInvite = member.status === "invited";
    const confirmed = window.confirm(
      isInvite
        ? `Einladung an ${member.email} zurückziehen?`
        : `${member.email} aus dem Team entfernen?`,
    );
    if (!confirmed) return;

    setError(null);
    setMessage(null);
    setMemberBusyId(member.id);
    const response = await fetch("/api/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vacationId, memberId: member.id }),
    });
    const payload = (await response.json()) as { error?: string; note?: string };
    setMemberBusyId(null);
    if (!response.ok) {
      setError(payload.error ?? "Entfernen fehlgeschlagen");
      return;
    }
    setMessage(payload.note ?? (isInvite ? "Einladung zurückgezogen." : "Mitglied entfernt."));
    await load();
  }

  function memberRoleLabel(role: Member["role"]) {
    return role === "admin" ? "Admin" : "Mitglied";
  }

  function memberStatusLabel(status: Member["status"]) {
    return status === "invited" ? "Eingeladen" : "Aktiv";
  }

  if (loading) {
    return (
      <main className="shell mx-auto max-w-6xl px-5 py-10 text-[var(--ink-soft)] md:px-8">
        Laden…
      </main>
    );
  }

  if (!vacation) {
    return (
      <main className="shell mx-auto max-w-6xl px-5 py-10 md:px-8">
        <p className="text-[var(--danger)]">Urlaub nicht gefunden.</p>
        <Link href="/app" className="mt-4 inline-block text-[var(--fjord)]">
          Zurück
        </Link>
      </main>
    );
  }

  return (
    <>
      <header className="app-topbar">
        <div className="app-topbar-inner">
          <Link href="/app" className="text-[13px] font-semibold text-[var(--fjord)]">
            ← Urlaube
          </Link>
          {tab !== "urlaub" ? (
            <p className="truncate text-[13px] font-semibold text-[var(--ink-soft)]">
              {vacation.title}
            </p>
          ) : (
            <span />
          )}
        </div>
      </header>

      <main className="shell app-with-chrome mx-auto min-h-screen w-full max-w-6xl px-5 pb-6 pt-3 md:px-8 md:pb-8 md:pt-4">
        {/* Desktop: tab bar on top. Mobile: fixed at bottom via CSS. */}
        <div className="hidden md:block">
          <VacationTabBar active={tab} onChange={changeTab} />
        </div>

      {visitedTabs.has("urlaub") && (
        <VacationTabPanel id="urlaub" active={tab === "urlaub"}>
          {!editingVacation ? (
            <div>
              <div className="flex items-start justify-between gap-3">
                <h1 className="display text-2xl">{vacation.title}</h1>
                {canEditVacation && (
                  <button
                    type="button"
                    className="glass-chip shrink-0"
                    onClick={() => setEditingVacation(true)}
                  >
                    Bearbeiten
                  </button>
                )}
              </div>
              <p className="tab-subtitle">
                {vacation.start_date} – {vacation.end_date}
                {vacation.region ? ` · ${vacation.region}` : ""} · {vacation.type}
              </p>
              {vacation.description && (
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-soft)]">
                  {vacation.description}
                </p>
              )}
              <div className="ios-group mt-4">
                <button
                  type="button"
                  className="ios-row ios-chevron"
                  onClick={() => changeTab("spots")}
                >
                  <div>
                    <p className="text-[15px] font-semibold">
                      {spots.length} Spot{spots.length === 1 ? "" : "s"} gesammelt
                    </p>
                    <p className="text-[13px] text-[var(--ink-soft)]">Zur Sammlung</p>
                  </div>
                </button>
                <button
                  type="button"
                  className="ios-row ios-chevron"
                  onClick={() => changeTab("team")}
                >
                  <div>
                    <p className="text-[15px] font-semibold">
                      {members.length} Person{members.length === 1 ? "" : "en"}
                    </p>
                    <p className="text-[13px] text-[var(--ink-soft)]">Team & Einladungen</p>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <EditVacationForm
              vacation={vacation}
              onDone={async () => {
                setEditingVacation(false);
                await load();
              }}
            />
          )}
        </VacationTabPanel>
      )}

      {visitedTabs.has("spots") && (
        <VacationTabPanel id="spots" active={tab === "spots"}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="display text-2xl">Spots</h1>
              <p className="tab-subtitle">
                {spots.length} in der Sammlung
                {spots.length > 0 && relevantSpotCount !== spots.length
                  ? ` · ${relevantSpotCount} relevant`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              className="cta !px-3 !py-2 text-[13px]"
              onClick={() => setShowSpotForm((value) => !value)}
            >
              {showSpotForm ? "Schließen" : "Hinzufügen"}
            </button>
          </div>

          {showSpotForm && (
            <CreateSpotForm
              key={spotFormKey}
              vacationId={vacationId}
              onCreated={async () => {
                setSpotFormKey((value) => value + 1);
                setShowSpotForm(false);
                await load();
              }}
            />
          )}

          <SpotList
            vacationId={vacationId}
            spots={spots}
            ratings={ratings}
            summaries={summaries}
            raters={raters}
            currentUserId={currentUserId}
            onChanged={load}
            onMyRatingPatch={applyMyRating}
            onSpotPatch={applySpotPatch}
          />
        </VacationTabPanel>
      )}

      {visitedTabs.has("karte") && (
        <VacationTabPanel id="karte" active={tab === "karte"}>
          <h1 className="display text-2xl">Karte</h1>
          <p className="tab-subtitle">Spots mit Position</p>
          <SpotMap spots={spots} summaries={summaries} active={tab === "karte"} />
        </VacationTabPanel>
      )}

      {visitedTabs.has("plan") && (
        <VacationTabPanel id="plan" active={tab === "plan"}>
          <h1 className="display text-2xl">Plan</h1>
          <p className="tab-subtitle">
            Tag wählen, Spots tippen — fertig
          </p>
          <DayPlanPanel
            vacation={vacation}
            spots={spots}
            onSpotsChanged={load}
            onSpotPatch={applySpotPatch}
          />
        </VacationTabPanel>
      )}

      {visitedTabs.has("team") && (
        <VacationTabPanel id="team" active={tab === "team"}>
          <h1 className="display text-2xl">Team</h1>
          <p className="tab-subtitle">
            {members.length} Mitglied{members.length === 1 ? "" : "er"}
          </p>

          <div className="ios-group mt-4">
            {members.map((member) => {
              const isSelf = Boolean(
                currentUserId && member.user_id && member.user_id === currentUserId,
              );
              const busy = memberBusyId === member.id;
              const canManage = canEditVacation && !isSelf;

              return (
                <div key={member.id} className="ios-row !items-start">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{member.email}</p>
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                      {memberRoleLabel(member.role)} · {memberStatusLabel(member.status)}
                      {isSelf ? " · Du" : ""}
                    </p>
                    {canManage && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {member.status === "invited" && (
                          <button
                            type="button"
                            className="glass-chip"
                            disabled={busy}
                            onClick={() => void onResendInvite(member)}
                          >
                            {busy ? "…" : "Erneut senden"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="glass-chip glass-chip-danger"
                          disabled={busy}
                          onClick={() => void onRemoveMember(member)}
                        >
                          {busy
                            ? "…"
                            : member.status === "invited"
                              ? "Einladung zurückziehen"
                              : "Entfernen"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {(message || error) && tab === "team" && !showInvite && (
            <div className="mt-3">
              {message && <p className="text-[13px] text-[var(--pine)]">{message}</p>}
              {error && <p className="text-[13px] text-[var(--danger)]">{error}</p>}
            </div>
          )}

          {canEditVacation && (
            <div className="mt-4">
              {!showInvite ? (
                <button
                  type="button"
                  className="cta w-full"
                  onClick={() => setShowInvite(true)}
                >
                  Person einladen
                </button>
              ) : (
                <form
                  onSubmit={onInvite}
                  className="ios-group p-4"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-semibold text-[var(--ink-soft)]">
                      Person einladen
                    </p>
                    <button
                      type="button"
                      className="glass-chip"
                      onClick={() => {
                        setShowInvite(false);
                        setInviteEmail("");
                        setMessage(null);
                        setError(null);
                      }}
                    >
                      Schließen
                    </button>
                  </div>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <input
                      className="glass-field px-3 py-3"
                      type="text"
                      inputMode="email"
                      enterKeyHint="send"
                      name="vacation-invite-email"
                      id="vacation-invite-email"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-form-type="other"
                      required
                      placeholder="email@example.com"
                      value={inviteEmail}
                      onChange={(e) => {
                        setInviteEmail(e.target.value);
                        if (message) setMessage(null);
                        if (error) setError(null);
                      }}
                    />
                    <button
                      type="submit"
                      className="cta shrink-0"
                      disabled={inviting || !isCompleteEmail(inviteEmail)}
                    >
                      {inviting ? "…" : "Einladen"}
                    </button>
                  </div>
                  {message && <p className="mt-3 text-[13px] text-[var(--pine)]">{message}</p>}
                  {error && <p className="mt-3 text-[13px] text-[var(--danger)]">{error}</p>}
                </form>
              )}
            </div>
          )}
        </VacationTabPanel>
      )}

      </main>

      <div className="md:hidden">
        <VacationTabBar active={tab} onChange={changeTab} />
      </div>
    </>
  );
}
