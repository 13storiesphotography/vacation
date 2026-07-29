import {
  fetchGooglePlacePhoto,
  parsePlaceNameFromMapsUrl,
} from "@/lib/places-photo";

export type LatLng = { lat: number; lng: number };

export type MapsEnrichment = {
  resolvedUrl: string | null;
  coords: LatLng | null;
  imageUrl: string | null;
  title: string | null;
};

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

/** Place-pin patterns only — safe to run against Maps page HTML. */
function parsePlacePinCoords(text: string): LatLng | null {
  const placePin = text.match(
    /!8m2!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  );
  if (placePin) {
    const found = pair(Number(placePin[1]), Number(placePin[2]));
    if (found) return found;
  }
  const bangAll = [
    ...text.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g),
  ];
  if (bangAll.length > 0) {
    const last = bangAll[bangAll.length - 1];
    return pair(Number(last[1]), Number(last[2]));
  }
  return null;
}

/** Extract lat/lng from common Google Maps URL shapes.
 * Prefer place-pin coords (!3d/!4d) over camera viewport (@lat,lng).
 */
export function parseLatLngFromMapsUrl(
  url: string | null | undefined,
): LatLng | null {
  if (!url) return null;
  try {
    const decoded = decodeURIComponent(url.trim());

    const place = parsePlacePinCoords(decoded);
    if (place) return place;

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

    // Viewport/camera — often offset from the actual place pin
    const atMatch = decoded.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (atMatch) {
      const found = pair(Number(atMatch[1]), Number(atMatch[2]));
      if (found) return found;
    }

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

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, num: string) =>
      String.fromCodePoint(Number.parseInt(num, 10)),
    );
}

function normalizeImageUrl(raw: string): string | null {
  let value = decodeHtmlEntities(raw.trim());
  if (!value) return null;
  if (value.startsWith("//")) value = `https:${value}`;
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    // Validate URL shape
    new URL(value);
    return value;
  } catch {
    return null;
  }
}

/** Google's own signed Static Map og:images 403 outside Google. */
export function isUsablePreviewImage(url: string | null | undefined): boolean {
  if (!url) return false;
  const withoutFocus = url.replace(/#.*$/, "");
  const normalized =
    normalizeImageUrl(withoutFocus) ??
    (withoutFocus.startsWith("/api/map-preview?") ? withoutFocus : null);
  if (!normalized) return false;
  if (normalized.startsWith("/api/map-preview?")) return true;
  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (path.includes("/maps/about/images/icons/")) return false;
    if (path.includes("/maps/api/staticmap")) return false;
    if (path.includes("/maps/api/streetview")) return false;
    if (host.includes("gstatic.com") && path.includes("/mapfiles/")) return false;
    if (host === "maps.google.com" && parsed.searchParams.has("signature")) {
      return false;
    }
    if (host.includes("wikimedia.org") && path.includes("/img/")) return false;
    return true;
  } catch {
    return false;
  }
}

function parseOgImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const url = normalizeImageUrl(match[1]);
    if (url && isUsablePreviewImage(url)) return url;
  }
  return null;
}

function parsePlacePhotoCandidate(html: string): string | null {
  const patterns = [
    /https:\/\/lh3\.googleusercontent\.com\/[^"'\\\s<>]+/gi,
    /https:\/\/streetviewpixels-pa\.googleapis\.com\/v1\/thumbnail\?[^"'\\\s<>]+/gi,
  ];
  for (const pattern of patterns) {
    const matches = html.match(pattern) ?? [];
    for (const candidate of matches) {
      const cleaned = candidate.replace(/[),;]+$/, "");
      if (cleaned.includes("${")) continue;
      const url = normalizeImageUrl(cleaned);
      if (url && isUsablePreviewImage(url)) return url;
    }
  }
  return null;
}

async function fetchMapsPage(url: string): Promise<{
  finalUrl: string;
  html: string | null;
}> {
  try {
    // Short links often need an explicit 302 hop; fetch(redirect:follow) can stall on goo.gl.
    if (isShortMapsUrl(url)) {
      const head = await fetch(url, {
        method: "GET",
        redirect: "manual",
        headers: browserHeaders(),
        signal: AbortSignal.timeout(10000),
      });
      const location = head.headers.get("location");
      if (location) {
        const absolute = new URL(location, url).toString();
        return fetchMapsPage(absolute);
      }
    }

    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: browserHeaders(),
      signal: AbortSignal.timeout(12000),
    });
    const html = await response.text();
    return {
      finalUrl: response.url || url,
      html,
    };
  } catch {
    return { finalUrl: url, html: null };
  }
}

function browserHeaders(): HeadersInit {
  return {
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
  };
}

/** App-hosted map snapshot from coordinates (works as <img src>). */
export function appMapPreviewUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  });
  return `/api/map-preview?${params.toString()}`;
}

