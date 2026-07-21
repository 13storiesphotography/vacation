"use client";

import dynamic from "next/dynamic";
import { getBrowserGoogleMapsKey, type MappableSpot } from "@/lib/google-maps";
import type { SpotRatingSummary } from "@/lib/ratings";

const SpotMapGoogle = dynamic(() => import("./spot-map-google"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-[18px] bg-[linear-gradient(160deg,#c5d5d0,#8aa4ad)] text-[14px] font-semibold text-white">
      Google Maps lädt…
    </div>
  ),
});

const SpotMapLeaflet = dynamic(() => import("./spot-map-leaflet"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-[18px] bg-[linear-gradient(160deg,#c5d5d0,#8aa4ad)] text-[14px] font-semibold text-white">
      Karte lädt…
    </div>
  ),
});

export type { MappableSpot };

export default function SpotMapCanvas({
  spots,
  summaries,
  selectedId,
  onSelect,
  expanded = false,
  active = true,
}: {
  spots: MappableSpot[];
  summaries: Record<string, SpotRatingSummary>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  expanded?: boolean;
  active?: boolean;
}) {
  const useGoogle = Boolean(getBrowserGoogleMapsKey());
  if (useGoogle) {
    return (
      <SpotMapGoogle
        spots={spots}
        summaries={summaries}
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
      selectedId={selectedId}
      onSelect={onSelect}
      expanded={expanded}
      active={active}
    />
  );
}
