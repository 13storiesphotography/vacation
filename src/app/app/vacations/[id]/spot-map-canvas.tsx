"use client";

import dynamic from "next/dynamic";
import { getBrowserGoogleMapsKey, type MappableSpot } from "@/lib/google-maps";
import type { SpotRatingSummary } from "@/lib/ratings";
import type { VacationSpotCategory } from "@/lib/spots";

const SpotMapGoogle = dynamic(() => import("./spot-map-google"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-[18px] media-fallback text-[14px] font-semibold text-white">
      Google Maps lädt…
    </div>
  ),
});

const SpotMapLeaflet = dynamic(() => import("./spot-map-leaflet"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-[18px] media-fallback text-[14px] font-semibold text-white">
      Karte lädt…
    </div>
  ),
});

export type { MappableSpot };

export default function SpotMapCanvas({
  spots,
  summaries,
  categories,
  selectedId,
  onSelect,
  onEditRequest,
  expanded = false,
  active = true,
}: {
  spots: MappableSpot[];
  summaries: Record<string, SpotRatingSummary>;
  categories?: VacationSpotCategory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onEditRequest?: (id: string) => void;
  expanded?: boolean;
  active?: boolean;
}) {
  const useGoogle = Boolean(getBrowserGoogleMapsKey());
  if (useGoogle) {
    return (
      <SpotMapGoogle
        spots={spots}
        summaries={summaries}
        categories={categories}
        selectedId={selectedId}
        onSelect={onSelect}
        expanded={expanded}
        active={active}
      />
    );
  }
  return (
    <SpotMapLeaflet
      spots={spots}
      summaries={summaries}
      categories={categories}
      selectedId={selectedId}
      onSelect={onSelect}
      onEditRequest={onEditRequest}
      expanded={expanded}
      active={active}
    />
  );
}
