"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { DEFAULT_MAP_CENTER } from "@/lib/geo";
import { getBrowserGoogleMapsKey } from "@/lib/google-maps";
import type { RouteWaypoint } from "@/lib/day-route";

let mapsOptionsReady = false;

async function ensureMapsApi(apiKey: string) {
  if (!mapsOptionsReady) {
    setOptions({
      key: apiKey,
      v: "weekly",
      language: "de",
      region: "SE",
    });
    mapsOptionsReady = true;
  }
  await importLibrary("maps");
}

function numberMarkerIcon(order: number, overnight: boolean): string {
  const fill = overnight ? "#8b4d6b" : "#0f6e8c";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 24 16 24s16-12 16-24C32 7.2 24.8 0 16 0z" fill="${fill}"/>
      <circle cx="16" cy="16" r="10" fill="#ffffff"/>
      <text x="16" y="20" text-anchor="middle" font-size="12" font-weight="700" fill="${fill}" font-family="system-ui,sans-serif">${order}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default function DayRouteMapGoogle({
  waypoints,
  active = true,
}: {
  waypoints: RouteWaypoint[];
  active?: boolean;
}) {
  const apiKey = getBrowserGoogleMapsKey();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const lineRef = useRef<google.maps.Polyline | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey || !containerRef.current || waypoints.length === 0) return;
    let cancelled = false;

    void (async () => {
      try {
        await ensureMapsApi(apiKey);
        if (cancelled || !containerRef.current) return;

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(containerRef.current, {
            center: {
              lat: waypoints[0]?.coords.lat ?? DEFAULT_MAP_CENTER[0],
              lng: waypoints[0]?.coords.lng ?? DEFAULT_MAP_CENTER[1],
            },
            zoom: 8,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: "greedy",
          });
        }

        const map = mapRef.current;
        for (const marker of markersRef.current) marker.setMap(null);
        markersRef.current = [];
        lineRef.current?.setMap(null);

        const path = waypoints.map((point) => point.coords);
        lineRef.current = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: "#0f6e8c",
          strokeOpacity: 0.85,
          strokeWeight: 4,
          map,
        });

        const bounds = new google.maps.LatLngBounds();
        for (const point of waypoints) {
          bounds.extend(point.coords);
          const marker = new google.maps.Marker({
            map,
            position: point.coords,
            title: `${point.order}. ${point.name}`,
            icon: {
              url: numberMarkerIcon(point.order, point.role === "overnight"),
              scaledSize: new google.maps.Size(32, 40),
              anchor: new google.maps.Point(16, 40),
            },
          });
          markersRef.current.push(marker);
        }
        if (waypoints.length === 1) {
          map.setCenter(waypoints[0].coords);
          map.setZoom(11);
        } else {
          map.fitBounds(bounds, 48);
        }
        setError(null);
      } catch (err) {
        console.error("[day-route-map]", err);
        setError("Karte konnte nicht geladen werden.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiKey, waypoints]);

  useEffect(() => {
    if (!active || !mapRef.current) return;
    google.maps.event.trigger(mapRef.current, "resize");
  }, [active]);

  if (!apiKey) {
    return (
      <div className="flex h-56 items-center justify-center rounded-[16px] bg-black/5 text-[13px] text-[var(--ink-soft)]">
        Google-Maps-Key fehlt — Leaflet-Fallback folgt unten.
      </div>
    );
  }

  return (
    <div className="relative h-56 overflow-hidden rounded-[16px]">
      <div ref={containerRef} className="h-full w-full" />
      {error ? (
        <p className="absolute inset-x-0 bottom-2 px-3 text-center text-[12px] text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
