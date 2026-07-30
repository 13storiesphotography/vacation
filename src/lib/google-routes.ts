import type { LatLng } from "@/lib/geo";

export type GoogleRouteLeg = {
  km: number;
  minutes: number;
  /** Traffic-unaware (static) drive time in minutes. Present when trafficAware=true. */
  minutesStatic?: number;
  /** Whether this leg used TRAFFIC_AWARE routing preference. */
  trafficAware?: boolean;
};

export type GoogleRouteResult = {
  legs: GoogleRouteLeg[];
  totalKm: number;
  totalMinutes: number;
  /** Encoded polyline for the whole route (Google Maps only). */
  encodedPolyline: string | null;
  encodedPolylines: string[];
};

function getServerMapsKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || null;
}

export function hasGoogleRoutesKey(): boolean {
  return Boolean(getServerMapsKey());
}

function parseDurationSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
    if (match) return Number(match[1]);
  }
  return null;
}

type RoutesApiResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string | number;
    polyline?: { encodedPolyline?: string };
    legs?: Array<{
      distanceMeters?: number;
      duration?: string | number;
      staticDuration?: string | number;
    }>;
  }>;
  error?: { message?: string; status?: string };
};

/**
 * Google Routes API (computeRoutes) — server-only.
 * Requires GOOGLE_MAPS_API_KEY with Routes API enabled.
 *
 * When departureTime is provided (ISO-8601 string), TRAFFIC_AWARE routing is
 * used with a future-departure prediction. Without departureTime TRAFFIC_AWARE
 * uses current live conditions. Both modes are shorter-cached (300 s).
 */
export async function computeDrivingRoute(
  points: LatLng[],
  departureTime?: string,
): Promise<GoogleRouteResult | null> {
  if (points.length < 2) return null;
  const apiKey = getServerMapsKey();
  if (!apiKey) return null;

  const origin = points[0];
  const destination = points[points.length - 1];
  const intermediates = points.slice(1, -1).map((point) => ({
    location: {
      latLng: { latitude: point.lat, longitude: point.lng },
    },
  }));

  const body: Record<string, unknown> = {
    origin: {
      location: {
        latLng: { latitude: origin.lat, longitude: origin.lng },
      },
    },
    destination: {
      location: {
        latLng: { latitude: destination.lat, longitude: destination.lng },
      },
    },
    intermediates: intermediates.length > 0 ? intermediates : undefined,
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    languageCode: "de-DE",
    units: "METRIC",
  };

  if (departureTime) {
    body.departureTime = departureTime;
  }

  try {
    const response = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.distanceMeters,routes.legs.duration,routes.legs.staticDuration",
        },
        body: JSON.stringify(body),
        // Traffic data is time-sensitive — keep TTL short.
        next: { revalidate: 300 },
      },
    );

    const json = (await response.json()) as RoutesApiResponse;
    if (!response.ok) {
      console.error("[google-routes]", json.error?.message ?? response.statusText);
      return null;
    }

    const route = json.routes?.[0];
    if (!route?.legs?.length) return null;
    if (route.legs.length !== points.length - 1) {
      // Unexpected shape — safer to fall back than show wrong legs.
      console.error(
        "[google-routes] leg count mismatch",
        route.legs.length,
        points.length - 1,
      );
      return null;
    }

    const legs: GoogleRouteLeg[] = route.legs.map((leg) => {
      const meters = typeof leg.distanceMeters === "number" ? leg.distanceMeters : 0;
      const seconds = parseDurationSeconds(leg.duration) ?? 0;
      const staticSeconds = parseDurationSeconds(leg.staticDuration);
      return {
        km: meters / 1000,
        minutes: Math.max(1, Math.round(seconds / 60)),
        minutesStatic: staticSeconds != null ? Math.max(1, Math.round(staticSeconds / 60)) : undefined,
        trafficAware: true,
      };
    });

    const totalKm =
      typeof route.distanceMeters === "number"
        ? route.distanceMeters / 1000
        : legs.reduce((sum, leg) => sum + leg.km, 0);
    const totalSeconds = parseDurationSeconds(route.duration);
    const totalMinutes =
      totalSeconds != null
        ? Math.max(1, Math.round(totalSeconds / 60))
        : legs.reduce((sum, leg) => sum + leg.minutes, 0);

    return {
      legs,
      totalKm,
      totalMinutes,
      encodedPolyline: route.polyline?.encodedPolyline ?? null,
      encodedPolylines: route.polyline?.encodedPolyline
        ? [route.polyline.encodedPolyline]
        : [],
    };
  } catch (error) {
    console.error("[google-routes]", error);
    return null;
  }
}

const CHUNK_SIZE = 25; // origin + intermediates + destination

/**
 * Chunk long itineraries into overlapping 25-point Windows so no leg is lost.
 */
export async function computeDrivingRouteChunked(
  points: LatLng[],
  departureTime?: string,
): Promise<GoogleRouteResult | null> {
  if (points.length < 2) return null;
  if (points.length <= CHUNK_SIZE) {
    return computeDrivingRoute(points, departureTime);
  }

  const legs: GoogleRouteLeg[] = [];
  const polylines: string[] = [];
  let cursor = 0;
  while (cursor < points.length - 1) {
    const end = Math.min(cursor + CHUNK_SIZE - 1, points.length - 1);
    const chunk = points.slice(cursor, end + 1);
    const result = await computeDrivingRoute(chunk, departureTime);
    if (!result) return null;
    legs.push(...result.legs);
    if (result.encodedPolyline) polylines.push(result.encodedPolyline);
    if (end >= points.length - 1) break;
    cursor = end; // overlap last point as next origin
  }

  if (legs.length !== points.length - 1) {
    console.error("[google-routes] chunked leg mismatch", legs.length, points.length - 1);
    return null;
  }

  return {
    legs,
    totalKm: legs.reduce((sum, leg) => sum + leg.km, 0),
    totalMinutes: legs.reduce((sum, leg) => sum + leg.minutes, 0),
    encodedPolyline: polylines[0] ?? null,
    encodedPolylines: polylines,
  };
}
