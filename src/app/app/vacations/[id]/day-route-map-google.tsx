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
  await Promise.all([importLibrary("maps"), importLibrary("geometry")]);
}

function numberMarkerIcon(order: number, overnight: boolean): string {
  const fill = overnight ? "#8b4d6b" : "#0f6e8c";
  const label = order > 99 ? "•" : String(order);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 24 16 24s16-12 16-24C32 7.2 24.8 0 16 0z" fill="${fill}"/>
      <circle cx="16" cy="16" r="10" fill="#ffffff"/>
      <text x="16" y="20" text-anchor="middle" font-size="${order > 9 ? 10 : 12}" font-weight="700" fill="${fill}" font-family="system-ui,sans-serif">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default function DayRouteMapGoogle({
  waypoints,
  encodedPolylines = [],
  active = true,
  className = "h-56",
}: {
  waypoints: RouteWaypoint[];
  encodedPolylines?: string[];
  active?: boolean;
  className?: string;
}) {
  const apiKey = getBrowserGoogleMapsKey();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const linesRef = useRef<google.maps.Polyline[]>([]);
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
        for (const line of linesRef.current) line.setMap(null);
        linesRef.current = [];

        if (encodedPolylines.length > 0 && google.maps.geometry?.encoding?.decodePath) {
          for (const encoded of encodedPolylines) {
            linesRef.current.push(
              new google.maps.Polyline({
                path: google.maps.geometry.encoding.decodePath(encoded),
                geodesic: false,
                strokeColor: "#0f6e8c",
                strokeOpacity: 0.85,
                strokeWeight: 4,
                map,
              }),
            );
          }
        } else {
          linesRef.current.push(
            new google.maps.Polyline({
              path: waypoints.map((point) => point.coords),
              geodesic: true,
              strokeColor: "#0f6e8c",
              strokeOpacity: 0.85,
              strokeWeight: 4,
              map,
            }),
          );
        }

        const bounds = new google.maps.LatLngBounds();
        for (const point of waypoints) {
          bounds.extend(point.coords);
          const title = point.dayLabel
            ? `${point.order}. ${point.name} · ${point.dayLabel}`
            : `${point.order}. ${point.name}`;
          const marker = new google.maps.Marker({
            map,
            position: point.coords,
            title,
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
  }, [apiKey, waypoints, encodedPolylines]);

  useEffect(() => {
    if (!active || !mapRef.current) return;
    google.maps.event.trigger(mapRef.current, "resize");
  }, [active]);

  if (!apiKey) {
    return (
      <div
        className={`flex items-center justify-center rounded-[16px] bg-black/5 text-[13px] text-[var(--ink-soft)] ${className}`}
      >
        Google-Maps-Key fehlt — Leaflet-Fallback folgt unten.
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-[16px] ${className}`}>
      <div ref={containerRef} className="h-full w-full" />
      {error ? (
        <p className="absolute inset-x-0 bottom-2 px-3 text-center text-[12px] text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
