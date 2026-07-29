type LatLng = { lat: number; lng: number };

function serverMapsKey(): string | null {
  return (
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    null
  );
}

/** Empty / branding-only Maps titles that must not override a real place name. */
export function isGenericMapsTitle(title: string | null | undefined): boolean {
  if (!title?.trim()) return true;
  const normalized = title.trim().replace(/\s+/g, " ").toLowerCase();
  return (
    normalized === "google maps" ||
    normalized === "maps" ||
    normalized === "google" ||
    normalized === "karte" ||
    normalized === "map"
  );
}

function looksLikeHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/** Prefer the business/place label before the first address comma. */
export function displayTitleFromPlaceQuery(query: string | null | undefined): string | null {
  if (!query?.trim() || looksLikeHttpUrl(query)) return null;
  const head = query.split(",")[0]?.trim() || query.trim();
  return head || null;
}

/** Place title from a Maps place URL path segment / `q=` text. */
export function parsePlaceNameFromMapsUrl(
  url: string | null | undefined,
): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    const decoded = decodeURIComponent(parsed.toString());
    const match = decoded.match(/\/maps\/place\/([^/@]+)/i);
    if (match?.[1]) {
      const name = match[1].replace(/\+/g, " ").trim();
      if (name) return name;
    }

    const query =
      parsed.searchParams.get("q") ||
      parsed.searchParams.get("query") ||
      parsed.searchParams.get("destination");
    if (query && !/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(query.trim())) {
      return query.trim();
    }

    const searchMatch = decoded.match(/\/(?:maps\/)?search\/([^/?#]+)/i);
    if (searchMatch?.[1]) {
      const name = searchMatch[1].replace(/\+/g, " ").trim();
      if (name) return name;
    }

    return null;
  } catch {
    return null;
  }
}

/** Place label embedded in Maps HTML payloads (CID / feature blobs). */
export function parsePlaceNameFromMapsHtml(
  html: string | null | undefined,
): string | null {
  if (!html) return null;
  const quoted = html.match(
    /\["0x[0-9a-f]+:0x[0-9a-f]+","([^"]{2,200})"\]/i,
  );
  if (quoted?.[1]) {
    const name = quoted[1].replace(/\\"/g, '"').trim();
    if (name && !isGenericMapsTitle(name)) return name;
  }
  const labeled = html.match(
    /\\u003dnull,\[\\u0022(0x[0-9a-f]+:0x[0-9a-f]+)\\u0022,\\u0022([^\\]{2,200})\\u0022/i,
  );
  if (labeled?.[2]) {
    const name = labeled[2].trim();
    if (name && !isGenericMapsTitle(name)) return name;
  }
  return null;
}

/** Classic ChIJ / hex place identifiers sometimes embedded in Maps share links. */
export function parsePlaceIdFromMapsUrl(
  url: string | null | undefined,
): string | null {
  if (!url?.trim()) return null;
  try {
    const decoded = decodeURIComponent(url.trim());
    const modern = decoded.match(/[?&]query_place_id=([A-Za-z0-9_-]+)/i);
    if (modern?.[1]) return modern[1];
    const placeId = decoded.match(/place_id[=:]([A-Za-z0-9_-]+)/i);
    if (placeId?.[1]) return placeId[1];
    const chij = decoded.match(/\b(ChIJ[A-Za-z0-9_-]+)\b/);
    if (chij?.[1]) return chij[1];
    return null;
  } catch {
    return null;
  }
}

type PlacePhotoSource = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  photos?: Array<{ name?: string }>;
};

type PlacesSearchResponse = {
  places?: PlacePhotoSource[];
};

export type GooglePlaceSearchResult = {
  title: string | null;
  locationHint: string | null;
  imageUrl: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  placeId: string | null;
};

type PhotoMediaResponse = {
  photoUri?: string;
  name?: string;
};

async function resolvePhotoUri(photoName: string, key: string): Promise<string | null> {
  const mediaUrl = new URL(
    `https://places.googleapis.com/v1/${photoName}/media`,
  );
  mediaUrl.searchParams.set("maxHeightPx", "900");
  mediaUrl.searchParams.set("maxWidthPx", "1200");
  mediaUrl.searchParams.set("skipHttpRedirect", "true");

  const response = await fetch(mediaUrl, {
    headers: {
      "X-Goog-Api-Key": key,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as PhotoMediaResponse;
  return data.photoUri?.trim() || null;
}

async function firstPhotoFromPlaces(
  places: PlacePhotoSource[] | undefined,
  key: string,
): Promise<string | null> {
  for (const place of places ?? []) {
    for (const photo of place.photos ?? []) {
      if (!photo.name) continue;
      const uri = await resolvePhotoUri(photo.name, key);
      if (uri) return uri;
    }
  }
  return null;
}

async function searchTextPhoto(
  key: string,
  textQuery: string,
  coords?: LatLng | null,
): Promise<string | null> {
  const body: Record<string, unknown> = {
    textQuery: textQuery.trim(),
    languageCode: "de",
    maxResultCount: 3,
  };
  if (coords) {
    body.locationBias = {
      circle: {
        center: {
          latitude: coords.lat,
          longitude: coords.lng,
        },
        radius: 1500,
      },
    };
  }

  const search = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.photos",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!search.ok) {
    console.warn("places searchText failed", search.status, await search.text());
    return null;
  }
  const data = (await search.json()) as PlacesSearchResponse;
  return firstPhotoFromPlaces(data.places, key);
}

function mapsUrlFromCoords(
  lat: number,
  lng: number,
  placeId?: string | null,
): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}${
    placeId ? `&query_place_id=${encodeURIComponent(placeId)}` : ""
  }`;
}

/** Query variants for free geocoders — full text, then address-like suffixes. */
export function placeQueryVariants(textQuery: string): string[] {
  const query = textQuery.trim();
  if (!query || looksLikeHttpUrl(query)) return [];
  const variants: string[] = [query];
  const parts = query
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    for (let start = 1; start < parts.length; start++) {
      variants.push(parts.slice(start).join(", "));
    }
    if (parts.length >= 2) {
      variants.push(parts.slice(-2).join(", "));
    }
  }
  const shortTitle = displayTitleFromPlaceQuery(query);
  if (shortTitle && shortTitle !== query) {
    const locality = parts.length >= 2 ? parts[parts.length - 2] || parts[parts.length - 1] : null;
    if (locality && !shortTitle.toLowerCase().includes(locality.toLowerCase())) {
      variants.push(`${shortTitle} ${locality}`);
    }
  }
  return [...new Set(variants.map((item) => item.trim()).filter(Boolean))];
}

type GeocodeJson = {
  status?: string;
  results?: Array<{
    formatted_address?: string;
    place_id?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
};

async function geocodeWithGoogle(
  textQuery: string,
): Promise<GooglePlaceSearchResult | null> {
  const key = serverMapsKey();
  const query = textQuery.trim();
  if (!key || !query || looksLikeHttpUrl(query)) return null;

  try {
    for (const candidate of placeQueryVariants(query)) {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("address", candidate);
      url.searchParams.set("language", "de");
      url.searchParams.set("key", key);
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) {
        console.warn("geocode failed", response.status, await response.text());
        continue;
      }
      const data = (await response.json()) as GeocodeJson;
      if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        console.warn("geocode status", data.status, candidate);
        if (data.status === "REQUEST_DENIED" || data.status === "OVER_QUERY_LIMIT") {
          return null;
        }
        continue;
      }
      const hit = data.results?.[0];
      if (!hit) continue;
      const lat = hit.geometry?.location?.lat;
      const lng = hit.geometry?.location?.lng;
      if (typeof lat !== "number" || typeof lng !== "number") continue;
      return {
        title: displayTitleFromPlaceQuery(query) || hit.formatted_address || candidate,
        locationHint: hit.formatted_address?.trim() || null,
        imageUrl: null,
        lat,
        lng,
        mapsUrl: mapsUrlFromCoords(lat, lng, hit.place_id),
        placeId: hit.place_id?.trim() || null,
      };
    }
  } catch (error) {
    console.warn("geocode lookup failed", error);
  }
  return null;
}

type NominatimHit = {
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
};

async function geocodeWithNominatim(
  textQuery: string,
): Promise<GooglePlaceSearchResult | null> {
  const query = textQuery.trim();
  if (!query || looksLikeHttpUrl(query)) return null;

  try {
    const variants = placeQueryVariants(query).slice(0, 4);
    for (let index = 0; index < variants.length; index++) {
      const candidate = variants[index]!;
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", candidate);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "1");
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "VacationPlaner/1.0 (https://github.com/13storiesphotography/vacation)",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        console.warn("nominatim failed", response.status, await response.text());
        continue;
      }
      const data = (await response.json()) as NominatimHit[];
      const hit = data[0];
      const lat = hit?.lat != null ? Number(hit.lat) : NaN;
      const lng = hit?.lon != null ? Number(hit.lon) : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      return {
        title:
          displayTitleFromPlaceQuery(query) ||
          hit.name?.trim() ||
          hit.display_name?.split(",")[0]?.trim() ||
          candidate,
        locationHint: hit.display_name?.trim() || null,
        imageUrl: null,
        lat,
        lng,
        mapsUrl: mapsUrlFromCoords(lat, lng),
        placeId: null,
      };
    }
  } catch (error) {
    console.warn("nominatim lookup failed", error);
  }
  return null;
}

export async function searchGooglePlaceQuery(
  textQuery: string,
  coords?: LatLng | null,
): Promise<GooglePlaceSearchResult | null> {
  const key = serverMapsKey();
  const query = textQuery.trim();
  if (!key || !query || looksLikeHttpUrl(query)) return null;

  const body: Record<string, unknown> = {
    textQuery: query,
    languageCode: "de",
    maxResultCount: 3,
  };
  if (coords) {
    body.locationBias = {
      circle: {
        center: {
          latitude: coords.lat,
          longitude: coords.lng,
        },
        radius: 3000,
      },
    };
  }

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.photos",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      console.warn("places searchText failed", response.status, await response.text());
      return null;
    }

    const data = (await response.json()) as PlacesSearchResponse;
    const place = data.places?.[0];
    if (!place) return null;

    const imageUrl = await firstPhotoFromPlaces(data.places, key);
    const lat = place.location?.latitude ?? null;
    const lng = place.location?.longitude ?? null;
    const placeId = place.id?.trim() || null;
    const mapsUrl =
      lat != null && lng != null ? mapsUrlFromCoords(lat, lng, placeId) : null;

    return {
      title: place.displayName?.text?.trim() || displayTitleFromPlaceQuery(query) || query,
      locationHint: place.formattedAddress?.trim() || null,
      imageUrl,
      lat,
      lng,
      mapsUrl,
      placeId,
    };
  } catch (error) {
    console.warn("place search failed", error);
    return null;
  }
}

/**
 * Resolve a free-text place (from Maps `q=` / typed names) to coords.
 * Places API → Geocoding → OpenStreetMap Nominatim.
 */
export async function resolvePlaceQuery(
  textQuery: string,
  coords?: LatLng | null,
): Promise<GooglePlaceSearchResult | null> {
  const query = textQuery.trim();
  if (!query || looksLikeHttpUrl(query)) return null;

  const fromPlaces = await searchGooglePlaceQuery(query, coords);
  if (fromPlaces?.lat != null && fromPlaces.lng != null) return fromPlaces;

  const fromGeocode = await geocodeWithGoogle(query);
  if (fromGeocode?.lat != null && fromGeocode.lng != null) {
    if (fromPlaces?.imageUrl) {
      return { ...fromGeocode, imageUrl: fromPlaces.imageUrl, title: fromPlaces.title || fromGeocode.title };
    }
    return fromGeocode;
  }

  return geocodeWithNominatim(query);
}

async function searchNearbyPhoto(
  key: string,
  coords: LatLng,
): Promise<string | null> {
  const body = {
    languageCode: "de",
    maxResultCount: 5,
    locationRestriction: {
      circle: {
        center: {
          latitude: coords.lat,
          longitude: coords.lng,
        },
        radius: 250,
      },
    },
    // Broad enough for beaches, parks, attractions, lodging.
    includedTypes: [
      "beach",
      "park",
      "tourist_attraction",
      "natural_feature",
      "campground",
      "lodging",
      "point_of_interest",
    ],
    rankPreference: "DISTANCE",
  };

  const search = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.photos",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!search.ok) {
    console.warn("places searchNearby failed", search.status, await search.text());
    return null;
  }
  const data = (await search.json()) as PlacesSearchResponse;
  return firstPhotoFromPlaces(data.places, key);
}

async function placeDetailsPhoto(
  key: string,
  placeId: string,
): Promise<string | null> {
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "id,displayName,photos",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) {
    console.warn("places details failed", response.status, await response.text());
    return null;
  }
  const place = (await response.json()) as PlacePhotoSource;
  return firstPhotoFromPlaces([place], key);
}

/** Fetch a Google Place photo for a Maps place (requires Places API New). */
export async function fetchGooglePlacePhoto(options: {
  query?: string | null;
  coords?: LatLng | null;
  placeId?: string | null;
  mapsUrl?: string | null;
}): Promise<string | null> {
  const key = serverMapsKey();
  if (!key) return null;

  const placeId =
    options.placeId?.trim() ||
    parsePlaceIdFromMapsUrl(options.mapsUrl) ||
    null;
  const query =
    options.query?.trim() ||
    parsePlaceNameFromMapsUrl(options.mapsUrl) ||
    "";

  try {
    if (placeId) {
      const fromDetails = await placeDetailsPhoto(key, placeId);
      if (fromDetails) return fromDetails;
    }

    if (query) {
      const fromText = await searchTextPhoto(key, query, options.coords);
      if (fromText) return fromText;
      // Drop diacritics / shorten for stubborn listings.
      const ascii = query.normalize("NFD").replace(/\p{M}/gu, "");
      if (ascii && ascii !== query) {
        const fromAscii = await searchTextPhoto(key, ascii, options.coords);
        if (fromAscii) return fromAscii;
      }
    }

    if (options.coords) {
      const nearby = await searchNearbyPhoto(key, options.coords);
      if (nearby) return nearby;
    }

    return null;
  } catch (error) {
    console.warn("places photo lookup failed", error);
    return null;
  }
}
