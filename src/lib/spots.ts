import type { Database } from "@/lib/database.types";

export type SpotCategory = Database["public"]["Enums"]["spot_category"];
export type OvernightCost = Database["public"]["Enums"]["overnight_cost"];

export const categoryLabels: Record<SpotCategory, string> = {
  stellplatz: "Stellplatz",
  unterkunft: "Unterkunft",
  sehenswuerdigkeit: "Sehenswürdigkeit",
  ort: "Ort",
  freizeit: "Freizeit",
  versorgung: "Versorgung",
};

export const categoryTone: Record<SpotCategory, string> = {
  stellplatz: "#2f6f5e",
  unterkunft: "#8b4d6b",
  sehenswuerdigkeit: "#b56a3c",
  ort: "#1f5f78",
  freizeit: "#6a7a2f",
  versorgung: "#6b5a3c",
};

export const categoryOptions: SpotCategory[] = [
  "stellplatz",
  "unterkunft",
  "sehenswuerdigkeit",
  "ort",
  "freizeit",
  "versorgung",
];

export function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** Shared trip decision — default true for older rows / unset. */
export function isSpotRelevant(spot: { is_relevant?: boolean | null }): boolean {
  return spot.is_relevant !== false;
}

/** Common trip tags — tap to toggle in the spot editor. */
export const suggestedSpotTags = [
  "Strand",
  "Wald",
  "See",
  "Stadt",
  "ruhig",
  "Strom",
  "Wasser",
  "WLAN",
  "Familie",
  "Hund",
  "Wanderung",
  "Badestelle",
] as const;
