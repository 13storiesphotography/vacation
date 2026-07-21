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
    const decoded = decodeURIComponent(url.trim());
    const match = decoded.match(/\/maps\/place\/([^/@]+)/i);
    if (!match?.[1]) return null;
    const name = match[1].replace(/\+/g, " ").trim();
    return name || null;
  } catch {
    return null;
  }
}

type PlacesSearchResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    photos?: Array<{ name?: string }>;
  }>;
};

type PhotoMediaResponse = {
  photoUri?: string;
  name?: string;
};

async function resolvePhotoUri(photoName: string, key: string): Promise<string | null> {
  // photoName is places/PLACE_ID/photos/PHOTO_REF
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

/** Fetch the first Google Place photo for a Maps place (requires Places API New). */
export async function fetchGooglePlacePhoto(options: {
  query: string;
  coords?: LatLng | null;
}): Promise<string | null> {
  const key = serverMapsKey();
  if (!key || !options.query.trim()) return null;

  try {
    const body: Record<string, unknown> = {
      textQuery: options.query.trim(),
      languageCode: "de",
      maxResultCount: 1,
    };
    if (options.coords) {
      body.locationBias = {
        circle: {
          center: {
            latitude: options.coords.lat,
            longitude: options.coords.lng,
          },
          radius: 800,
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
    const photoName = data.places?.[0]?.photos?.[0]?.name;
    if (!photoName) return null;

    return resolvePhotoUri(photoName, key);
  } catch (error) {
    console.warn("places photo lookup failed", error);
    return null;
  }
}
