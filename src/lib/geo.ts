export type LatLng = { lat: number; lng: number };

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

function pair(lat: number, lng: number): LatLng | null {
  return isValidLatLng(lat, lng) ? { lat, lng } : null;
}

/** Extract lat/lng from common Google Maps URL shapes. */
export function parseLatLngFromMapsUrl(
  url: string | null | undefined,
): LatLng | null {
  if (!url) return null;
  try {
    const decoded = decodeURIComponent(url.trim());

    const atMatch = decoded.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (atMatch) {
      const found = pair(Number(atMatch[1]), Number(atMatch[2]));
      if (found) return found;
    }

    const bangMatch = decoded.match(
      /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    );
    if (bangMatch) {
      const found = pair(Number(bangMatch[1]), Number(bangMatch[2]));
      if (found) return found;
    }

    const searchPath = decoded.match(
      /\/(?:maps\/)?search\/\s*(-?\d+(?:\.\d+)?)[,\s+]+(-?\d+(?:\.\d+)?)/i,
    );
    if (searchPath) {
      const found = pair(Number(searchPath[1]), Number(searchPath[2]));
      if (found) return found;
    }

    const qMatch = decoded.match(
      /[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
    );
    if (qMatch) {
      const found = pair(Number(qMatch[1]), Number(qMatch[2]));
      if (found) return found;
    }

    const destEncoded = decoded.match(
      /destination=(-?\d+(?:\.\d+))%2C(-?\d+(?:\.\d+))/i,
    );
    if (destEncoded) {
      const found = pair(Number(destEncoded[1]), Number(destEncoded[2]));
      if (found) return found;
    }

    const destPlain = decoded.match(
      /destination=(-?\d+(?:\.\d+)),(-?\d+(?:\.\d+))/i,
    );
    if (destPlain) {
      const found = pair(Number(destPlain[1]), Number(destPlain[2]));
      if (found) return found;
    }

    // Fallback: first plausible coordinate pair in the URL
    const loose = decoded.match(
      /(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/,
    );
    if (loose) {
      const found = pair(Number(loose[1]), Number(loose[2]));
      if (found) return found;
    }
  } catch {
    return null;
  }
  return null;
}

export function isShortMapsUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "maps.app.goo.gl" ||
      host === "goo.gl" ||
      host === "g.co" ||
      host.endsWith(".app.goo.gl")
    );
  } catch {
    return false;
  }
}

/** Follow redirects for short Google Maps share links. */
export async function expandMapsUrl(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!trimmed || !isShortMapsUrl(trimmed)) return trimmed;

  try {
    const response = await fetch(trimmed, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; VacationPlaner/1.0; +https://vacation-bice.vercel.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.url && response.url !== trimmed) {
      return response.url;
    }

    const html = await response.text();
    const canonical = html.match(
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    );
    if (canonical?.[1]) return canonical[1];

    const og = html.match(
      /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i,
    );
    if (og?.[1]) return og[1];

    const refresh = html.match(
      /content=["']\d+;\s*url=([^"']+)["']/i,
    );
    if (refresh?.[1]) return refresh[1];
  } catch {
    // Keep original URL; parser may still succeed for full links.
  }

  return trimmed;
}

export async function extractCoordsFromMapsUrl(
  url: string | null | undefined,
): Promise<{ coords: LatLng | null; resolvedUrl: string | null }> {
  if (!url?.trim()) return { coords: null, resolvedUrl: null };
  const resolvedUrl = await expandMapsUrl(url.trim());
  const fromResolved = parseLatLngFromMapsUrl(resolvedUrl);
  if (fromResolved) return { coords: fromResolved, resolvedUrl };
  const fromOriginal = parseLatLngFromMapsUrl(url);
  return { coords: fromOriginal, resolvedUrl };
}

export function resolveSpotCoords(spot: {
  lat: number | null;
  lng: number | null;
  maps_url: string | null;
}): LatLng | null {
  if (
    typeof spot.lat === "number" &&
    typeof spot.lng === "number" &&
    isValidLatLng(spot.lat, spot.lng)
  ) {
    return { lat: spot.lat, lng: spot.lng };
  }
  return parseLatLngFromMapsUrl(spot.maps_url);
}

/** Sweden-ish default for van-trip vacations without coords yet. */
export const DEFAULT_MAP_CENTER: [number, number] = [62.0, 15.0];
export const DEFAULT_MAP_ZOOM = 5;
