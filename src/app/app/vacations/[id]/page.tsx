"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { VacationUrlaubDashboard } from "./vacation-urlaub-dashboard";
import { CostPlannerPanel } from "./cost-planner";
import { TeamPanel } from "./team-panel";
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
    value === "kosten" ||
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
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSpotForm, setShowSpotForm] = useState(false);
  const [spotFormKey, setSpotFormKey] = useState(0);
  const [editingVacation, setEditingVacation] = useState(false);
  const [tab, setTab] = useState<VacationTabId>(() => readInitialTab());
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<VacationTabId>>(
    () => {
      const initial = readInitialTab();
      return new Set<VacationTabId>([initial]);
    },
  );

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
      setCurrentUserEmail(user?.email?.toLowerCase() ?? null);

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
    void Promise.resolve().then(load);
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

  const currentMember = useMemo(
    () =>
      members.find((member) => member.user_id && member.user_id === currentUserId) ??
      members.find((member) => currentUserEmail && member.email === currentUserEmail) ??
      null,
    [currentUserEmail, currentUserId, members],
  );

  const activeMember = Boolean(currentMember && currentMember.status === "active");
  const canManageTeam = Boolean(activeMember && currentMember?.can_manage_team);
  const canEditVacation = Boolean(activeMember && currentMember?.can_edit_vacation);
  const canEditSpots = Boolean(activeMember && currentMember?.can_edit_spots);
  const canEditCosts = Boolean(
    activeMember &&
      (currentMember?.can_edit_vacation ||
        currentMember?.can_edit_spots ||
        currentMember?.can_edit_plan),
  );

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
      {error ? (
        <p className="mb-3 text-[13px] text-[var(--danger)]">{error}</p>
      ) : null}
      {visitedTabs.has("urlaub") && (
        <VacationTabPanel id="urlaub" active={tab === "urlaub"}>
          {!editingVacation ? (
            <VacationUrlaubDashboard
              vacation={vacation}
              spots={spots}
              canEdit={canEditVacation}
              onEdit={() => setEditingVacation(true)}
              onOpenTab={changeTab}
            />
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
                  ? ` · ${spots.length - relevantSpotCount} archiviert`
                  : ""}
              </p>
            </div>
            {canEditSpots ? (
              <button
                type="button"
                className="cta !px-3 !py-2 text-[13px]"
                onClick={() => setShowSpotForm((value) => !value)}
              >
                {showSpotForm ? "Schließen" : "Hinzufügen"}
              </button>
            ) : null}
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
            Tag wählen — Spot tippen zum Bearbeiten
          </p>
          <DayPlanPanel
            vacation={vacation}
            spots={spots}
            onSpotsChanged={load}
            onSpotPatch={applySpotPatch}
          />
        </VacationTabPanel>
      )}

      {visitedTabs.has("kosten") && vacation && (
        <VacationTabPanel id="kosten" active={tab === "kosten"}>
          <CostPlannerPanel
            vacation={vacation}
            spots={spots}
            canEdit={canEditCosts}
            onVacationPatch={(patch) =>
              setVacation((prev) => (prev ? { ...prev, ...patch } : prev))
            }
          />
        </VacationTabPanel>
      )}

      {visitedTabs.has("team") && (
        <VacationTabPanel id="team" active={tab === "team"}>
          <TeamPanel
            vacationId={vacationId}
            members={members}
            profiles={profiles}
            currentUserId={currentUserId}
            canManageTeam={canManageTeam}
            onChanged={load}
          />
        </VacationTabPanel>
      )}

      </main>

      {/* Fixed: bottom on mobile, under topbar on desktop (see .app-tabbar). */}
      <VacationTabBar active={tab} onChange={changeTab} />
    </>
  );
}
