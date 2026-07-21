"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  enrichFromMapsUrl,
  extractCoordsFromMapsUrl,
  isShortMapsUrl,
  isValidLatLng,
  parseLatLngFromMapsUrl,
} from "@/lib/geo";

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

const driftMeters = 40;

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function previousCoords(spot: {
  lat: number | null;
  lng: number | null;
}): { lat: number; lng: number } | null {
  if (
    typeof spot.lat === "number" &&
    typeof spot.lng === "number" &&
    isValidLatLng(spot.lat, spot.lng)
  ) {
    return { lat: spot.lat, lng: spot.lng };
  }
  return null;
}

/** Re-parse Maps links and correct stored lat/lng when the pin drifted (e.g. camera @ vs place !3d). */
export async function healVacationSpotCoords(vacationId: string): Promise<{
  updated: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { updated: 0 };

  const { data: isMember } = await supabase.rpc("is_vacation_member", {
    p_vacation_id: vacationId,
  });
  if (!isMember) return { updated: 0 };

  const { data: spots } = await supabase
    .from("spots")
    .select("id, lat, lng, maps_url")
    .eq("vacation_id", vacationId);

  let updated = 0;
  for (const spot of spots ?? []) {
    if (!spot.maps_url) continue;

    let coords = parseLatLngFromMapsUrl(spot.maps_url);
    // Short links need expansion to reveal the place pin.
    if (!coords || isShortMapsUrl(spot.maps_url)) {
      const enriched = await enrichFromMapsUrl(spot.maps_url);
      coords = enriched.coords;
    }
    if (!coords || !isValidLatLng(coords.lat, coords.lng)) continue;

    const previous = previousCoords(spot);
    const needsUpdate =
      !previous || haversineMeters(previous, coords) > driftMeters;
    if (!needsUpdate) continue;

    const { error } = await supabase
      .from("spots")
      .update({ lat: coords.lat, lng: coords.lng })
      .eq("id", spot.id);
    if (!error) updated += 1;
  }

  if (updated > 0) {
    revalidatePath(`/app/vacations/${vacationId}`);
  }
  return { updated };
}
