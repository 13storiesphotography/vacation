import type { DayRoute, RouteLeg, RouteSource } from "@/lib/day-route";
import type { LatLng } from "@/lib/geo";
import { computeDrivingRoute, type GoogleRouteResult } from "@/lib/google-routes";

export function applyGoogleRouteToDayRoute(
  route: DayRoute,
  google: GoogleRouteResult,
): DayRoute {
  if (google.legs.length !== route.legs.length) return route;
  const legs: RouteLeg[] = route.legs.map((leg, index) => ({
    ...leg,
    km: google.legs[index].km,
    minutes: google.legs[index].minutes,
    source: "google" as RouteSource,
  }));
  return {
    ...route,
    legs,
    totalKm: google.totalKm,
    totalMinutes: google.totalMinutes,
    source: "google",
    encodedPolyline: google.encodedPolyline,
  };
}

export async function enrichDayRoute(route: DayRoute): Promise<DayRoute> {
  if (route.waypoints.length < 2 || route.legs.length === 0) return route;
  const points = route.waypoints.map((point) => point.coords);
  const google = await computeDrivingRoute(points);
  if (!google) return route;
  return applyGoogleRouteToDayRoute(route, google);
}

export async function enrichDrivingLeg(
  from: LatLng,
  to: LatLng,
): Promise<{ km: number; minutes: number; source: RouteSource } | null> {
  const google = await computeDrivingRoute([from, to]);
  if (!google?.legs[0]) return null;
  return {
    km: google.legs[0].km,
    minutes: google.legs[0].minutes,
    source: "google",
  };
}
