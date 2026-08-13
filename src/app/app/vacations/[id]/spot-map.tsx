"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { categoryLabels, categoryOptions, isSpotRelevant } from "@/lib/spots";
import { resolveSpotCoords } from "@/lib/geo";
import {
  emptySummary,
  type RaterOption,
  type SpotRating,
  type SpotRatingSummary,
} from "@/lib/ratings";
import type { Database } from "@/lib/database.types";
import type { MappableSpot } from "@/lib/google-maps";
import { CategoryIcon } from "@/components/category-icon";
import { hasFinePointer } from "./map-gestures";
import {
  filterSpotCollection,
  SpotPlaceSession,
  type SpotCollectionFilterState,
} from "./spot-ui";

type Spot = Database["public"]["Tables"]["spots"]["Row"];

const SpotMapCanvas = dynamic(() => import("./spot-map-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-[18px] media-fallback text-[14px] font-semibold text-white">
      Karte lädt…
    </div>
  ),
});

export function SpotMap({
  vacationId,
  spots,
  ratings,
  summaries,
  raters,
  currentUserId,
  filters,
  canEdit = false,
  active = true,
  onChanged,
  onMyRatingPatch,
  onSpotPatch,
}: {
  vacationId: string;
  spots: Spot[];
  ratings: SpotRating[];
  summaries: Record<string, SpotRatingSummary>;
  raters: RaterOption[];
  currentUserId: string | null;
  filters: SpotCollectionFilterState;
  canEdit?: boolean;
  /** False while another vacation tab is shown — collapse overlay and resize on return. */
  active?: boolean;
  onChanged?: () => void | Promise<void>;
  onMyRatingPatch: (
    spotId: string,
    patch: { rating?: number | null; isFavorite?: boolean },
  ) => void;
  onSpotPatch?: (spotId: string, patch: Partial<Spot>) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [desktopPointer, setDesktopPointer] = useState(true);

  useEffect(() => {
    const sync = () => setDesktopPointer(hasFinePointer());
    sync();
    const media = window.matchMedia("(any-pointer: fine)");
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  // Collapse fullscreen map when leaving the map tab (adjust state during render).
  if (!active && expanded) {
    setExpanded(false);
  }

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

  const filtered = useMemo(
    () => filterSpotCollection(spots, summaries, filters),
    [filters, spots, summaries],
  );

  const { mappable, withoutCoords } = useMemo(() => {
    const withCoords: MappableSpot[] = [];
    const missing: Spot[] = [];
    for (const spot of filtered) {
      const coords = resolveSpotCoords(spot);
      if (coords) withCoords.push({ ...spot, coords });
      else missing.push(spot);
    }
    return { mappable: withCoords, withoutCoords: missing };
  }, [filtered]);

  const selected =
    spots.find((spot) => spot.id === selectedId) ??
    mappable.find((spot) => spot.id === selectedId) ??
    null;

  function selectSpot(id: string | null, openEditor = false) {
    setSelectedId(id);
    setEditing(Boolean(id && openEditor && canEdit));
  }

  return (
    <div className="mt-3">
      <p className="meta-text mb-2">
        {mappable.length} Spot{mappable.length === 1 ? "" : "s"} auf der Karte
        {withoutCoords.length > 0
          ? ` · ${withoutCoords.length} ohne Koordinaten`
          : ""}
        {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
          ? " · Google Maps"
          : " · OpenStreetMap"}
        {" · "}
        {expanded || desktopPointer
          ? "Ziehen oder Mausrad zum Zoomen"
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
          spots={mappable}
          summaries={summaries}
          selectedId={selectedId}
          onSelect={(id) => selectSpot(id, false)}
          onEditRequest={canEdit ? (id) => selectSpot(id, true) : undefined}
          expanded={expanded}
          active={active}
        />
      </div>

      {selected ? (
        <SpotPlaceSession
          spot={selected}
          vacationId={vacationId}
          canEdit={canEdit}
          editing={editing}
          onEditingChange={setEditing}
          onClose={() => {
            setSelectedId(null);
            setEditing(false);
          }}
          summary={summaries[selected.id] ?? emptySummary()}
          ratings={ratings}
          raters={raters}
          currentUserId={currentUserId}
          onMyRatingPatch={onMyRatingPatch}
          onChanged={() => {
            void onChanged?.();
          }}
          onSpotPatch={onSpotPatch}
        />
      ) : null}

      {withoutCoords.length > 0 && (
        <div className="mt-4">
          <p className="text-[13px] font-semibold text-[var(--ink-soft)]">
            Ohne Kartenposition
          </p>
          <p className="mt-1 text-[12px] text-[var(--ink-faint)]">
            Spot öffnen und einen Google-Maps-Link („Link teilen“) hinterlegen.
          </p>
          <ul className="ios-group mt-2">
            {withoutCoords.map((spot) => (
              <li key={spot.id}>
                <button
                  type="button"
                  className="ios-row w-full"
                  onClick={() => selectSpot(spot.id, false)}
                >
                  <CategoryIcon category={spot.category} size={16} />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-[14px] font-semibold">{spot.name}</p>
                    <p className="text-[12px] text-[var(--ink-soft)]">
                      {categoryLabels[spot.category]}
                      {!isSpotRelevant(spot) ? " · Archiv" : ""}
                    </p>
                  </div>
                  <span className="ios-chevron" aria-hidden />
                </button>
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
