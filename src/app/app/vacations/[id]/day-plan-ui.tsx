"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Database } from "@/lib/database.types";
import { categoryLabels, type SpotCategory } from "@/lib/spots";
import { formatDayLabel, type DayPlanWithStops } from "@/lib/day-plans";
import { CategoryIcon } from "@/components/category-icon";
import {
  addSpotToDay,
  ensureVacationDayPlans,
  moveSpotOnDay,
  removeSpotFromDay,
  setDayOvernight,
  updateDayPlanMeta,
} from "./plan-actions";

type Spot = Database["public"]["Tables"]["spots"]["Row"];
type Vacation = Database["public"]["Tables"]["vacations"]["Row"];

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
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);

  const spotsById = useMemo(() => {
    const map = new Map<string, Spot>();
    for (const spot of spots) map.set(spot.id, spot);
    return map;
  }, [spots]);

  const overnightCandidates = useMemo(
    () => spots.filter((spot) => spot.category === "stellplatz"),
    [spots],
  );

  async function reload(preferId?: string | null) {
    const result = await ensureVacationDayPlans(vacation.id);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setDays(result.days);
    setSelectedId((current) => {
      const next = preferId ?? current;
      if (next && result.days.some((day) => day.id === next)) return next;
      return result.days[0]?.id ?? null;
    });
    setLoading(false);
    setError(null);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when vacation dates change
  }, [vacation.id, vacation.start_date, vacation.end_date]);

  const selected = days.find((day) => day.id === selectedId) ?? null;

  const availableSpots = useMemo(() => {
    if (!selected) return [];
    const used = new Set(selected.stops.map((stop) => stop.spot_id));
    if (selected.overnight_spot_id) used.add(selected.overnight_spot_id);
    return spots.filter((spot) => !used.has(spot.id));
  }, [selected, spots]);

  function run(action: () => Promise<{ error?: string; ok?: boolean }>) {
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      await reload(selectedId);
      setAdding(false);
    });
  }

  if (loading) {
    return <p className="mt-4 text-[14px] text-[var(--ink-soft)]">Tagesplan wird geladen…</p>;
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

  return (
    <div className="mt-4">
      {error && <p className="mb-3 text-[13px] text-[var(--danger)]">{error}</p>}

      <div className="ios-group">
        {days.map((day, index) => {
          const overnight = day.overnight_spot_id
            ? spotsById.get(day.overnight_spot_id)
            : null;
          const isActive = day.id === selectedId;
          return (
            <button
              key={day.id}
              type="button"
              className="ios-row ios-chevron"
              data-active={isActive}
              onClick={() => {
                setSelectedId(day.id);
                setAdding(false);
              }}
            >
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-[var(--ink-soft)]">
                  {formatDayLabel(day.date)}
                </p>
                <p className="truncate text-[15px] font-semibold">
                  {day.title?.trim() || `Tag ${index + 1}`}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--ink-faint)]">
                  {day.stops.length} Stop{day.stops.length === 1 ? "" : "s"}
                  {overnight
                    ? ` · Übernachtung: ${overnight.name}`
                    : " · Übernachtung offen"}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-4 space-y-4">
          <div className="ios-group p-4">
            <label className="block text-[12px] font-semibold uppercase tracking-wide text-[var(--fjord)]">
              Titel
              <input
                key={`${selected.id}-title`}
                defaultValue={selected.title ?? ""}
                disabled={pending}
                className="mt-1.5 w-full rounded-[12px] border-0 bg-black/5 px-3 py-2.5 text-[15px] font-semibold normal-case tracking-normal text-[var(--ink)] outline-none ring-[var(--fjord)] focus:ring-2"
                placeholder={`Tag ${days.findIndex((d) => d.id === selected.id) + 1}`}
                onBlur={(event) => {
                  const value = event.target.value;
                  if ((selected.title ?? "") === value) return;
                  run(() =>
                    updateDayPlanMeta(vacation.id, selected.id, { title: value }),
                  );
                }}
              />
            </label>
            <label className="mt-3 block text-[12px] font-semibold uppercase tracking-wide text-[var(--fjord)]">
              Notizen
              <textarea
                key={`${selected.id}-notes`}
                defaultValue={selected.notes ?? ""}
                disabled={pending}
                className="mt-1.5 min-h-20 w-full rounded-[12px] border-0 bg-black/5 px-3 py-2.5 text-[14px] font-normal normal-case tracking-normal text-[var(--ink)] outline-none ring-[var(--fjord)] focus:ring-2"
                placeholder="Etappe, Fähre, Einkauf…"
                onBlur={(event) => {
                  const value = event.target.value;
                  if ((selected.notes ?? "") === value) return;
                  run(() =>
                    updateDayPlanMeta(vacation.id, selected.id, { notes: value }),
                  );
                }}
              />
            </label>
          </div>

          {(vacation.type === "van" || vacation.type === "camping") && (
            <div className="ios-group p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--fjord)]">
                Übernachtung
              </p>
              <select
                key={`${selected.id}-overnight`}
                className="mt-2 w-full rounded-[12px] border-0 bg-black/5 px-3 py-2.5 text-[14px] outline-none ring-[var(--fjord)] focus:ring-2"
                disabled={pending}
                value={selected.overnight_spot_id ?? ""}
                onChange={(event) => {
                  const value = event.target.value || null;
                  run(() => setDayOvernight(vacation.id, selected.id, value));
                }}
              >
                <option value="">Noch offen</option>
                {overnightCandidates.map((spot) => (
                  <option key={spot.id} value={spot.id}>
                    {spot.name}
                    {spot.overnight_cost ? ` · ${spot.overnight_cost}` : ""}
                  </option>
                ))}
              </select>
              {overnightCandidates.length === 0 && (
                <p className="mt-2 text-[12px] text-[var(--ink-faint)]">
                  Noch keine Stellplätze in der Sammlung.
                </p>
              )}
            </div>
          )}

          <div className="ios-group p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--fjord)]">
                Stops
              </p>
              <button
                type="button"
                className="text-[13px] font-semibold text-[var(--fjord)] disabled:opacity-40"
                disabled={pending || availableSpots.length === 0}
                onClick={() => setAdding((value) => !value)}
              >
                {adding ? "Schließen" : "Hinzufügen"}
              </button>
            </div>

            {adding && (
              <div className="mt-3 max-h-48 overflow-y-auto rounded-[12px] bg-black/[0.03]">
                {availableSpots.length === 0 ? (
                  <p className="p-3 text-[13px] text-[var(--ink-soft)]">
                    Alle Spots sind an diesem Tag schon eingeplant.
                  </p>
                ) : (
                  availableSpots.map((spot) => (
                    <button
                      key={spot.id}
                      type="button"
                      className="flex w-full items-center gap-2 border-b border-[var(--separator)] px-3 py-2.5 text-left last:border-0"
                      disabled={pending}
                      onClick={() =>
                        run(() => addSpotToDay(vacation.id, selected.id, spot.id))
                      }
                    >
                      <CategoryIcon category={spot.category as SpotCategory} size={14} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">
                          {spot.name}
                        </span>
                        <span className="text-[11px] text-[var(--ink-faint)]">
                          {categoryLabels[spot.category as SpotCategory]}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {selected.stops.length === 0 ? (
              <p className="mt-3 text-[14px] text-[var(--ink-soft)]">
                Noch keine Stops — Spot aus der Sammlung hinzufügen.
              </p>
            ) : (
              <ol className="mt-3 space-y-2">
                {selected.stops.map((stop, index) => {
                  const spot = spotsById.get(stop.spot_id);
                  if (!spot) return null;
                  return (
                    <li
                      key={stop.id}
                      className="flex items-center gap-2 rounded-[12px] bg-black/[0.03] px-2.5 py-2"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--fjord-soft)] text-[12px] font-bold text-[var(--fjord)]">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold">{spot.name}</p>
                        <p className="text-[11px] text-[var(--ink-faint)]">
                          {categoryLabels[spot.category as SpotCategory]}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          className="h-7 w-7 rounded-lg text-[13px] font-semibold text-[var(--ink-soft)] disabled:opacity-30"
                          disabled={pending || index === 0}
                          aria-label="Nach oben"
                          onClick={() =>
                            run(() =>
                              moveSpotOnDay(vacation.id, selected.id, spot.id, "up"),
                            )
                          }
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="h-7 w-7 rounded-lg text-[13px] font-semibold text-[var(--ink-soft)] disabled:opacity-30"
                          disabled={pending || index === selected.stops.length - 1}
                          aria-label="Nach unten"
                          onClick={() =>
                            run(() =>
                              moveSpotOnDay(vacation.id, selected.id, spot.id, "down"),
                            )
                          }
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="h-7 px-1.5 text-[12px] font-semibold text-[var(--danger)]"
                          disabled={pending}
                          onClick={() =>
                            run(() =>
                              removeSpotFromDay(vacation.id, selected.id, spot.id),
                            )
                          }
                        >
                          Entf.
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
