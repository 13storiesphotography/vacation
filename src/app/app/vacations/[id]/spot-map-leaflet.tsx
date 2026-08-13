"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { resolveCategoryIcon, resolveCategoryLabel, type VacationSpotCategory } from "@/lib/spots";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/geo";
import type { SpotRatingSummary } from "@/lib/ratings";
import type { MappableSpot } from "@/lib/google-maps";
import {
  categoryIconSvg,
  categoryIconTone,
  resolveCategoryIconKey,
} from "@/components/category-icon";
import { LeafletGestureMode } from "./map-gestures";

const iconCache = new Map<string, L.DivIcon>();

function categoryMapIcon(iconOrCategory: string, selected: boolean): L.DivIcon {
  const icon = resolveCategoryIconKey(iconOrCategory);
  const key = `${icon}:${selected ? "1" : "0"}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const color = categoryIconTone[icon];
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
      ${categoryIconSvg(icon, { size: iconSize, stroke: "#ffffff", strokeWidth: 1.8 })}
    </div>
  `;

  const marker = L.divIcon({
    className: "spot-category-marker",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 + 2],
  });
  iconCache.set(key, marker);
  return marker;
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
  categories,
  selectedId,
  onSelect,
  onEditRequest,
  expanded = false,
  active = true,
}: {
  spots: MappableSpot[];
  summaries: Record<string, SpotRatingSummary>;
  categories?: VacationSpotCategory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onEditRequest?: (id: string) => void;
  expanded?: boolean;
  active?: boolean;
}) {
  const markers = useMemo(
    () =>
      spots.map((spot) => {
        const iconKey = resolveCategoryIcon(categories, spot.category);
        const selected = selectedId === spot.id;
        return {
          spot,
          selected,
          icon: categoryMapIcon(iconKey, selected),
          label: resolveCategoryLabel(categories, spot.category),
          summary: summaries[spot.id],
        };
      }),
    [categories, selectedId, spots, summaries],
  );

  return (
    <MapContainer
      center={DEFAULT_MAP_CENTER}
      zoom={DEFAULT_MAP_ZOOM}
      className="h-full w-full rounded-[18px]"
      scrollWheelZoom
      dragging
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LeafletGestureMode
        mode={expanded ? "greedy" : "cooperative"}
        active={active}
      />
      <FitBounds spots={spots} />
      {markers.map(({ spot, selected, icon, summary, label }) => (
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
                {label}
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
              {onEditRequest ? (
                <button
                  type="button"
                  className="mt-2 w-full rounded-[10px] bg-[rgba(20,36,48,0.88)] px-3 py-2 text-[12px] font-semibold text-white"
                  onClick={() => onEditRequest(spot.id)}
                >
                  Bearbeiten
                </button>
              ) : null}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
