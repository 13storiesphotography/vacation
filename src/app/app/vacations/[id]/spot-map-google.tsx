"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { categoryIconMarkup } from "@/components/category-icon";
import { categoryLabels, categoryTone, type SpotCategory } from "@/lib/spots";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/geo";
import { getBrowserGoogleMapsKey, type MappableSpot } from "@/lib/google-maps";
import type { SpotRatingSummary } from "@/lib/ratings";

function ratingLabel(summary: SpotRatingSummary | undefined): string {
  if (!summary || summary.average == null) return "noch keine Bewertung";
  const fav = summary.favoriteCount
    ? ` · ${summary.favoriteCount}× Favorit`
    : "";
  return `${summary.average}★ (${summary.count})${fav}`;
}

function markerIconSvg(category: SpotCategory, selected: boolean): string {
  const color = categoryTone[category];
  const size = selected ? 36 : 30;
  const iconSize = selected ? 18 : 15;
  const offset = (size - iconSize) / 2;
  const scale = iconSize / 20;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="${color}" stroke="#ffffff" stroke-width="${selected ? 3 : 2}"/>
      <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        ${categoryIconMarkup[category]}
      </g>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

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

function isDocumentFullscreen(): boolean {
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
  };
  return Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
}

export default function SpotMapGoogle({
  spots,
  summaries,
  selectedId,
  onSelect,
  expanded = false,
  active = true,
}: {
  spots: MappableSpot[];
  summaries: Record<string, SpotRatingSummary>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** When true (enlarged overlay), allow one-finger pan. */
  expanded?: boolean;
  /** False while the map tab is hidden — resize when shown again. */
  active?: boolean;
}) {
  const apiKey = getBrowserGoogleMapsKey();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!apiKey || !containerRef.current) return;
    let cancelled = false;
    let fullscreenListener: google.maps.MapsEventListener | null = null;

    void (async () => {
      try {
        await ensureMapsApi(apiKey);
        if (cancelled || !containerRef.current) return;

        const map = new google.maps.Map(containerRef.current, {
          center: {
            lat: DEFAULT_MAP_CENTER[0],
            lng: DEFAULT_MAP_CENTER[1],
          },
          zoom: DEFAULT_MAP_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          // Cooperative: one finger scrolls the page; two fingers pan the map.
          gestureHandling: "cooperative",
        });
        map.addListener("click", () => onSelectRef.current(null));
        fullscreenListener = map.addListener("fullscreen_changed", () => {
          setNativeFullscreen(isDocumentFullscreen());
        });
        mapRef.current = map;
        setReady(true);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Google Maps konnte nicht geladen werden.");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (fullscreenListener) fullscreenListener.remove();
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      mapRef.current = null;
    };
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setOptions({
      gestureHandling: expanded || nativeFullscreen ? "greedy" : "cooperative",
    });
    // Recalculate layout after expand/collapse or returning to the map tab.
    if (!active) return;
    window.setTimeout(() => {
      google.maps.event.trigger(map, "resize");
    }, 50);
  }, [expanded, nativeFullscreen, ready, active]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (spots.length === 0) {
      map.setCenter({
        lat: DEFAULT_MAP_CENTER[0],
        lng: DEFAULT_MAP_CENTER[1],
      });
      map.setZoom(DEFAULT_MAP_ZOOM);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    for (const spot of spots) {
      const category = spot.category as SpotCategory;
      const selected = selectedId === spot.id;
      const size = selected ? 36 : 30;
      const position = { lat: spot.coords.lat, lng: spot.coords.lng };
      bounds.extend(position);

      const marker = new google.maps.Marker({
        map,
        position,
        title: spot.name,
        zIndex: selected ? 1000 : 1,
        icon: {
          url: markerIconSvg(category, selected),
          scaledSize: new google.maps.Size(size, size),
          anchor: new google.maps.Point(size / 2, size / 2),
        },
      });

      marker.addListener("click", () => {
        onSelectRef.current(spot.id);
        const summary = summaries[spot.id];
        const info = new google.maps.InfoWindow({
          content: `
            <div style="min-width:160px;font:13px/1.35 system-ui,sans-serif">
              <div style="font-weight:600;color:#0F6E8C">${escapeHtml(spot.name)}</div>
              <div style="margin-top:2px;font-size:12px;color:#5b6b73">
                ${escapeHtml(categoryLabels[category])}${
                  spot.overnight_cost
                    ? ` · ${escapeHtml(spot.overnight_cost)}`
                    : ""
                }
              </div>
              <div style="margin-top:4px;font-size:12px;color:#5b6b73">
                ${escapeHtml(ratingLabel(summary))}${
                  summary?.myFavorite ? " · dein Favorit" : ""
                }
              </div>
            </div>
          `,
        });
        info.open({ map, anchor: marker });
      });

      markersRef.current.push(marker);
    }

    if (spots.length === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(12);
    } else {
      map.fitBounds(bounds, 64);
    }
  }, [ready, spots, selectedId, summaries]);

  if (!apiKey) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-[18px] media-fallback px-6 text-center text-white">
        <p className="text-[15px] font-semibold">Google Maps Key fehlt</p>
        <p className="max-w-sm text-[13px] text-white/90">
          In Vercel/Env{" "}
          <code className="rounded bg-black/20 px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
          setzen (Maps JavaScript API, HTTP-Referrer einschränken).
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-[18px] media-fallback px-6 text-center text-[14px] font-semibold text-white">
        {error}
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full rounded-[18px]" />;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
