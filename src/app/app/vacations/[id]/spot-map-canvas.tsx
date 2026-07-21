"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { categoryLabels, categoryTone, type SpotCategory } from "@/lib/spots";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/geo";
import type { SpotRatingSummary } from "@/lib/ratings";
import type { Database } from "@/lib/database.types";

type Spot = Database["public"]["Tables"]["spots"]["Row"];

export type MappableSpot = Spot & {
  coords: { lat: number; lng: number };
};

function FitBounds({ spots }: { spots: MappableSpot[] }) {
  const map = useMap();

  useEffect(() => {
    if (spots.length === 0) {
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
      return;
    }
    if (spots.length === 1) {
      map.setView([spots[0].coords.lat, spots[0].coords.lng], 10);
      return;
    }
    const bounds = L.latLngBounds(
      spots.map((spot) => [spot.coords.lat, spot.coords.lng] as [number, number]),
    );
    map.fitBounds(bounds.pad(0.18));
  }, [map, spots]);

  return null;
}

function ratingLabel(summary: SpotRatingSummary | undefined): string {
  if (!summary || summary.average == null) return "noch keine Bewertung";
  const fav = summary.favoriteCount
    ? ` · ${summary.favoriteCount}× Favorit`
    : "";
  return `${summary.average}★ (${summary.count})${fav}`;
}

export default function SpotMapCanvas({
  spots,
  summaries,
  selectedId,
  onSelect,
}: {
  spots: MappableSpot[];
  summaries: Record<string, SpotRatingSummary>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <MapContainer
      center={DEFAULT_MAP_CENTER}
      zoom={DEFAULT_MAP_ZOOM}
      className="h-full w-full rounded-[18px]"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds spots={spots} />
      {spots.map((spot) => {
        const selected = selectedId === spot.id;
        const summary = summaries[spot.id];
        const color = categoryTone[spot.category as SpotCategory];
        return (
          <CircleMarker
            key={spot.id}
            center={[spot.coords.lat, spot.coords.lng]}
            radius={selected ? 11 : 8}
            pathOptions={{
              color: "#fff",
              weight: selected ? 3 : 2,
              fillColor: color,
              fillOpacity: 0.95,
            }}
            eventHandlers={{
              click: () => onSelect(spot.id),
            }}
          >
            <Popup>
              <div className="min-w-[160px] text-[13px]">
                {spot.maps_url ? (
                  <a
                    href={spot.maps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[var(--fjord)]"
                  >
                    {spot.name}
                  </a>
                ) : (
                  <p className="font-semibold text-[var(--ink)]">{spot.name}</p>
                )}
                <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
                  {categoryLabels[spot.category as SpotCategory]}
                  {spot.overnight_cost ? ` · ${spot.overnight_cost}` : ""}
                  {spot.info_url && (
                    <>
                      {" · "}
                      <a
                        href={spot.info_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-[var(--fjord)]"
                      >
                        Info
                      </a>
                    </>
                  )}
                </p>
                <p className="mt-1 text-[12px] text-[var(--ink-soft)]">
                  {ratingLabel(summary)}
                  {summary?.myFavorite ? " · dein Favorit" : ""}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
