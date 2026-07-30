import type { Database } from "@/lib/database.types";
import { isValidLatLng, parseLatLngFromMapsUrl, type LatLng } from "@/lib/geo";

export type VacationRow = Database["public"]["Tables"]["vacations"]["Row"];

/** Synthetic waypoint id — not a spots row. */
export const VACATION_HOME_ID = "__vacation_home__";

export type VacationHome = {
  label: string;
  coords: LatLng;
  mapsUrl: string | null;
  includeInRoute: boolean;
};

export function vacationHomeFromRow(
  vacation: Pick<
    VacationRow,
    | "home_label"
    | "home_lat"
    | "home_lng"
    | "home_maps_url"
    | "include_home_in_route"
  >,
): VacationHome | null {
  const lat = vacation.home_lat;
  const lng = vacation.home_lng;
  if (typeof lat !== "number" || typeof lng !== "number" || !isValidLatLng(lat, lng)) {
    return null;
  }
  const label = vacation.home_label?.trim() || "Zuhause";
  return {
    label,
    coords: { lat, lng },
    mapsUrl: vacation.home_maps_url?.trim() || null,
    includeInRoute: vacation.include_home_in_route !== false,
  };
}

export function resolveHomeCoordsFromMapsUrl(mapsUrl: string | null | undefined): LatLng | null {
  return parseLatLngFromMapsUrl(mapsUrl);
}
