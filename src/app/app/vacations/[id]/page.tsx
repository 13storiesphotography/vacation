"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import {
  CreateSpotForm,
  SpotList,
  SpotSammelnFilters,
  defaultSpotCollectionFilters,
  type SpotCollectionFilterState,
} from "./spot-ui";
import { SpotMap } from "./spot-map";
import { SpotCategoryManager } from "./category-manager";
import { EditVacationForm } from "./vacation-edit";
import { summarizeRatings, type RaterOption, type SpotRating } from "@/lib/ratings";
import { resolveSpotPreviewImage } from "@/lib/geo";
import { isSpotRelevant, type VacationSpotCategory } from "@/lib/spots";
import { healVacationSpotCoords } from "./maps-coords-actions";
import {
  VacationTabBar,
  normalizeVacationTab,
  type VacationTabId,
} from "@/components/app/vacation-tabbar";
import { VacationTabPanel } from "@/components/app/vacation-tab-panel";
import { DayPlanPanel } from "./day-plan-ui";
import { VacationUrlaubDashboard } from "./vacation-urlaub-dashboard";
import { CostPlannerPanel } from "./cost-planner";
import { TeamPanel } from "./team-panel";
import { isStaleServerActionError } from "@/lib/stale-action";
import { GlassSheet } from "@/components/ui/glass-sheet";

