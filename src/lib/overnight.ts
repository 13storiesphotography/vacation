import type { SpotCategory } from "@/lib/spots";

/** Categories that can be chosen as overnight stay on a day plan. */
export const overnightCategories: readonly SpotCategory[] = [
  "stellplatz",
  "unterkunft",
] as const;

export function isOvernightCategory(category: SpotCategory): boolean {
  return (overnightCategories as readonly string[]).includes(category);
}
