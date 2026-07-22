import type { Database } from "@/lib/database.types";
import type { DayPlanWithStops } from "@/lib/day-plans";
import { formatDayLabel } from "@/lib/day-plans";
import { resolveSpotCoords, type LatLng } from "@/lib/geo";

type Spot = Database["public"]["Tables"]["spots"]["Row"];

export type RouteWaypoint = {
  spotId: string;
  name: string;
  category: Spot["category"];
  coords: LatLng;
  role: "stop" | "overnight";
  /** 1-based order in the day route. */
  order: number;
};

export type RouteLeg = {
  fromOrder: number;
  toOrder: number;
  fromSpotId: string;
  toSpotId: string;
  fromName: string;
  toName: string;
  /** Approximate road km (haversine × road factor). */
  km: number;
  /** Rough drive minutes at van pace. */
  minutes: number;
};

export type DayRoute = {
  dayId: string;
  date: string;
  label: string;
  title: string | null;
  waypoints: RouteWaypoint[];
  skipped: Array<{ spotId: string; name: string; reason: string }>;
  legs: RouteLeg[];
  totalKm: number;
  totalMinutes: number;
};

const ROAD_FACTOR = 1.3;
const VAN_KMH = 65;

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function estimateRoadKm(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * ROAD_FACTOR;
}

function estimateMinutes(km: number): number {
  return Math.max(1, Math.round((km / VAN_KMH) * 60));
}

export function formatRouteKm(km: number): string {
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}

export function formatRouteDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} Min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} Std`;
  return `${h} Std ${m} Min`;
}

/** Ordered waypoints for a day: stops by position, then overnight if new. */
export function buildDayRoute(
  day: DayPlanWithStops,
  spotsById: Map<string, Spot>,
  dayIndex = 0,
): DayRoute {
  const waypoints: RouteWaypoint[] = [];
  const skipped: DayRoute["skipped"] = [];
  const seen = new Set<string>();

  function pushSpot(spotId: string, role: "stop" | "overnight") {
    if (seen.has(spotId)) return;
    const spot = spotsById.get(spotId);
    if (!spot) {
      skipped.push({ spotId, name: "Unbekannter Spot", reason: "nicht gefunden" });
      return;
    }
    const coords = resolveSpotCoords(spot);
    if (!coords) {
      skipped.push({
        spotId,
        name: spot.name,
        reason: "ohne Koordinaten",
      });
      return;
    }
    seen.add(spotId);
    waypoints.push({
      spotId,
      name: spot.name,
      category: spot.category,
      coords,
      role,
      order: waypoints.length + 1,
    });
  }

  const orderedStops = [...day.stops].sort((a, b) => a.position - b.position);
  for (const stop of orderedStops) {
    pushSpot(stop.spot_id, "stop");
  }
  if (day.overnight_spot_id) {
    pushSpot(day.overnight_spot_id, "overnight");
  }

  const legs: RouteLeg[] = [];
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    const km = estimateRoadKm(from.coords, to.coords);
    legs.push({
      fromOrder: from.order,
      toOrder: to.order,
      fromSpotId: from.spotId,
      toSpotId: to.spotId,
      fromName: from.name,
      toName: to.name,
      km,
      minutes: estimateMinutes(km),
    });
  }

  const totalKm = legs.reduce((sum, leg) => sum + leg.km, 0);
  const totalMinutes = legs.reduce((sum, leg) => sum + leg.minutes, 0);

  return {
    dayId: day.id,
    date: day.date,
    label: formatDayLabel(day.date),
    title: day.title ?? `Tag ${dayIndex + 1}`,
    waypoints,
    skipped,
    legs,
    totalKm,
    totalMinutes,
  };
}

export function buildTripRoutes(
  days: DayPlanWithStops[],
  spotsById: Map<string, Spot>,
): {
  days: DayRoute[];
  totalKm: number;
  totalMinutes: number;
  daysWithRoute: number;
} {
  const routes = days.map((day, index) => buildDayRoute(day, spotsById, index));
  const withLegs = routes.filter((route) => route.legs.length > 0);
  return {
    days: routes,
    totalKm: withLegs.reduce((sum, route) => sum + route.totalKm, 0),
    totalMinutes: withLegs.reduce((sum, route) => sum + route.totalMinutes, 0),
    daysWithRoute: withLegs.length,
  };
}

/** Google Maps directions deep link for the day's waypoints. */
export function googleMapsDirectionsUrl(waypoints: RouteWaypoint[]): string | null {
  if (waypoints.length < 2) return null;
  const origin = waypoints[0].coords;
  const destination = waypoints[waypoints.length - 1].coords;
  const middle = waypoints.slice(1, -1);
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
  url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
  url.searchParams.set("travelmode", "driving");
  if (middle.length > 0) {
    url.searchParams.set(
      "waypoints",
      middle.map((point) => `${point.coords.lat},${point.coords.lng}`).join("|"),
    );
  }
  return url.toString();
}
