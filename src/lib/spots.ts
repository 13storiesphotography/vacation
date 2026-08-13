import type { Database } from "@/lib/database.types";
import {
  defaultCategoryIconByKey,
  type CategoryIconKey,
} from "@/components/category-icon";

/** Spot category key stored on spots.category (vacation-scoped). */
export type SpotCategory = string;

export type OvernightCost = Database["public"]["Enums"]["overnight_cost"];

export type VacationSpotCategory = {
  id: string;
  vacation_id: string;
  key: string;
  label: string;
  icon: string;
  sort_order: number;
  supports_overnight: boolean;
  created_at?: string;
};

export type CategorySeed = {
  key: string;
  label: string;
  icon: CategoryIconKey;
  sort_order: number;
  supports_overnight: boolean;
};

/** Built-in defaults — seeded per vacation and used as client fallback. */
export const defaultSpotCategories: CategorySeed[] = [
  {
    key: "stellplatz",
    label: "Stellplatz",
    icon: "van",
    sort_order: 0,
    supports_overnight: true,
  },
  {
    key: "unterkunft",
    label: "Unterkunft",
    icon: "home",
    sort_order: 1,
    supports_overnight: true,
  },
  {
    key: "sehenswuerdigkeit",
    label: "Sehenswürdigkeit",
    icon: "star",
    sort_order: 2,
    supports_overnight: false,
  },
  {
    key: "ort",
    label: "Ort",
    icon: "city",
    sort_order: 3,
    supports_overnight: false,
  },
  {
    key: "freizeit",
    label: "Freizeit",
    icon: "hike",
    sort_order: 4,
    supports_overnight: false,
  },
  {
    key: "versorgung",
    label: "Versorgung",
    icon: "bag",
    sort_order: 5,
    supports_overnight: false,
  },
];

/** @deprecated Prefer resolveCategoryLabel with vacation categories. */
export const categoryLabels: Record<string, string> = Object.fromEntries(
  defaultSpotCategories.map((entry) => [entry.key, entry.label]),
);

/** @deprecated Prefer category icon from vacation categories. */
export const categoryTone: Record<string, string> = {
  stellplatz: "#2f6f5e",
  unterkunft: "#8b4d6b",
  sehenswuerdigkeit: "#b56a3c",
  ort: "#1f5f78",
  freizeit: "#6a7a2f",
  versorgung: "#6b5a3c",
};

/** @deprecated Prefer vacation categories list. */
export const categoryOptions: SpotCategory[] = defaultSpotCategories.map(
  (entry) => entry.key,
);

export function resolveCategoryDef(
  categories: VacationSpotCategory[] | undefined,
  key: string | null | undefined,
): VacationSpotCategory | null {
  if (!key) return null;
  const fromVacation = categories?.find((entry) => entry.key === key);
  if (fromVacation) return fromVacation;
  const seed = defaultSpotCategories.find((entry) => entry.key === key);
  if (!seed) return null;
  return {
    id: `seed:${seed.key}`,
    vacation_id: "",
    key: seed.key,
    label: seed.label,
    icon: seed.icon,
    sort_order: seed.sort_order,
    supports_overnight: seed.supports_overnight,
  };
}

export function resolveCategoryLabel(
  categories: VacationSpotCategory[] | undefined,
  key: string | null | undefined,
): string {
  return resolveCategoryDef(categories, key)?.label ?? key ?? "Kategorie";
}

export function resolveCategoryIcon(
  categories: VacationSpotCategory[] | undefined,
  key: string | null | undefined,
): string {
  const def = resolveCategoryDef(categories, key);
  if (def?.icon) return def.icon;
  if (key && defaultCategoryIconByKey[key]) return defaultCategoryIconByKey[key];
  return "pin";
}

export function activeCategoryOptions(
  categories: VacationSpotCategory[] | undefined,
): VacationSpotCategory[] {
  if (categories && categories.length > 0) {
    return [...categories].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "de"));
  }
  return defaultSpotCategories.map((seed) => ({
    id: `seed:${seed.key}`,
    vacation_id: "",
    key: seed.key,
    label: seed.label,
    icon: seed.icon,
    sort_order: seed.sort_order,
    supports_overnight: seed.supports_overnight,
  }));
}

export function slugifyCategoryKey(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  if (!base) return `kat_${Date.now().toString(36)}`;
  if (/^[a-z]/.test(base)) return base;
  return `k_${base}`.slice(0, 48);
}

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

/** User-facing: archived spots stay in the collection but leave Plan/Karte. */
export function isSpotShelved(spot: { is_relevant?: boolean | null }): boolean {
  return !isSpotRelevant(spot);
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
