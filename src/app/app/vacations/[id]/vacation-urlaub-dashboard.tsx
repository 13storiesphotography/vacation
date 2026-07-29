"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Database } from "@/lib/database.types";
import type { DayPlanWithStops } from "@/lib/day-plans";
import type { FeaturedDashboard } from "@/lib/dashboard";
import { VacationTripDashboard } from "@/components/dashboard/reise-dashboard";
import { TripRouteOverview } from "./trip-route-overview";

type Spot = Database["public"]["Tables"]["spots"]["Row"];
type Vacation = Database["public"]["Tables"]["vacations"]["Row"];

type DashboardResponse = {
  featured: FeaturedDashboard;
  days: DayPlanWithStops[];
  error?: string;
};

export function VacationUrlaubDashboard({
  vacation,
  spots,
  canEdit,
  onEdit,
  onOpenTab,
}: {
  vacation: Vacation;
  spots: Spot[];
  canEdit: boolean;
  onEdit: () => void;
  onOpenTab: (tab: "plan" | "karte" | "spots" | "team") => void;
}) {
  const [featured, setFeatured] = useState<FeaturedDashboard | null>(null);
  const [days, setDays] = useState<DayPlanWithStops[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const spotsById = useMemo(
    () => new Map(spots.map((spot) => [spot.id, spot])),
    [spots],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/vacations/${vacation.id}/dashboard`, {
        cache: "no-store",
      });
      const json = (await response.json()) as DashboardResponse;
      if (!response.ok) {
        setError(json.error ?? "Dashboard konnte nicht geladen werden.");
        setFeatured(null);
        setDays([]);
        return;
      }
      setFeatured(json.featured);
      setDays(json.days ?? []);
    } catch {
      setError("Dashboard konnte nicht geladen werden.");
      setFeatured(null);
      setDays([]);
    } finally {
      setLoading(false);
    }
  }, [vacation.id]);

  useEffect(() => {
    void load();
  }, [load, vacation.start_date, vacation.end_date, vacation.title, spots.length]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="display text-2xl">{vacation.title}</h1>
          <p className="tab-subtitle">
            {vacation.start_date} – {vacation.end_date}
            {vacation.region ? ` · ${vacation.region}` : ""}
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            className="glass-chip shrink-0"
            onClick={onEdit}
          >
            Bearbeiten
          </button>
        ) : null}
      </div>

      {vacation.description ? (
        <p className="text-[15px] leading-relaxed text-[var(--ink-soft)]">
          {vacation.description}
        </p>
      ) : null}

      {loading ? (
        <p className="text-[14px] text-[var(--ink-soft)]">Dashboard lädt…</p>
      ) : null}

      {error ? (
        <div className="ios-group p-4">
          <p className="text-[14px] text-[var(--danger)]">{error}</p>
          <button type="button" className="glass-chip mt-3" onClick={() => void load()}>
            Erneut versuchen
          </button>
        </div>
      ) : null}

      {featured ? (
        <VacationTripDashboard
          featured={featured}
          onOpenTab={onOpenTab}
          className="space-y-4"
        />
      ) : null}

      {!loading && !error ? (
        <TripRouteOverview
          days={days}
          spotsById={spotsById}
          vacationStart={vacation.start_date}
          vacationEnd={vacation.end_date}
          onSelectDay={() => onOpenTab("plan")}
        />
      ) : null}
    </div>
  );
}
