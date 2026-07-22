"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_MAP_CENTER } from "@/lib/geo";
import type { RouteWaypoint } from "@/lib/day-route";

function numberIcon(order: number, overnight: boolean) {
  const fill = overnight ? "#8b4d6b" : "#0f6e8c";
  const label = order > 99 ? "•" : String(order);
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="width:28px;height:28px;border-radius:999px;background:${fill};color:#fff;display:flex;align-items:center;justify-content:center;font:700 ${order > 9 ? 10 : 12}px system-ui,sans-serif;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25)">${label}</div>`,
  });
}

function FitBounds({ waypoints }: { waypoints: RouteWaypoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (waypoints.length === 0) return;
    if (waypoints.length === 1) {
      map.setView([waypoints[0].coords.lat, waypoints[0].coords.lng], 11);
      return;
    }
    const bounds = L.latLngBounds(
      waypoints.map((point) => [point.coords.lat, point.coords.lng] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [36, 36] });
  }, [map, waypoints]);
  return null;
}

export default function DayRouteMapLeaflet({
  waypoints,
  className = "h-56",
}: {
  waypoints: RouteWaypoint[];
  className?: string;
}) {
  const path = useMemo(
    () => waypoints.map((point) => [point.coords.lat, point.coords.lng] as [number, number]),
    [waypoints],
  );
  const center = path[0] ?? DEFAULT_MAP_CENTER;

  if (waypoints.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-[16px] bg-black/5 text-[13px] text-[var(--ink-soft)] ${className}`}
      >
        Keine Stops mit Koordinaten.
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-[16px] ${className}`}>
      <MapContainer
        center={center}
        zoom={8}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
        />
        <FitBounds waypoints={waypoints} />
        {path.length > 1 ? (
          <Polyline positions={path} pathOptions={{ color: "#0f6e8c", weight: 4, opacity: 0.85 }} />
        ) : null}
        {waypoints.map((point) => (
          <Marker
            key={point.occurrenceId ?? `${point.spotId}-${point.order}`}
            position={[point.coords.lat, point.coords.lng]}
            icon={numberIcon(point.order, point.role === "overnight")}
            title={
              point.dayLabel
                ? `${point.order}. ${point.name} · ${point.dayLabel}`
                : `${point.order}. ${point.name}`
            }
          />
        ))}
      </MapContainer>
    </div>
  );
}
