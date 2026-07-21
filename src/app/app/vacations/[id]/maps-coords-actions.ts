"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  enrichFromMapsUrl,
  extractCoordsFromMapsUrl,
  isAppMapPreviewUrl,
  isShortMapsUrl,
  isUsablePreviewImage,
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

function needsImageRefresh(spot: {
  image_url: string | null;
  image_manual: boolean | null;
}): boolean {
  if (spot.image_manual) return false;
  if (!spot.image_url) return true;
  if (!isUsablePreviewImage(spot.image_url)) return true;
  return isAppMapPreviewUrl(spot.image_url);
}

/** Re-parse Maps links: fix drifted pins and upgrade tile previews to Place photos. */
export async function healVacationSpotCoords(vacationId: string): Promise<{
  updated: number;
}> {
  try {
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
      .select("id, lat, lng, maps_url, image_url, image_manual")
      .eq("vacation_id", vacationId);

    let updated = 0;
    for (const spot of spots ?? []) {
      if (!spot.maps_url) continue;

      try {
        const refreshImage = needsImageRefresh(spot);
        const syncCoords = parseLatLngFromMapsUrl(spot.maps_url);
        const needsEnrich =
          refreshImage ||
          !syncCoords ||
          isShortMapsUrl(spot.maps_url);

        const enriched = needsEnrich
          ? await enrichFromMapsUrl(spot.maps_url)
          : { coords: syncCoords, imageUrl: null as string | null };

        const coords = enriched.coords;
        const patch: { lat?: number; lng?: number; image_url?: string } = {};

        if (coords && isValidLatLng(coords.lat, coords.lng)) {
          const previous = previousCoords(spot);
          if (!previous || haversineMeters(previous, coords) > driftMeters) {
            patch.lat = coords.lat;
            patch.lng = coords.lng;
          }
        }

        if (
          refreshImage &&
          enriched.imageUrl &&
          isUsablePreviewImage(enriched.imageUrl) &&
          !isAppMapPreviewUrl(enriched.imageUrl) &&
          enriched.imageUrl !== spot.image_url
        ) {
          patch.image_url = enriched.imageUrl;
        }

        if (Object.keys(patch).length === 0) continue;

        const { error } = await supabase
          .from("spots")
          .update(patch)
          .eq("id", spot.id);
        if (!error) updated += 1;
      } catch {
        // Skip individual spots that fail enrichment; never fail the page load.
      }
    }

    if (updated > 0) {
      revalidatePath(`/app/vacations/${vacationId}`);
    }
    return { updated };
  } catch {
    return { updated: 0 };
  }
}
