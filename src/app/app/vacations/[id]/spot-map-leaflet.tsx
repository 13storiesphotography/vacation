"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { categoryLabels, categoryTone, type SpotCategory } from "@/lib/spots";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/geo";
import type { SpotRatingSummary } from "@/lib/ratings";
import type { MappableSpot } from "@/lib/google-maps";
import { categoryIconSvg } from "@/components/category-icon";

const iconCache = new Map<string, L.DivIcon>();

function categoryMapIcon(category: SpotCategory, selected: boolean): L.DivIcon {
  const key = `${category}:${selected ? "1" : "0"}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const color = categoryTone[category];
  const size = selected ? 36 : 30;
  const iconSize = selected ? 18 : 15;
  const html = `
    <div style="
      width:${size}px;
      height:${size}px;
      border-radius:999px;
      background:${color};
      border:${selected ? 3 : 2}px solid #fff;
      box-shadow:0 4px 14px rgba(17,24,39,0.22);
      display:flex;
      align-items:center;
      justify-content:center;
    ">
      ${categoryIconSvg(category, { size: iconSize, stroke: "#ffffff", strokeWidth: 1.8 })}
    </div>
  `;

  const icon = L.divIcon({
    className: "spot-category-marker",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 + 2],
  });
  iconCache.set(key, icon);
  return icon;
}

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

/** OSM fallback when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set. */
export default function SpotMapLeaflet({
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
  const markers = useMemo(
    () =>
      spots.map((spot) => {
        const category = spot.category as SpotCategory;
        const selected = selectedId === spot.id;
        return {
          spot,
          selected,
          icon: categoryMapIcon(category, selected),
          summary: summaries[spot.id],
        };
      }),
    [selectedId, spots, summaries],
  );

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
      {markers.map(({ spot, selected, icon, summary }) => (
        <Marker
          key={spot.id}
          position={[spot.coords.lat, spot.coords.lng]}
          icon={icon}
          zIndexOffset={selected ? 1000 : 0}
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
        </Marker>
      ))}
    </MapContainer>
  );
}
