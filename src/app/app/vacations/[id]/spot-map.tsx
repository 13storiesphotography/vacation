"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  categoryLabels,
  categoryOptions,
  type SpotCategory,
} from "@/lib/spots";
import { resolveSpotCoords } from "@/lib/geo";
import { emptySummary, type SpotRatingSummary } from "@/lib/ratings";
import type { Database } from "@/lib/database.types";
import type { MappableSpot } from "./spot-map-canvas";
import { CategoryIcon } from "@/components/category-icon";

type Spot = Database["public"]["Tables"]["spots"]["Row"];

const SpotMapCanvas = dynamic(() => import("./spot-map-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-[18px] bg-[linear-gradient(160deg,#c5d5d0,#8aa4ad)] text-[14px] font-semibold text-white">
      Karte lädt…
    </div>
  ),
});

type MapFilter = "alle" | SpotCategory;
type FocusMode = "all" | "favorites" | "rated";

export function SpotMap({
  spots,
  summaries,
}: {
  spots: Spot[];
  summaries: Record<string, SpotRatingSummary>;
}) {
  const [filter, setFilter] = useState<MapFilter>("alle");
  const [focus, setFocus] = useState<FocusMode>("all");
  const [minAvg, setMinAvg] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { mappable, withoutCoords } = useMemo(() => {
    const withCoords: MappableSpot[] = [];
    const missing: Spot[] = [];
    for (const spot of spots) {
      const coords = resolveSpotCoords(spot);
      if (coords) withCoords.push({ ...spot, coords });
      else missing.push(spot);
    }
    return { mappable: withCoords, withoutCoords: missing };
  }, [spots]);

  const visible = useMemo(() => {
    return mappable.filter((spot) => {
      if (filter !== "alle" && spot.category !== filter) return false;
      const summary = summaries[spot.id] ?? emptySummary();
      if (focus === "favorites" && !summary.myFavorite) return false;
      if (focus === "rated" && summary.myRating == null) return false;
      if (minAvg > 0 && (summary.average ?? 0) < minAvg) return false;
      return true;
    });
  }, [filter, focus, mappable, minAvg, summaries]);

  const selected = visible.find((spot) => spot.id === selectedId) ?? null;

  return (
    <div className="mt-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("alle")}
          className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
            filter === "alle" ? "bg-[var(--fjord)] text-white" : "bg-black/5 text-[var(--ink-soft)]"
          }`}
        >
          Alle
        </button>
        {categoryOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              filter === option
                ? "bg-[var(--fjord)] text-white"
                : "bg-black/5 text-[var(--ink-soft)]"
            }`}
          >
            <CategoryIcon
              category={option}
              size={14}
              tone={filter === option ? "#ffffff" : undefined}
            />
            {categoryLabels[option]}
          </button>
        ))}
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="block text-[12px] font-semibold text-[var(--ink-soft)]">
          Fokus
          <select
            value={focus}
            onChange={(e) => setFocus(e.target.value as FocusMode)}
            className="mt-1 w-full rounded-[12px] border-0 bg-black/5 px-3 py-2.5 text-[14px] outline-none"
          >
            <option value="all">Alle Spots mit Koordinaten</option>
            <option value="favorites">Nur meine Favoriten</option>
            <option value="rated">Nur von mir bewertet</option>
          </select>
        </label>
        <label className="block text-[12px] font-semibold text-[var(--ink-soft)]">
          Min. Gesamtbewertung
          <select
            value={minAvg}
            onChange={(e) => setMinAvg(Number(e.target.value))}
            className="mt-1 w-full rounded-[12px] border-0 bg-black/5 px-3 py-2.5 text-[14px] outline-none"
          >
            <option value={0}>Keine Mindestnote</option>
            <option value={3}>ab 3★</option>
            <option value={4}>ab 4★</option>
            <option value={4.5}>ab 4,5★</option>
          </select>
        </label>
      </div>

      <p className="mb-2 text-[12px] text-[var(--ink-soft)]">
        {visible.length} Spot{visible.length === 1 ? "" : "s"} auf der Karte
        {withoutCoords.length > 0
          ? ` · ${withoutCoords.length} ohne Koordinaten`
          : ""}
      </p>

      <div className="h-[min(68vh,640px)] overflow-hidden rounded-[18px] border border-[var(--separator)] shadow-[0_8px_28px_rgba(31,53,64,0.08)]">
        <SpotMapCanvas
          spots={visible}
          summaries={summaries}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {selected && (
        <div className="ios-group mt-3 p-4">
          <div className="flex items-start gap-3">
            <CategoryIcon category={selected.category} size={18} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              {selected.maps_url ? (
                <a
                  href={selected.maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[15px] font-semibold text-[var(--fjord)] hover:underline"
                >
                  {selected.name}
                </a>
              ) : (
                <p className="text-[15px] font-semibold">{selected.name}</p>
              )}
              <p className="text-[12px] text-[var(--ink-soft)]">
                {categoryLabels[selected.category]}
                {selected.overnight_cost ? ` · ${selected.overnight_cost}` : ""}
                {selected.info_url && (
                  <>
                    {" · "}
                    <a
                      href={selected.info_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[var(--fjord)]"
                    >
                      Info
                    </a>
                  </>
                )}
              </p>
              {selected.description && (
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-soft)]">
                  {selected.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {withoutCoords.length > 0 && (
        <div className="mt-4">
          <p className="text-[13px] font-semibold text-[var(--ink-soft)]">
            Ohne Kartenposition
          </p>
          <p className="mt-1 text-[12px] text-[var(--ink-faint)]">
            Spot bearbeiten und einen Google-Maps-Link („Link teilen“) hinterlegen.
          </p>
          <ul className="ios-group mt-2">
            {withoutCoords.map((spot) => (
              <li key={spot.id} className="ios-row">
                <CategoryIcon category={spot.category} size={16} />
                <div>
                  <p className="text-[14px] font-semibold">{spot.name}</p>
                  <p className="text-[12px] text-[var(--ink-soft)]">
                    {categoryLabels[spot.category]}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {categoryOptions.map((option) => (
          <span key={option} className="flex items-center gap-1.5 text-[11px] text-[var(--ink-soft)]">
            <CategoryIcon category={option} size={14} />
            {categoryLabels[option]}
          </span>
        ))}
      </div>
    </div>
  );
}