/** Coord fallback always points at our API (never stores Google keys in DB/HTML). */
export function previewImageFromCoords(lat: number, lng: number): string {
  return appMapPreviewUrl(lat, lng);
}

/** App-hosted map snapshot (tile fallback), not a real place photo. */
export function isAppMapPreviewUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const base = url.replace(/#.*$/, "");
  return base.startsWith("/api/map-preview?");
}

function parseOgTitle(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    /<title[^>]*>([^<]+)<\/title>/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const title = decodeHtmlEntities(match[1]).trim();
    if (!title) continue;
    return title
      .replace(/\s*[-–|]\s*Google\s*Maps\s*$/i, "")
      .replace(/\s*-\s*Maps\s*$/i, "")
      .trim();
  }
  return null;
}

/** Resolve coords + preview image from a Google Maps share/place URL. */
export async function enrichFromMapsUrl(
  url: string | null | undefined,
): Promise<MapsEnrichment> {
  if (!url?.trim()) {
    return { resolvedUrl: null, coords: null, imageUrl: null, title: null };
  }

  const original = url.trim();
  let resolvedUrl = original;
  let imageUrl: string | null = null;
  let title: string | null = null;

  const page = await fetchMapsPage(original);
  resolvedUrl = page.finalUrl || original;
  if (page.html) {
    imageUrl =
      parsePlacePhotoCandidate(page.html) ?? parseOgImage(page.html) ?? null;
    title = parseOgTitle(page.html);
  }

  const coords =
    parseLatLngFromMapsUrl(resolvedUrl) ??
    (page.html ? parsePlacePinCoords(page.html) : null) ??
    parseLatLngFromMapsUrl(original);

  const placeName =
    parsePlaceNameFromMapsUrl(resolvedUrl) ??
    parsePlaceNameFromMapsUrl(original);
  if (placeName) {
    title = title || placeName;
  }

  // Google no longer embeds place hero photos in Maps HTML — use Places API.
  if (!imageUrl || isAppMapPreviewUrl(imageUrl) || !isUsablePreviewImage(imageUrl)) {
    const placePhoto = await fetchGooglePlacePhoto({
      query: placeName,
      coords,
      mapsUrl: resolvedUrl || original,
    });
    if (placePhoto && isUsablePreviewImage(placePhoto)) {
      imageUrl = placePhoto;
    }
  }

  if (!imageUrl && coords) {
    imageUrl = previewImageFromCoords(coords.lat, coords.lng);
  }

  if (imageUrl && !isUsablePreviewImage(imageUrl) && coords) {
    imageUrl = previewImageFromCoords(coords.lat, coords.lng);
  }

  return { resolvedUrl, coords, imageUrl, title };
}

export async function extractCoordsFromMapsUrl(
  url: string | null | undefined,
): Promise<{ coords: LatLng | null; resolvedUrl: string | null }> {
  const enriched = await enrichFromMapsUrl(url);
  return { coords: enriched.coords, resolvedUrl: enriched.resolvedUrl };
}

/** Follow redirects for short Google Maps share links. */
export async function expandMapsUrl(url: string): Promise<string> {
  const enriched = await enrichFromMapsUrl(url);
  return enriched.resolvedUrl ?? url.trim();
}

export function resolveSpotCoords(spot: {
  lat: number | null;
  lng: number | null;
  maps_url: string | null;
}): LatLng | null {
  // Prefer coords embedded in the Maps URL (place pin) over stored lat/lng,
  // which may have been saved from the camera @lat,lng viewport.
  const fromUrl = parseLatLngFromMapsUrl(spot.maps_url);
  if (fromUrl) return fromUrl;

  if (
    typeof spot.lat === "number" &&
    typeof spot.lng === "number" &&
    isValidLatLng(spot.lat, spot.lng)
  ) {
    return { lat: spot.lat, lng: spot.lng };
  }
  return null;
}

/** Fix broken auto-previews (e.g. signed Google staticmap 403) for display. */
export function resolveSpotPreviewImage(spot: {
  image_url: string | null;
  image_manual?: boolean | null;
  lat: number | null;
  lng: number | null;
}): string | null {
  const current = spot.image_url;
  if (spot.image_manual && current) return current;
  if (current && isUsablePreviewImage(current)) return current;
  if (
    typeof spot.lat === "number" &&
    typeof spot.lng === "number" &&
    isValidLatLng(spot.lat, spot.lng)
  ) {
    return previewImageFromCoords(spot.lat, spot.lng);
  }
  return null;
}

/** Sweden-ish default for van-trip vacations without coords yet. */
export const DEFAULT_MAP_CENTER: [number, number] = [62.0, 15.0];
export const DEFAULT_MAP_ZOOM = 5;
