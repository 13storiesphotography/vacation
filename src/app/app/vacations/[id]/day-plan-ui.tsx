"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Database } from "@/lib/database.types";
import { categoryLabels, isSpotRelevant, type SpotCategory } from "@/lib/spots";
import { isOvernightCategory } from "@/lib/overnight";
import { formatDayLabel, type DayPlanWithStops } from "@/lib/day-plans";
import {
  addSpotToDayClient,
  ensureAndLoadDayPlans,
  moveSpotOnDayClient,
  removeSpotFromDayClient,
  setDayOvernightClient,
  updateDayPlanMetaClient,
} from "@/lib/day-plans-api";
import {
  buildDayRoute,
  buildTripRoutes,
  formatRouteDuration,
  formatRouteKm,
  googleMapsDirectionsUrl,
} from "@/lib/day-route";
import { syncAllSpotStays } from "@/lib/apply-stay";
import { createClient } from "@/lib/supabase/client";
import { CategoryIcon } from "@/components/category-icon";
import { formatStaySummary, stayStatusLabels } from "@/lib/stay";
import DayRouteMap from "./day-route-map";

type Spot = Database["public"]["Tables"]["spots"]["Row"];
type Vacation = Database["public"]["Tables"]["vacations"]["Row"];

const LOAD_TIMEOUT_MS = 15000;

function friendlyError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("server components") ||
    lower.includes("digest") ||
    lower.includes("failed to find") ||
    lower.includes("unexpected response")
  ) {
    return "Verbindung zum Server gestört. Bitte Seite neu laden und nochmal versuchen.";
  }
  if (lower.includes("timeout")) {
    return "Das hat zu lange gedauert. Bitte nochmal versuchen.";
  }
  return message;
}

