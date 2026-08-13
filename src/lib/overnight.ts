import {
  activeCategoryOptions,
  resolveCategoryDef,
  type SpotCategory,
  type VacationSpotCategory,
} from "@/lib/spots";

/** Categories that can be chosen as overnight stay on a day plan. */
export const overnightCategories: readonly string[] = [
  "stellplatz",
  "unterkunft",
] as const;

export function isOvernightCategory(
  category: SpotCategory,
  categories?: VacationSpotCategory[],
): boolean {
  const def = resolveCategoryDef(categories, category);
  if (def) return def.supports_overnight;
  return overnightCategories.includes(category);
}

export function overnightCategoryKeys(
  categories?: VacationSpotCategory[],
): string[] {
  return activeCategoryOptions(categories)
    .filter((entry) => entry.supports_overnight)
    .map((entry) => entry.key);
}
