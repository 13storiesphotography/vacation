import type { Database } from "@/lib/database.types";

export type DayPlan = Database["public"]["Tables"]["day_plans"]["Row"];
export type DayPlanSpot = Database["public"]["Tables"]["day_plan_spots"]["Row"];

export type DayPlanWithStops = DayPlan & {
  stops: DayPlanSpot[];
};

/** Inclusive list of ISO dates (YYYY-MM-DD) between start and end. */
export function eachDateInclusive(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) return dates;
  if (cursor > end) return dates;

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function formatDayLabel(date: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00`));
}

export function defaultDayTitle(date: string, index: number): string {
  return `Tag ${index + 1}`;
}
