"use client";

import dynamic from "next/dynamic";
import { getBrowserGoogleMapsKey } from "@/lib/google-maps";
import type { RouteWaypoint } from "@/lib/day-route";

const DayRouteMapGoogle = dynamic(() => import("./day-route-map-google"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-56 items-center justify-center rounded-[16px] bg-black/5 text-[13px] text-[var(--ink-soft)]">
      Karte lädt…
    </div>
  ),
});

const DayRouteMapLeaflet = dynamic(() => import("./day-route-map-leaflet"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-56 items-center justify-center rounded-[16px] bg-black/5 text-[13px] text-[var(--ink-soft)]">
      Karte lädt…
    </div>
  ),
});

export default function DayRouteMap({
  waypoints,
  encodedPolyline = null,
  encodedPolylines = null,
  active = true,
  className = "h-56",
}: {
  waypoints: RouteWaypoint[];
  /** Google-encoded road polyline — only used with Google Maps (not Leaflet/OSM). */
  encodedPolyline?: string | null;
  encodedPolylines?: string[] | null;
  active?: boolean;
  className?: string;
}) {
  const polylines =
    encodedPolylines && encodedPolylines.length > 0
      ? encodedPolylines
      : encodedPolyline
        ? [encodedPolyline]
        : [];

  if (waypoints.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-[16px] bg-black/5 text-[13px] text-[var(--ink-soft)] ${className}`}
      >
        Keine Stops mit Koordinaten für die Karte.
      </div>
    );
  }

  if (getBrowserGoogleMapsKey()) {
    return (
      <DayRouteMapGoogle
        waypoints={waypoints}
        encodedPolylines={polylines}
        active={active}
        className={className}
      />
    );
  }
  return <DayRouteMapLeaflet waypoints={waypoints} className={className} />;
}