export function DayPlanPanel({
  vacation,
  spots,
}: {
  vacation: Vacation;
  spots: Spot[];
}) {
  const [days, setDays] = useState<DayPlanWithStops[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [titleDraft, setTitleDraft] = useState("");

  const selectedIdRef = useRef<string | null>(null);
  const dayStripRef = useRef<HTMLDivElement>(null);
  const reloadSeq = useRef(0);
  const actionChain = useRef(Promise.resolve());
  const pendingCount = useRef(0);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const spotsById = useMemo(() => {
    const map = new Map<string, Spot>();
    for (const spot of spots) map.set(spot.id, spot);
    return map;
  }, [spots]);

  const assignedSpotIds = useMemo(() => {
    const ids = new Set<string>();
    for (const day of days) {
      for (const stop of day.stops) ids.add(stop.spot_id);
      if (day.overnight_spot_id) ids.add(day.overnight_spot_id);
    }
    return ids;
  }, [days]);

  const unplannedSpots = useMemo(
    () =>
      spots.filter(
        (spot) => isSpotRelevant(spot) && !assignedSpotIds.has(spot.id),
      ),
    [spots, assignedSpotIds],
  );

  const tripRoutes = useMemo(
    () => buildTripRoutes(days, spotsById),
    [days, spotsById],
  );

  async function reload(preferId?: string | null) {
    const seq = ++reloadSeq.current;
    try {
      const supabase = createClient();
      await syncAllSpotStays(supabase, vacation.id);
      const result = await Promise.race([
        ensureAndLoadDayPlans(
          supabase,
          vacation.id,
          vacation.start_date,
          vacation.end_date,
        ),
        new Promise<{ days: DayPlanWithStops[]; error: string }>((resolve) => {
          window.setTimeout(
            () =>
              resolve({
                days: [],
                error: "Tagesplan-Timeout — bitte erneut versuchen.",
              }),
            LOAD_TIMEOUT_MS,
          );
        }),
      ]);
      if (seq !== reloadSeq.current) return;

      if (result.error) {
        setError(friendlyError(result.error));
        setLoading(false);
        return;
      }
      setDays(result.days);
      setSelectedId((current) => {
        const next = preferId ?? current;
        if (next && result.days.some((day) => day.id === next)) return next;
        // Prefer first empty day, else first day.
        const empty = result.days.find((day) => day.stops.length === 0);
        return empty?.id ?? result.days[0]?.id ?? null;
      });
      setLoading(false);
      setError(null);
    } catch (err) {
      if (seq !== reloadSeq.current) return;
      setError(
        friendlyError(
          err instanceof Error
            ? err.message
            : "Tagesplan konnte nicht geladen werden.",
        ),
      );
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vacation.id, vacation.start_date, vacation.end_date]);

  const selectedIndex = days.findIndex((day) => day.id === selectedId);
  const selected = selectedIndex >= 0 ? days[selectedIndex] : null;

  const overnightCandidates = useMemo(
    () =>
      spots.filter(
        (spot) =>
          isOvernightCategory(spot.category as SpotCategory) &&
          (isSpotRelevant(spot) ||
            // Keep currently selected overnight visible even if marked not relevant.
            spot.id === selected?.overnight_spot_id),
      ),
    [spots, selected?.overnight_spot_id],
  );

  useEffect(() => {
    setTitleDraft(selected?.title ?? "");
    setPickerOpen(false);
    setQuery("");
  }, [selected?.id, selected?.title]);

  // Keep active day chip visible in the horizontal strip.
  useEffect(() => {
    if (!selectedId || !dayStripRef.current) return;
    const chip = dayStripRef.current.querySelector<HTMLElement>(
      `[data-day-id="${selectedId}"]`,
    );
    chip?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [selectedId]);

  const availableForDay = useMemo(() => {
    if (!selected) return [];
    const used = new Set(selected.stops.map((stop) => stop.spot_id));
    if (selected.overnight_spot_id) used.add(selected.overnight_spot_id);
    return spots.filter(
      (spot) => isSpotRelevant(spot) && !used.has(spot.id),
    );
  }, [selected, spots]);

  const pickerSpots = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = availableForDay.filter((spot) => {
      if (!q) return true;
      return (
        spot.name.toLowerCase().includes(q) ||
        categoryLabels[spot.category as SpotCategory].toLowerCase().includes(q)
      );
    });
    // Unplanned first — the smart default.
    return [...filtered].sort((a, b) => {
      const aOpen = unplannedSpots.some((spot) => spot.id === a.id) ? 0 : 1;
      const bOpen = unplannedSpots.some((spot) => spot.id === b.id) ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;
      return a.name.localeCompare(b.name, "de");
    });
  }, [availableForDay, query, unplannedSpots]);

  const daysWithStops = days.filter((day) => day.stops.length > 0).length;

  function patchSelectedDay(
    updater: (day: DayPlanWithStops) => DayPlanWithStops,
  ) {
    const id = selectedIdRef.current;
    if (!id) return;
    setDays((prev) =>
      prev.map((day) => (day.id === id ? updater(day) : day)),
    );
  }

  function run(
    action: () => Promise<{ error?: string; ok?: boolean }>,
    optimistic?: () => void,
  ) {
    optimistic?.();
    pendingCount.current += 1;
    setPending(true);
    setError(null);

    actionChain.current = actionChain.current
      .then(async () => {
        const result = await action();
        if (result.error) {
          setError(friendlyError(result.error));
          await reload(selectedIdRef.current);
          return;
        }
        await reload(selectedIdRef.current);
        setPickerOpen(false);
        setQuery("");
      })
      .catch((err: unknown) => {
        setError(
          friendlyError(
            err instanceof Error ? err.message : "Unbekannter Fehler",
          ),
        );
      })
      .finally(() => {
        pendingCount.current = Math.max(0, pendingCount.current - 1);
        if (pendingCount.current === 0) setPending(false);
      });
  }

  function selectDay(id: string) {
    setSelectedId(id);
  }

  function goDay(delta: number) {
    if (selectedIndex < 0) return;
    const next = days[selectedIndex + delta];
    if (next) selectDay(next.id);
  }

  if (loading) {
    return (
      <p className="mt-4 text-[14px] text-[var(--ink-soft)]">
        Tagesplan wird geladen…
      </p>
    );
  }

  if (error && days.length === 0) {
    return (
      <div className="ios-group mt-4 p-5">
        <p className="text-[15px] font-semibold text-[var(--danger)]">
          Tagesplan-Fehler
        </p>
        <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
          {friendlyError(error)}
        </p>
        <button
          type="button"
          className="glass-chip mt-4"
          onClick={() => {
            setLoading(true);
            setError(null);
            void reload();
          }}
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="ios-group mt-4 p-5">
        <p className="text-[15px] font-semibold">Kein Zeitraum</p>
        <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
          Unter Urlaub Start- und Enddatum setzen — daraus entstehen die Tage.
        </p>
      </div>
    );
  }

  const overnight = selected?.overnight_spot_id
    ? spotsById.get(selected.overnight_spot_id)
    : null;
  const needsOvernight =
    vacation.type === "van" ||
    vacation.type === "camping" ||
    vacation.type === "hotel";
  const selectedRoute = selected
    ? buildDayRoute(selected, spotsById, selectedIndex)
    : null;
  const directionsUrl = selectedRoute
    ? googleMapsDirectionsUrl(selectedRoute.waypoints)
    : null;

  return (
    <div className="mt-3 space-y-4">
      {error && (
        <p className="text-[13px] text-[var(--danger)]">{friendlyError(error)}</p>
      )}

      {/* Overview */}
      <div className="flex items-center justify-between gap-3 px-0.5">
        <p className="text-[13px] text-[var(--ink-soft)]">
          <span className="font-semibold text-[var(--ink)]">
            {daysWithStops}/{days.length}
          </span>{" "}
          Tage befüllt
          {tripRoutes.daysWithRoute > 0
            ? ` · ca. ${formatRouteKm(tripRoutes.totalKm)} · ~${formatRouteDuration(tripRoutes.totalMinutes)}`
            : ""}
          {unplannedSpots.length > 0
            ? ` · ${unplannedSpots.length} Spot${unplannedSpots.length === 1 ? "" : "s"} noch offen`
            : spots.length > 0
              ? " · alle Spots eingeplant"
              : ""}
        </p>
      </div>

      {tripRoutes.daysWithRoute > 1 ? (
        <div className="ios-group overflow-hidden">
          <div className="px-4 pt-3.5 pb-2">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--fjord)]">
              Route über alle Tage
            </p>
            <p className="mt-1 text-[12px] text-[var(--ink-faint)]">
              Grobe Schätzung (Straßenfaktor, Van-Tempo) — nicht Navigation.
            </p>
          </div>
          <ul className="divide-y divide-[var(--separator)] px-2 pb-2">
            {tripRoutes.days
              .filter((route) => route.legs.length > 0)
              .map((route) => (
                <li key={route.dayId}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-[12px] px-2 py-2.5 text-left hover:bg-[var(--fjord-soft)]"
                    onClick={() => selectDay(route.dayId)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">
                        {route.title}
                      </span>
                      <span className="text-[11px] text-[var(--ink-faint)]">
                        {route.label} · {route.waypoints.length} Stop
                        {route.waypoints.length === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-[12px] font-semibold text-[var(--ink-soft)]">
                      {formatRouteKm(route.totalKm)}
                      <span className="block text-[11px] font-medium text-[var(--ink-faint)]">
                        ~{formatRouteDuration(route.totalMinutes)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {/* Day strip */}
      <div
        ref={dayStripRef}
        className="plan-day-strip flex gap-2 overflow-x-auto pb-1"
      >
        {days.map((day, index) => {
          const active = day.id === selectedId;
          const hasStops = day.stops.length > 0;
          const hasNight = Boolean(day.overnight_spot_id);
          return (
            <button
              key={day.id}
              type="button"
              data-day-id={day.id}
              data-active={active}
              className="plan-day-chip"
              onClick={() => selectDay(day.id)}
            >
              <span className="plan-day-chip-num">Tag {index + 1}</span>
              <span className="plan-day-chip-date">{formatDayLabel(day.date)}</span>
              <span className="plan-day-chip-dots" aria-hidden>
                <i data-on={hasStops} />
                {needsOvernight && <i data-on={hasNight} data-kind="night" />}
              </span>
            </button>
          );
        })}
      </div>

      {selected && (
        <>
          {/* Focused day header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--fjord)]">
                {formatDayLabel(selected.date)}
              </p>
              <input
                value={titleDraft}
                disabled={pending}
                className="inline-title-field"
                placeholder={`Tag ${selectedIndex + 1}`}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={() => {
                  const value = titleDraft;
                  if ((selected.title ?? "") === value) return;
                  patchSelectedDay((day) => ({
                    ...day,
                    title: value.trim() || null,
                  }));
                  run(() =>
                    updateDayPlanMetaClient(
                      createClient(),
                      vacation.id,
                      selected.id,
                      { title: value },
                    ),
                  );
                }}
              />
            </div>
            <div className="flex shrink-0 gap-1 pt-1">
              <button
                type="button"
                className="plan-nav-btn"
                disabled={pending || selectedIndex <= 0}
                aria-label="Vorheriger Tag"
                onClick={() => goDay(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="plan-nav-btn"
                disabled={pending || selectedIndex >= days.length - 1}
                aria-label="Nächster Tag"
                onClick={() => goDay(1)}
              >
                ›
              </button>
            </div>
          </div>

          {/* Route timeline */}
          <div className="ios-group overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--fjord)]">
                Route
              </p>
              <button
                type="button"
                className="glass-chip"
                disabled={pending || availableForDay.length === 0}
                onClick={() => setPickerOpen((value) => !value)}
              >
                {pickerOpen ? "Schließen" : "+ Spot"}
              </button>
            </div>

            {pickerOpen && (
              <div className="glass-subpanel mx-3 mb-3 p-2">
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Suchen oder tippen…"
                  className="glass-field mb-2 px-3 py-2.5 text-[14px]"
                />
                {pickerSpots.length === 0 ? (
                  <p className="px-2 py-3 text-[13px] text-[var(--ink-soft)]">
                    {spots.length === 0
                      ? "Noch keine Spots — zuerst unter Spots sammeln."
                      : "Keine passenden Spots mehr für diesen Tag."}
                  </p>
                ) : (
                  <ul className="max-h-56 overflow-y-auto">
                    {pickerSpots.map((spot) => {
                      const open = unplannedSpots.some((s) => s.id === spot.id);
                      return (
                        <li key={spot.id}>
                          <button
                            type="button"
                            disabled={pending}
                            className="flex w-full items-center gap-2.5 rounded-[12px] px-2 py-2.5 text-left hover:bg-[var(--fjord-soft)] disabled:opacity-50"
                            onClick={() =>
                              run(
                                () =>
                                  addSpotToDayClient(
                                    createClient(),
                                    vacation.id,
                                    selected.id,
                                    spot.id,
                                  ),
                                () => {
                                  patchSelectedDay((day) => ({
                                    ...day,
                                    stops: [
                                      ...day.stops,
                                      {
                                        id: `local-${spot.id}`,
                                        day_plan_id: day.id,
                                        spot_id: spot.id,
                                        position: day.stops.length,
                                      },
                                    ],
                                  }));
                                  setPickerOpen(false);
                                  setQuery("");
                                },
                              )
                            }
                          >
                            <CategoryIcon
                              category={spot.category as SpotCategory}
                              size={16}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-semibold">
                                {spot.name}
                              </span>
                              <span className="text-[11px] text-[var(--ink-faint)]">
                                {categoryLabels[spot.category as SpotCategory]}
                                {open ? " · noch offen" : " · schon geplant"}
                              </span>
                            </span>
                            <span className="text-[18px] font-light text-[var(--fjord)]">
                              +
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {selected.stops.length === 0 ? (
              <button
                type="button"
                disabled={pending || availableForDay.length === 0}
                className="glass-subpanel mx-3 mb-3 flex w-[calc(100%-1.5rem)] flex-col items-start border-dashed px-4 py-5 text-left disabled:opacity-50"
                onClick={() => setPickerOpen(true)}
              >
                <span className="text-[15px] font-semibold">Noch leer</span>
                <span className="mt-1 text-[13px] text-[var(--ink-soft)]">
                  Tippe, um Spots aus der Sammlung hierher zu legen.
                </span>
              </button>
            ) : (
              <ol className="px-2 pb-2">
                {selected.stops.map((stop, index) => {
                  const spot = spotsById.get(stop.spot_id);
                  if (!spot) return null;
                  const legAfter = selectedRoute?.legs.find(
                    (leg) => leg.fromSpotId === stop.spot_id,
                  );
                  const relevant = isSpotRelevant(spot);
                  return (
                    <li key={stop.id}>
                      <div className="flex items-center gap-2 rounded-[14px] px-2 py-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--fjord-soft)] text-[12px] font-bold text-[var(--fjord)]">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold">
                            {spot.name}
                          </p>
                          <p className="text-[11px] text-[var(--ink-faint)]">
                            {categoryLabels[spot.category as SpotCategory]}
                            {!relevant ? " · nicht relevant" : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center">
                          <button
                            type="button"
                            className="plan-icon-btn"
                            disabled={pending || index === 0}
                            aria-label="Nach oben"
                            onClick={() =>
                              run(
                                () =>
                                  moveSpotOnDayClient(
                                    createClient(),
                                    selected.id,
                                    spot.id,
                                    "up",
                                  ),
                                () => {
                                  patchSelectedDay((day) => {
                                    const stops = [...day.stops];
                                    const i = stops.findIndex(
                                      (entry) => entry.spot_id === spot.id,
                                    );
                                    if (i <= 0) return day;
                                    const copy = [...stops];
                                    [copy[i - 1], copy[i]] = [
                                      copy[i],
                                      copy[i - 1],
                                    ];
                                    return { ...day, stops: copy };
                                  });
                                },
                              )
                            }
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="plan-icon-btn"
                            disabled={
                              pending || index === selected.stops.length - 1
                            }
                            aria-label="Nach unten"
                            onClick={() =>
                              run(
                                () =>
                                  moveSpotOnDayClient(
                                    createClient(),
                                    selected.id,
                                    spot.id,
                                    "down",
                                  ),
                                () => {
                                  patchSelectedDay((day) => {
                                    const stops = [...day.stops];
                                    const i = stops.findIndex(
                                      (entry) => entry.spot_id === spot.id,
                                    );
                                    if (i < 0 || i >= stops.length - 1) {
                                      return day;
                                    }
                                    const copy = [...stops];
                                    [copy[i], copy[i + 1]] = [
                                      copy[i + 1],
                                      copy[i],
                                    ];
                                    return { ...day, stops: copy };
                                  });
                                },
                              )
                            }
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="plan-icon-btn text-[var(--danger)]"
                            disabled={pending}
                            aria-label="Entfernen"
                            onClick={() =>
                              run(
                                () =>
                                  removeSpotFromDayClient(
                                    createClient(),
                                    selected.id,
                                    spot.id,
                                  ),
                                () => {
                                  patchSelectedDay((day) => ({
                                    ...day,
                                    stops: day.stops.filter(
                                      (entry) => entry.spot_id !== spot.id,
                                    ),
                                  }));
                                },
                              )
                            }
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      {legAfter ? (
                        <p className="px-4 pb-1 pl-11 text-[11px] font-medium text-[var(--ink-faint)]">
                          ↓ ca. {formatRouteKm(legAfter.km)} · ~
                          {formatRouteDuration(legAfter.minutes)}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Overnight — van / camping / hotel */}
          {needsOvernight && (
            <div className="ios-group p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--fjord)]">
                Übernachtung
              </p>
              <select
                className="glass-field mt-2 px-3 py-2.5 text-[14px]"
                disabled={pending}
                value={selected.overnight_spot_id ?? ""}
                onChange={(event) => {
                  const value = event.target.value || null;
                  patchSelectedDay((day) => ({
                    ...day,
                    overnight_spot_id: value,
                  }));
                  run(() =>
                    setDayOvernightClient(
                      createClient(),
                      vacation.id,
                      selected.id,
                      value,
                    ),
                  );
                }}
              >
                <option value="">Noch offen</option>
                {overnightCandidates.map((spot) => (
                  <option key={spot.id} value={spot.id}>
                    {spot.name}
                    {spot.stay_status
                      ? ` · ${stayStatusLabels[spot.stay_status]}`
                      : ""}
                    {formatStaySummary(spot)
                      ? ` · ${formatStaySummary(spot)}`
                      : spot.overnight_cost
                        ? ` · ${spot.overnight_cost}`
                        : ""}
                  </option>
                ))}
              </select>
              {overnightCandidates.length === 0 ? (
                <p className="mt-2 text-[12px] text-[var(--ink-faint)]">
                  Stellplätze oder Airbnbs unter Spots anlegen — dann erscheinen sie hier.
                </p>
              ) : overnight ? (
                <p className="mt-2 text-[12px] text-[var(--ink-soft)]">
                  Heute Nacht: {overnight.name}
                  {overnight.stay_status
                    ? ` · ${stayStatusLabels[overnight.stay_status]}`
                    : ""}
                </p>
              ) : null}
            </div>
          )}

          {selectedRoute && selectedRoute.waypoints.length > 0 ? (
            <div className="ios-group overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-3.5 pb-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--fjord)]">
                    Route auf der Karte
                  </p>
                  <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                    {selectedRoute.waypoints.length} Stop
                    {selectedRoute.waypoints.length === 1 ? "" : "s"}
                    {selectedRoute.legs.length > 0
                      ? ` · ca. ${formatRouteKm(selectedRoute.totalKm)} · ~${formatRouteDuration(selectedRoute.totalMinutes)}`
                      : ""}
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--ink-faint)]">
                    Reihenfolge wie im Plan. Schätzung (Straßenfaktor, Van-Tempo).
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
              <div className="px-3 pb-3">
                <DayRouteMap waypoints={selectedRoute.waypoints} />
              </div>
              {selectedRoute.legs.length > 0 ? (
                <ul className="divide-y divide-[var(--separator)] border-t border-[var(--separator)] px-2 pb-2">
                  {selectedRoute.legs.map((leg) => (
                    <li
                      key={`${leg.fromSpotId}-${leg.toSpotId}-${leg.fromOrder}`}
                      className="flex items-center justify-between gap-3 px-2 py-2.5"
                    >
                      <p className="min-w-0 text-[13px] text-[var(--ink-soft)]">
                        <span className="font-semibold text-[var(--ink)]">
                          {leg.fromName}
                        </span>
                        <span className="mx-1.5 text-[var(--ink-faint)]">→</span>
                        <span className="font-semibold text-[var(--ink)]">
                          {leg.toName}
                        </span>
                      </p>
                      <p className="shrink-0 text-right text-[12px] font-semibold text-[var(--ink-soft)]">
                        {formatRouteKm(leg.km)}
                        <span className="block text-[11px] font-medium text-[var(--ink-faint)]">
                          ~{formatRouteDuration(leg.minutes)}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
              {selectedRoute.skipped.length > 0 ? (
                <p className="border-t border-[var(--separator)] px-4 py-2.5 text-[12px] text-[var(--ink-faint)]">
                  Ohne Koordinaten nicht auf der Route:{" "}
                  {selectedRoute.skipped.map((entry) => entry.name).join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Quick pool of still-open spots */}
          {!pickerOpen && unplannedSpots.length > 0 && (
            <div>
              <p className="mb-2 px-0.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                Noch nicht eingeplant
              </p>
              <div className="plan-quick-row flex gap-2 overflow-x-auto pb-1">
                {unplannedSpots.slice(0, 12).map((spot) => (
                  <button
                    key={spot.id}
                    type="button"
                    disabled={pending}
                    className="plan-quick-spot"
                    onClick={() =>
                      run(
                        () =>
                          addSpotToDayClient(
                            createClient(),
                            vacation.id,
                            selected.id,
                            spot.id,
                          ),
                        () => {
                          patchSelectedDay((day) => ({
                            ...day,
                            stops: [
                              ...day.stops,
                              {
                                id: `local-${spot.id}`,
                                day_plan_id: day.id,
                                spot_id: spot.id,
                                position: day.stops.length,
                              },
                            ],
                          }));
                        },
                      )
                    }
                  >
                    <CategoryIcon
                      category={spot.category as SpotCategory}
                      size={14}
                    />
                    <span className="truncate">{spot.name}</span>
                    <span className="text-[var(--fjord)]">+</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
