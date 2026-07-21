"use server";

import { extractCoordsFromMapsUrl } from "@/lib/geo";

export type MapsCoordsPreview = {
  ok: boolean;
  lat?: number;
  lng?: number;
  message: string;
};

export async function previewMapsCoords(url: string): Promise<MapsCoordsPreview> {
  const trimmed = url.trim();
  if (!trimmed) {
    return { ok: false, message: "Maps-Link einfügen, Position kommt automatisch." };
  }

  const { coords } = await extractCoordsFromMapsUrl(trimmed);
  if (!coords) {
    return {
      ok: false,
      message:
        "Keine Position im Link gefunden. In Google Maps den Ort öffnen und „Link teilen“ kopieren.",
    };
  }

  return {
    ok: true,
    lat: coords.lat,
    lng: coords.lng,
    message: `Position erkannt: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
  };
}
