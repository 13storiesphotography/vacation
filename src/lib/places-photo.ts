type LatLng = { lat: number; lng: number };

function serverMapsKey(): string | null {
  return (
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    null
  );
}

/** Place title from a Maps place URL path segment. */
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

export async function searchGooglePlaceQuery(
  textQuery: string,
  coords?: LatLng | null,
): Promise<GooglePlaceSearchResult | null> {
  const key = serverMapsKey();
  const query = textQuery.trim();
  if (!key || !query) return null;

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
      lat != null && lng != null
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}${
            placeId ? `&query_place_id=${encodeURIComponent(placeId)}` : ""
          }`
        : null;

    return {
      title: place.displayName?.text?.trim() || query,
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