type Vacation = Database["public"]["Tables"]["vacations"]["Row"];
type Member = Database["public"]["Tables"]["vacation_members"]["Row"];
type Spot = Database["public"]["Tables"]["spots"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type SammelnView = "galerie" | "karte";
type MehrSection = "team" | "kosten";

function readInitialTab(): VacationTabId {
  if (typeof window === "undefined") return "ueberblick";
  return normalizeVacationTab(new URLSearchParams(window.location.search).get("tab"));
}

function readInitialSammelnView(): SammelnView {
  if (typeof window === "undefined") return "galerie";
  const params = new URLSearchParams(window.location.search);
  if (params.get("tab") === "karte" || params.get("view") === "karte") return "karte";
  return "galerie";
}

function readInitialMehrSection(): MehrSection {
  if (typeof window === "undefined") return "team";
  const params = new URLSearchParams(window.location.search);
  if (params.get("tab") === "kosten" || params.get("section") === "kosten") {
    return "kosten";
  }
  return "team";
}

export default function VacationDetailPage() {
  const params = useParams<{ id: string }>();
  const vacationId = params.id;
  const [vacation, setVacation] = useState<Vacation | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [categories, setCategories] = useState<VacationSpotCategory[]>([]);
  const [ratings, setRatings] = useState<SpotRating[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSpotForm, setShowSpotForm] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [spotFormKey, setSpotFormKey] = useState(0);
  const [spotFormPending, setSpotFormPending] = useState(false);
  const [spotFilters, setSpotFilters] = useState<SpotCollectionFilterState>(
    defaultSpotCollectionFilters,
  );
  const [editingVacation, setEditingVacation] = useState(false);
  const [sammelnView, setSammelnView] = useState<SammelnView>(() => readInitialSammelnView());
  const [mehrSection, setMehrSection] = useState<MehrSection>(() => readInitialMehrSection());
  const [tab, setTab] = useState<VacationTabId>(() => readInitialTab());
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<VacationTabId>>(
    () => {
      const initial = readInitialTab();
      return new Set<VacationTabId>([initial]);
    },
  );
  const createSpotFormId = "create-spot-sheet-form";

  function writeUrl(nextTab: VacationTabId, nextView = sammelnView, nextSection = mehrSection) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", nextTab);
      if (nextTab === "sammeln" && nextView === "karte") {
        url.searchParams.set("view", "karte");
      } else {
        url.searchParams.delete("view");
      }
      if (nextTab === "mehr" && nextSection === "kosten") {
        url.searchParams.set("section", "kosten");
      } else {
        url.searchParams.delete("section");
      }
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
  }

  function changeTab(next: VacationTabId) {
    setTab(next);
    setVisitedTabs((prev) => {
      if (prev.has(next)) return prev;
      const nextVisited = new Set(prev);
      nextVisited.add(next);
      return nextVisited;
    });
    if (next !== "sammeln") setShowSpotForm(false);
    if (next !== "ueberblick") setEditingVacation(false);
    writeUrl(next);
  }

  function changeSammelnView(next: SammelnView) {
    setSammelnView(next);
    writeUrl("sammeln", next);
  }

  function changeMehrSection(next: MehrSection) {
    setMehrSection(next);
    writeUrl("mehr", sammelnView, next);
  }

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
      setCurrentUserEmail(user?.email?.toLowerCase() ?? null);

      const [{ data: vacationData }, { data: memberData }, { data: spotData }, { data: categoryData }] =
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
          supabase
            .from("vacation_spot_categories")
            .select("*")
            .eq("vacation_id", vacationId)
            .order("sort_order"),
        ]);

      let nextCategories = (categoryData ?? []) as VacationSpotCategory[];
      if (nextCategories.length === 0) {
        await supabase.rpc("seed_vacation_spot_categories", {
          p_vacation_id: vacationId,
        });
        const { data: seeded } = await supabase
          .from("vacation_spot_categories")
          .select("*")
          .eq("vacation_id", vacationId)
          .order("sort_order");
        nextCategories = (seeded ?? []) as VacationSpotCategory[];
      }

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
      setCategories(nextCategories);
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
  const shelvedSpotCount = useMemo(
    () => spots.filter((spot) => !isSpotRelevant(spot)).length,
    [spots],
  );
  const spotCountsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const spot of spots) {
      counts[spot.category] = (counts[spot.category] ?? 0) + 1;
    }
    return counts;
  }, [spots]);

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
          {tab !== "ueberblick" || editingVacation ? (
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

      {visitedTabs.has("ueberblick") && (
        <VacationTabPanel id="ueberblick" active={tab === "ueberblick"}>
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

      {visitedTabs.has("sammeln") && (
        <VacationTabPanel id="sammeln" active={tab === "sammeln"}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="display text-2xl">Sammeln</h1>
              <p className="tab-subtitle">
                {relevantSpotCount} Spot{relevantSpotCount === 1 ? "" : "s"}
                {spots.length > relevantSpotCount
                  ? ` · ${spots.length - relevantSpotCount} archiviert`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="glass-segment">
                <button
                  type="button"
                  className="glass-chip"
                  data-active={sammelnView === "galerie"}
                  onClick={() => changeSammelnView("galerie")}
                >
                  Galerie
                </button>
                <button
                  type="button"
                  className="glass-chip"
                  data-active={sammelnView === "karte"}
                  onClick={() => changeSammelnView("karte")}
                >
                  Karte
                </button>
              </div>
              {canEditSpots ? (
                <button
                  type="button"
                  className="cta !px-3 !py-2 text-[13px]"
                  onClick={() => setShowSpotForm(true)}
                >
                  Hinzufügen
                </button>
              ) : null}
            </div>
          </div>

          <SpotSammelnFilters
            filters={spotFilters}
            onChange={setSpotFilters}
            shelvedCount={shelvedSpotCount}
            categories={categories}
            canManage={canEditSpots}
            onManage={() => setShowCategoryManager(true)}
          />

          <SpotCategoryManager
            open={showCategoryManager}
            onClose={() => setShowCategoryManager(false)}
            vacationId={vacationId}
            categories={categories}
            spotCounts={spotCountsByCategory}
            canEdit={canEditSpots}
            onChanged={load}
          />

          <GlassSheet
            open={showSpotForm && canEditSpots}
            title="Spot hinzufügen"
            subtitle="Link oder Ort — wir füllen aus, was geht"
            onClose={() => setShowSpotForm(false)}
            panelClassName="glass-sheet-panel-tall"
            footer={
              <div className="flex gap-2">
                <button
                  type="button"
                  className="cta cta-secondary flex-1"
                  disabled={spotFormPending}
                  onClick={() => setShowSpotForm(false)}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  form={createSpotFormId}
                  className="cta flex-1"
                  disabled={spotFormPending}
                >
                  {spotFormPending ? "…" : "Speichern"}
                </button>
              </div>
            }
          >
            <CreateSpotForm
              key={spotFormKey}
              formId={createSpotFormId}
              variant="sheet"
              hideSubmit
              vacationId={vacationId}
              categories={categories}
              onPendingChange={setSpotFormPending}
              onCreated={async () => {
                setSpotFormKey((value) => value + 1);
                setShowSpotForm(false);
                setSpotFormPending(false);
                await load();
              }}
            />
          </GlassSheet>

          <div hidden={sammelnView !== "galerie"}>
            <SpotList
              vacationId={vacationId}
              spots={spots}
              ratings={ratings}
              summaries={summaries}
              raters={raters}
              currentUserId={currentUserId}
              canEdit={canEditSpots}
              filters={spotFilters}
              categories={categories}
              onAdd={() => setShowSpotForm(true)}
              onChanged={load}
              onMyRatingPatch={applyMyRating}
              onSpotPatch={applySpotPatch}
            />
          </div>

          <div hidden={sammelnView !== "karte"} className="mt-3">
            <SpotMap
              vacationId={vacationId}
              spots={spots}
              ratings={ratings}
              summaries={summaries}
              raters={raters}
              currentUserId={currentUserId}
              filters={spotFilters}
              categories={categories}
              canEdit={canEditSpots}
              active={tab === "sammeln" && sammelnView === "karte"}
              onChanged={load}
              onMyRatingPatch={applyMyRating}
              onSpotPatch={applySpotPatch}
            />
          </div>
        </VacationTabPanel>
      )}

      {visitedTabs.has("planen") && (
        <VacationTabPanel id="planen" active={tab === "planen"}>
          <h1 className="display text-2xl">Planen</h1>
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

      {visitedTabs.has("mehr") && vacation && (
        <VacationTabPanel id="mehr" active={tab === "mehr"}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="display text-2xl">Mehr</h1>
              <p className="tab-subtitle">Team und Kosten</p>
            </div>
            <div className="glass-segment">
              <button
                type="button"
                className="glass-chip"
                data-active={mehrSection === "team"}
                onClick={() => changeMehrSection("team")}
              >
                Team
              </button>
              <button
                type="button"
                className="glass-chip"
                data-active={mehrSection === "kosten"}
                onClick={() => changeMehrSection("kosten")}
              >
                Kosten
              </button>
            </div>
          </div>

          <div hidden={mehrSection !== "team"} className="mt-3">
            <TeamPanel
              vacationId={vacationId}
              members={members}
              profiles={profiles}
              currentUserId={currentUserId}
              canManageTeam={canManageTeam}
              onChanged={load}
              embedded
            />
          </div>

          <div hidden={mehrSection !== "kosten"} className="mt-3">
            <CostPlannerPanel
              vacation={vacation}
              spots={spots}
              canEdit={canEditCosts}
              embedded
              onVacationPatch={(patch) =>
                setVacation((prev) => (prev ? { ...prev, ...patch } : prev))
              }
            />
          </div>
        </VacationTabPanel>
      )}

      </main>

      {/* Fixed bottom liquid-glass pill on all breakpoints (see .app-tabbar). */}
      <VacationTabBar active={tab} onChange={changeTab} />
    </>
  );
}
