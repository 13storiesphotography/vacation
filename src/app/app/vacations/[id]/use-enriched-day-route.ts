"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DayRoute, RouteSource } from "@/lib/day-route";

type ApiOk = {
  available: true;
  source: "google";
  legs: Array<{ km: number; minutes: number }>;
  totalKm: number;
  totalMinutes: number;
  encodedPolyline: string | null;
};

/**
 * Enrich a local day-route estimate with Google Routes when available.
 * Keeps the estimate visible until/unless Google responds.
 */
export function useEnrichedDayRoute(route: DayRoute | null): {
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
    return route.waypoints
      .map(
        (point) =>
          `${point.spotId}:${point.coords.lat.toFixed(5)},${point.coords.lng.toFixed(5)}`,
      )
      .join("|");
  }, [route]);

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
            source: "google",
          })),
          totalKm: json.totalKm,
          totalMinutes: json.totalMinutes,
          source: "google",
          encodedPolyline: json.encodedPolyline,
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
  }, [signature]);

  const effective = enriched ?? route;
  return {
    route: effective,
    loading,
    source: effective?.source ?? "estimate",
  };
}
