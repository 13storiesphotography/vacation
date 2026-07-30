import type { Database } from "@/lib/database.types";

export type DayPlan = Database["public"]["Tables"]["day_plans"]["Row"];
export type DayPlanSpot = Database["public"]["Tables"]["day_plan_spots"]["Row"];

export type DayPlanWithStops = DayPlan & {
  stops: DayPlanSpot[];
};

/** Inclusive list of ISO dates (YYYY-MM-DD) between start and end. */
export function eachDateInclusive(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  // Parse as UTC noon so local timezone cannot shift the calendar day.
  const cursor = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) return dates;
  if (cursor > end) return dates;

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function formatDayLabel(date: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function defaultDayTitle(date: string, index: number): string {
  return `Tag ${index + 1}`;
}

/**
 * Morning start for a day: walk back to the latest prior overnight, else the
 * last stop of a previous day. Skips empty gap days so mid-trip segments
 * continue from the last known place — home is only for the trip start.
 */
export function previousMorningOriginSpotId(
  days: DayPlanWithStops[],
  dayId: string,
): string | null {
  return previousMorningOriginMeta(days, dayId)?.spotId ?? null;
}

/** Date/kind of the day that supplied the morning origin, for UI copy. */
export function previousMorningOriginMeta(
  days: DayPlanWithStops[],
  dayId: string,
): { spotId: string; fromDate: string; kind: "overnight" | "stop" } | null {
  const index = days.findIndex((day) => day.id === dayId);
  if (index <= 0) return null;
  for (let i = index - 1; i >= 0; i -= 1) {
    const day = days[i];
    if (day.overnight_spot_id) {
      return {
        spotId: day.overnight_spot_id,
        fromDate: day.date,
        kind: "overnight",
      };
    }
    const ordered = [...day.stops].sort((a, b) => a.position - b.position);
    const lastStop = ordered[ordered.length - 1];
    if (lastStop?.spot_id) {
      return { spotId: lastStop.spot_id, fromDate: day.date, kind: "stop" };
    }
  }
  return null;
}

/** @deprecated Prefer previousMorningOriginSpotId. */
export function previousOvernightSpotId(
  days: DayPlanWithStops[],
  dayId: string,
): string | null {
  return previousMorningOriginSpotId(days, dayId);
}
