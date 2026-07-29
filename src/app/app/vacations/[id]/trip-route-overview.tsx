"use client";

import { useEffect, useMemo, useState } from "react";
import type { Database } from "@/lib/database.types";
import type { DayPlanWithStops } from "@/lib/day-plans";
import { todayIso } from "@/lib/dashboard";
import { GlassDateField } from "@/components/ui/glass-date-field";
import {
  buildTripRoute,
  formatLegMeta,
  formatRouteDuration,
  formatRouteKm,
  googleMapsDirectionsUrl,
  routeSourceHint,
  type DateRange,
} from "@/lib/day-route";
import DayRouteMap from "./day-route-map";
import { useEnrichedDayRoute } from "./use-enriched-day-route";

type Spot = Database["public"]["Tables"]["spots"]["Row"];

type Preset = "heute" | "morgen" | "next3" | "all" | "custom";

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function clipRange(
  start: string,
  end: string,
  vacationStart: string,
  vacationEnd: string,
): DateRange | null {
  const clippedStart = start < vacationStart ? vacationStart : start;
  const clippedEnd = end > vacationEnd ? vacationEnd : end;
  if (clippedStart > vacationEnd || clippedEnd < vacationStart) return null;
  if (clippedStart > clippedEnd) return null;
  return { startDate: clippedStart, endDate: clippedEnd };
}

