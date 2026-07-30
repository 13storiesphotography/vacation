"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DayRoute, RouteSource } from "@/lib/day-route";

type ApiLeg = {
  km: number;
  minutes: number;
  minutesStatic?: number;
  trafficAware?: boolean;
};

type ApiOk = {
  available: true;
  source: "google";
  legs: ApiLeg[];
  totalKm: number;
  totalMinutes: number;
  encodedPolyline: string | null;
  encodedPolylines?: string[];
  trafficAware?: boolean;
};

/**
 * Enrich a local day-route estimate with Google Routes when available.
 * Keeps the estimate visible until/unless Google responds.
 *
 * Pass departureTime (ISO-8601) to enable future-departure traffic prediction.
 * Without it TRAFFIC_AWARE uses current live conditions.
 */
export function useEnrichedDayRoute(
  route: DayRoute | null,
  departureTime?: string,
): {
  route: DayRoute | null;
  loading: boolean;
  source: RouteSource;
} {
  const [enriched, setEnriched] = useState<DayRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const routeRef = useRef(route);
  routeRef.current = route;

  const signature = useMemo(() => {
    if (!route || route.waypoints.length < 2) return null;
    const pts = route.waypoints
      .map(
        (point) =>
          `${point.spotId}:${point.coords.lat.toFixed(5)},${point.coords.lng.toFixed(5)}`,
      )
      .join("|");
    // Include departureTime so a change triggers a re-fetch.
    return departureTime ? `${pts}@${departureTime}` : pts;
  }, [route, departureTime]);

  useEffect(() => {
    setEnriched(null);
    if (!signature) {
      setLoading(false);
      return;
    }

    const baseline = routeRef.current;
    if (!baseline || baseline.waypoints.length < 2) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const response = await fetch("/api/route-etas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            points: baseline.waypoints.map((point) => point.coords),
            departureTime: departureTime ?? undefined,
          }),
        });
        if (!response.ok) return;
        const json = (await response.json()) as ApiOk | { available?: false };
        if (!json || !("available" in json) || !json.available) return;
        if (json.legs.length !== baseline.legs.length) return;
        if (cancelled) return;
        setEnriched({
          ...baseline,
          legs: baseline.legs.map((leg, index) => ({
            ...leg,
            km: json.legs[index].km,
            minutes: json.legs[index].minutes,
            minutesStatic: json.legs[index].minutesStatic,
            trafficAware: json.legs[index].trafficAware,
            source: "google",
          })),
          totalKm: json.totalKm,
          totalMinutes: json.totalMinutes,
          source: "google",
          encodedPolyline: json.encodedPolyline,
          encodedPolylines: json.encodedPolylines ?? (json.encodedPolyline ? [json.encodedPolyline] : []),
        });
      } catch {
        // Keep estimate.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signature, departureTime]);

  const effective = enriched ?? route;
  return {
    route: effective,
    loading,
    source: effective?.source ?? "estimate",
  };
}
