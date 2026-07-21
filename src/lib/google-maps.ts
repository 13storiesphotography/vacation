import type { Database } from "@/lib/database.types";

export type SpotRow = Database["public"]["Tables"]["spots"]["Row"];

export type MappableSpot = SpotRow & {
  coords: { lat: number; lng: number };
};

/** Browser key for Maps JavaScript API (HTTP referrer restricted). */
export function getBrowserGoogleMapsKey(): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  return key || null;
}
