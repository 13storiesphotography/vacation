"use client";

import dynamic from "next/dynamic";
import { getBrowserGoogleMapsKey } from "@/lib/google-maps";
import type { RouteWaypoint } from "@/lib/day-route";

const DayRouteMapGoogle = dynamic(() => import("./day-route-map-google"), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 items-center justify-center rounded-[16px] bg-black/5 text-[13px] text-[var(--ink-soft)]">
      Karte lädt…
    </div>
  ),
});

const DayRouteMapLeaflet = dynamic(() => import("./day-route-map-leaflet"), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 items-center justify-center rounded-[16px] bg-black/5 text-[13px] text-[var(--ink-soft)]">
      Karte lädt…
    </div>
  ),
});

export default function DayRouteMap({
  waypoints,
  active = true,
}: {
  waypoints: RouteWaypoint[];
  active?: boolean;
}) {
  if (waypoints.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-[16px] bg-black/5 text-[13px] text-[var(--ink-soft)]">
        Keine Stops mit Koordinaten für die Karte.
      </div>
    );
  }

  if (getBrowserGoogleMapsKey()) {
    return <DayRouteMapGoogle waypoints={waypoints} active={active} />;
  }
  return <DayRouteMapLeaflet waypoints={waypoints} />;
}
