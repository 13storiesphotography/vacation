"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  categoryLabels,
  categoryOptions,
  type SpotCategory,
} from "@/lib/spots";
import { resolveSpotCoords } from "@/lib/geo";
import { emptySummary, type SpotRatingSummary } from "@/lib/ratings";
import type { Database } from "@/lib/database.types";
import type { MappableSpot } from "@/lib/google-maps";
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
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

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
          className="glass-chip"
          data-active={filter === "alle"}
        >
          Alle
        </button>
        {categoryOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            className="glass-chip"
            data-active={filter === option}
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
            className="glass-field mt-1 px-3 py-2.5 text-[14px]"
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
            className="glass-field mt-1 px-3 py-2.5 text-[14px]"
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
        {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
          ? " · Google Maps"
          : " · OpenStreetMap (Google-Key fehlt)"}
        {" · "}
        {expanded
          ? "Ein Finger zum Verschieben"
          : "Zwei Finger zum Verschieben"}
      </p>

      <div
        className={
          expanded
            ? "spot-map-frame spot-map-frame--expanded"
            : "spot-map-frame"
        }
      >
        <div className="spot-map-toolbar">
          <button
            type="button"
            className="glass-chip"
            data-active={expanded}
            onClick={() => setExpanded((value) => !value)}
            aria-pressed={expanded}
          >
            {expanded ? "Schließen" : "Vergrößern"}
          </button>
        </div>
        <SpotMapCanvas
          spots={visible}
          summaries={summaries}
          selectedId={selectedId}
          onSelect={setSelectedId}
          expanded={expanded}
        />
      </div>

      {selected && (
        <div className="ios-group mt-3 overflow-hidden">
          {selected.image_url ? (
            <div className="relative aspect-[16/7] w-full bg-[linear-gradient(160deg,#c5d5d0,#8aa4ad)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.image_url}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-2 left-2 inline-flex rounded-full bg-white/95 p-1.5 shadow-sm">
                <CategoryIcon category={selected.category} size={14} />
              </span>
            </div>
          ) : null}
          <div className="flex items-start gap-3 p-4">
            {!selected.image_url && (
              <CategoryIcon category={selected.category} size={18} className="mt-0.5" />
            )}
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
