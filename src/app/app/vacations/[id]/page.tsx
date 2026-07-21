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

type Vacation = Database["public"]["Tables"]["vacations"]["Row"];
type Member = Database["public"]["Tables"]["vacation_members"]["Row"];
type Spot = Database["public"]["Tables"]["spots"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

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
  const [showSpotForm, setShowSpotForm] = useState(false);
  const [spotFormKey, setSpotFormKey] = useState(0);
  const [spotsView, setSpotsView] = useState<"list" | "map">("list");
  const [editingVacation, setEditingVacation] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const load = useCallback(async () => {
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
    setLoading(false);
  }, [vacationId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    setInviting(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vacationId, email: inviteEmail }),
    });
    const payload = (await response.json()) as { error?: string; ok?: boolean; note?: string };
    setInviting(false);
    if (!response.ok) {
      setError(payload.error ?? "Einladung fehlgeschlagen");
      return;
    }
    setMessage(payload.note ?? "Einladung gesendet.");
    setInviteEmail("");
    await load();
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
    <main className="shell mx-auto min-h-screen w-full max-w-6xl px-5 py-8 md:px-8">
      <Link href="/app" className="text-[13px] font-semibold text-[var(--fjord)]">
        ← Urlaube
      </Link>

      {!editingVacation ? (
        <div className="mt-3">
          <div className="flex items-start justify-between gap-3">
            <h1 className="display text-3xl">{vacation.title}</h1>
            {canEditVacation && (
              <button
                type="button"
                className="shrink-0 text-[13px] font-semibold text-[var(--fjord)]"
                onClick={() => setEditingVacation(true)}
              >
                Bearbeiten
              </button>
            )}
          </div>
          <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
            {vacation.start_date} – {vacation.end_date}
            {vacation.region ? ` · ${vacation.region}` : ""} · {vacation.type}
          </p>
          {vacation.description && (
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-soft)]">
              {vacation.description}
            </p>
          )}
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

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="display text-xl">Spots</h2>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[var(--ink-soft)]">{spots.length}</span>
            <div className="flex rounded-full bg-black/5 p-0.5">
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  spotsView === "list"
                    ? "bg-[var(--fjord)] text-white"
                    : "text-[var(--ink-soft)]"
                }`}
                onClick={() => setSpotsView("list")}
              >
                Liste
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  spotsView === "map"
                    ? "bg-[var(--fjord)] text-white"
                    : "text-[var(--ink-soft)]"
                }`}
                onClick={() => setSpotsView("map")}
              >
                Karte
              </button>
            </div>
            <button
              type="button"
              className="cta !px-3 !py-2 text-[13px]"
              onClick={() => setShowSpotForm((value) => !value)}
            >
              {showSpotForm ? "Schließen" : "Hinzufügen"}
            </button>
          </div>
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

        {spotsView === "list" ? (
          <SpotList
            vacationId={vacationId}
            spots={spots}
            ratings={ratings}
            summaries={summaries}
            raters={raters}
            currentUserId={currentUserId}
            onChanged={load}
            onMyRatingPatch={applyMyRating}
          />
        ) : (
          <SpotMap spots={spots} summaries={summaries} />
        )}
      </section>

      <section className="mt-12 border-t border-[var(--separator)] pt-6">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
          onClick={() => setShowTeam((value) => !value)}
          aria-expanded={showTeam}
        >
          <span className="display text-lg text-[var(--ink-soft)]">Team</span>
          <span className="text-[13px] font-semibold text-[var(--ink-faint)]">
            {members.length} · {showTeam ? "Einklappen" : "Anzeigen"}
          </span>
        </button>

        {showTeam && (
          <div className="mt-3">
            <div className="ios-group">
              {members.map((member) => (
                <div key={member.id} className="ios-row !items-start">
                  <div>
                    <p className="text-[15px] font-semibold">{member.email}</p>
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                      {member.role} · {member.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {canEditVacation && (
              <div className="mt-3">
                {!showInvite ? (
                  <button
                    type="button"
                    className="text-[13px] font-semibold text-[var(--fjord)]"
                    onClick={() => setShowInvite(true)}
                  >
                    Person einladen…
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
                        className="text-[12px] font-semibold text-[var(--ink-faint)]"
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
                        className="w-full rounded-[12px] border-0 bg-black/5 px-3 py-3 text-[15px] outline-none ring-[var(--fjord)] focus:ring-2"
                        type="text"
                        inputMode="email"
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
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                      <button type="submit" className="cta shrink-0" disabled={inviting}>
                        {inviting ? "…" : "Einladen"}
                      </button>
                    </div>
                    {message && <p className="mt-3 text-[13px] text-[var(--pine)]">{message}</p>}
                    {error && <p className="mt-3 text-[13px] text-[var(--danger)]">{error}</p>}
                  </form>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