export function TripRouteOverview({
  days,
  spotsById,
  vacationStart,
  vacationEnd,
  onSelectDay,
}: {
  days: DayPlanWithStops[];
  spotsById: Map<string, Spot>;
  vacationStart: string;
  vacationEnd: string;
  onSelectDay: (dayId: string) => void;
}) {
  const today = todayIso();
  const [preset, setPreset] = useState<Preset>("all");
  const [customStart, setCustomStart] = useState(vacationStart);
  const [customEnd, setCustomEnd] = useState(vacationEnd);

  useEffect(() => {
    setCustomStart(vacationStart);
    setCustomEnd(vacationEnd);
  }, [vacationStart, vacationEnd]);

  const range = useMemo(() => {
    if (preset === "all") {
      return { startDate: vacationStart, endDate: vacationEnd };
    }
    if (preset === "heute") {
      return clipRange(today, today, vacationStart, vacationEnd);
    }
    if (preset === "morgen") {
      const tomorrow = addDaysIso(today, 1);
      return clipRange(tomorrow, tomorrow, vacationStart, vacationEnd);
    }
    if (preset === "next3") {
      return clipRange(today, addDaysIso(today, 2), vacationStart, vacationEnd);
    }
    return clipRange(customStart, customEnd, vacationStart, vacationEnd);
  }, [preset, today, vacationStart, vacationEnd, customStart, customEnd]);

  const estimate = useMemo(
    () => buildTripRoute(days, spotsById, range),
    [days, spotsById, range],
  );
  const { route, loading, source } = useEnrichedDayRoute(estimate);
  const directionsUrl = route ? googleMapsDirectionsUrl(route.waypoints) : null;

  const heuteInTrip = today >= vacationStart && today <= vacationEnd;
  const morgen = addDaysIso(today, 1);
  const morgenInTrip = morgen >= vacationStart && morgen <= vacationEnd;

  const presets: Array<{ id: Preset; label: string; disabled?: boolean }> = [
    { id: "heute", label: "Heute", disabled: !heuteInTrip },
    { id: "morgen", label: "Morgen", disabled: !morgenInTrip },
    { id: "next3", label: "Nächste 3 Tage" },
    { id: "all", label: "Gesamte Reise" },
    { id: "custom", label: "Zeitraum" },
  ];

  return (
    <div className="ios-group overflow-hidden">
      <div className="px-4 pt-3.5 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--fjord)]">
              Route auf der Karte
            </p>
            <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
              Alle Stops in Reihenfolge
              {route && route.waypoints.length > 0
                ? ` · ${route.waypoints.length} Stop${route.waypoints.length === 1 ? "" : "s"}`
                : ""}
              {route && route.legs.length > 0
                ? ` · ${source === "google" ? "" : "ca. "}${formatRouteKm(route.totalKm)} · ${
                    source === "google" ? "" : "~"
                  }${formatRouteDuration(route.totalMinutes)}`
                : ""}
              {loading ? " · Routenzeit…" : ""}
            </p>
            <p className="mt-1 text-[12px] text-[var(--ink-faint)]">
              {route?.label ?? "Kein Zeitraum"}
              {" · "}
              {routeSourceHint(source)}
            </p>
          </div>
          {directionsUrl ? (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--separator)] bg-[var(--fjord-soft)] px-3 py-1.5 text-[12px] font-semibold text-[var(--fjord)] transition hover:bg-[var(--fjord)] hover:text-white"
            >
              In Google Maps öffnen
              <span aria-hidden="true">↗</span>
            </a>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((entry) => (
            <button
              key={entry.id}
              type="button"
              disabled={entry.disabled}
              className="glass-chip"
              data-active={preset === entry.id}
              onClick={() => setPreset(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {preset === "custom" ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="form-label">
              Von
              <GlassDateField
                min={vacationStart}
                max={vacationEnd}
                value={customStart}
                onChange={setCustomStart}
              />
            </label>
            <label className="form-label">
              Bis
              <GlassDateField
                min={vacationStart}
                max={vacationEnd}
                value={customEnd}
                onChange={setCustomEnd}
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="px-3 pb-3">
        {!range ? (
          <div className="flex h-64 items-center justify-center rounded-[16px] bg-black/5 px-4 text-center text-[13px] text-[var(--ink-soft)]">
            Dieser Zeitraum liegt außerhalb der Reise.
          </div>
        ) : route && route.waypoints.length > 0 ? (
          <DayRouteMap
            waypoints={route.waypoints}
            encodedPolyline={route.encodedPolyline}
            encodedPolylines={route.encodedPolylines}
            className="h-64 sm:h-80"
          />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-[16px] bg-black/5 px-4 text-center text-[13px] text-[var(--ink-soft)]">
            Im gewählten Zeitraum sind noch keine Stops mit Position eingeplant.
          </div>
        )}
      </div>

      {route && route.waypoints.length > 0 ? (
        <ol className="max-h-56 divide-y divide-[var(--separator)] overflow-y-auto border-t border-[var(--separator)] px-2 pb-2">
          {route.waypoints.map((point) => (
            <li key={point.occurrenceId ?? `${point.spotId}-${point.order}`}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-[12px] px-2 py-2.5 text-left hover:bg-[var(--fjord-soft)]"
                onClick={() => point.dayId && onSelectDay(point.dayId)}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--fjord-soft)] text-[12px] font-bold text-[var(--fjord)]">
                  {point.order}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">
                    {point.name}
                  </span>
                  <span className="text-[11px] text-[var(--ink-faint)]">
                    {point.dayLabel}
                    {point.role === "overnight" ? " · Übernachtung" : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      {route && route.legs.length > 0 ? (
        <div className="border-t border-[var(--separator)] px-4 py-3 text-[12px] text-[var(--ink-soft)]">
          {route.legs.length} Etappe{route.legs.length === 1 ? "" : "n"}
          {" · "}
          {formatLegMeta({
            km: route.totalKm,
            minutes: route.totalMinutes,
            source,
          })}
          {" · "}
          {routeSourceHint(source)}
        </div>
      ) : null}

      {route && route.skipped.length > 0 ? (
        <p className="border-t border-[var(--separator)] px-4 py-2.5 text-[12px] text-[var(--ink-faint)]">
          Ohne Koordinaten nicht auf der Karte:{" "}
          {route.skipped
            .map((entry) =>
              entry.dayLabel ? `${entry.name} (${entry.dayLabel})` : entry.name,
            )
            .join(", ")}
        </p>
      ) : null}
    </div>
  );
}
