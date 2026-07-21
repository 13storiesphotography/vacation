/** Extract lat/lng from common Google Maps URL shapes. */
export function parseLatLngFromMapsUrl(
  url: string | null | undefined,
): { lat: number; lng: number } | null {
  if (!url) return null;
  try {
    const decoded = decodeURIComponent(url.trim());

    const atMatch = decoded.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (atMatch) {
      const lat = Number(atMatch[1]);
      const lng = Number(atMatch[2]);
      if (isValidLatLng(lat, lng)) return { lat, lng };
    }

    const qMatch = decoded.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
    if (qMatch) {
      const lat = Number(qMatch[1]);
      const lng = Number(qMatch[2]);
      if (isValidLatLng(lat, lng)) return { lat, lng };
    }

    const placeMatch = decoded.match(
      /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    );
    if (placeMatch) {
      const lat = Number(placeMatch[1]);
      const lng = Number(placeMatch[2]);
      if (isValidLatLng(lat, lng)) return { lat, lng };
    }

    const destEncoded = decoded.match(
      /destination=(-?\d+(?:\.\d+))%2C(-?\d+(?:\.\d+))/i,
    );
    if (destEncoded) {
      const lat = Number(destEncoded[1]);
      const lng = Number(destEncoded[2]);
      if (isValidLatLng(lat, lng)) return { lat, lng };
    }

    const destPlain = decoded.match(
      /destination=(-?\d+(?:\.\d+)),(-?\d+(?:\.\d+))/i,
    );
    if (destPlain) {
      const lat = Number(destPlain[1]);
      const lng = Number(destPlain[2]);
      if (isValidLatLng(lat, lng)) return { lat, lng };
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveSpotCoords(spot: {
  lat: number | null;
  lng: number | null;
  maps_url: string | null;
}): { lat: number; lng: number } | null {
  if (
    typeof spot.lat === "number" &&
    typeof spot.lng === "number" &&
    isValidLatLng(spot.lat, spot.lng)
  ) {
    return { lat: spot.lat, lng: spot.lng };
  }
  return parseLatLngFromMapsUrl(spot.maps_url);
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Sweden-ish default for van-trip vacations without coords yet. */
export const DEFAULT_MAP_CENTER: [number, number] = [62.0, 15.0];
export const DEFAULT_MAP_ZOOM = 5;
