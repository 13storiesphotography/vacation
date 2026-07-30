import type { DayPlanWithStops } from "@/lib/day-plans";
import type { DayRoute } from "@/lib/day-route";
import type { DayTimelineEntry } from "@/lib/day-timeline";
import { formatRouteDuration } from "@/lib/day-route";

export type HintSeverity = "warning" | "info";

export type PlanHint = {
  id: string;
  severity: HintSeverity;
  message: string;
};

/** Stops threshold above which a day is considered dense. */
const DENSE_STOPS_THRESHOLD = 6;
/** Active-time threshold (in hours) above which a day is considered dense. */
const DENSE_HOURS_THRESHOLD = 10;
/** Drive minutes above which a single leg is considered long. */
const LONG_DRIVE_MINUTES = 90;
/** Road km above which a single leg is considered long. */
const LONG_DRIVE_KM = 120;
/** Last-arrival hour (0–23) after which the day is flagged as running late. */
const LATE_ARRIVAL_HOUR = 22;

/**
 * Compute plan hints for a single day.
 *
 * @param day            The day plan row (stops, overnight, depart_at…).
 * @param route          Enriched or estimated day route (null = no stops yet).
 * @param timeline       Derived timeline entries for the day.
 * @param needsOvernight Whether the vacation type requires an overnight spot.
 */
export function computeDayHints(input: {
  day: DayPlanWithStops;
  route: DayRoute | null;
  timeline: DayTimelineEntry[];
  needsOvernight?: boolean;
}): PlanHint[] {
  const { day, route, timeline, needsOvernight } = input;
  const hints: PlanHint[] = [];

  // Missing overnight spot
  if (needsOvernight && !day.overnight_spot_id) {
    hints.push({
      id: "missing-overnight",
      severity: "warning",
      message: "Übernachtung fehlt noch",
    });
  }

  // Spots without coordinates — skipped from the route
  if (route && route.skipped.length > 0) {
    const names = route.skipped.map((s) => s.name).join(", ");
    hints.push({
      id: "missing-coords",
      severity: "warning",
      message: `Kein Standort: ${names}`,
    });
  }

  // Dense day — many stops
  const stopCount = day.stops.length;
  if (stopCount >= DENSE_STOPS_THRESHOLD) {
    hints.push({
      id: "dense-stops",
      severity: "info",
      message: `Dichter Tag (${stopCount} Stops)`,
    });
  }

  // Long individual drives
  if (route) {
    for (const leg of route.legs) {
      if (leg.minutes > LONG_DRIVE_MINUTES || leg.km > LONG_DRIVE_KM) {
        const dur = formatRouteDuration(leg.minutes);
        hints.push({
          id: `long-drive:${leg.fromSpotId}-${leg.toSpotId}`,
          severity: "info",
          message: `Lange Fahrt: ${leg.fromName} → ${leg.toName} (${dur})`,
        });
      }
    }
  }

  // Dense day — total active time
  if (route && stopCount < DENSE_STOPS_THRESHOLD) {
    const totalActiveMinutes = timeline.reduce((sum, entry) => {
      if (entry.role === "origin") return sum;
      return sum + (entry.driveMinutesBefore ?? 0) + (entry.dwellMinutes ?? 0);
    }, 0);
    if (totalActiveMinutes > DENSE_HOURS_THRESHOLD * 60) {
      const h = Math.floor(totalActiveMinutes / 60);
      hints.push({
        id: "dense-time",
        severity: "info",
        message: `Langer Tag (~${h} Std Gesamtzeit)`,
      });
    }
  }

  // Late arrival at the last destination
  if (timeline.length > 0) {
    const last = timeline[timeline.length - 1];
    const arriveAt = last.arriveAt;
    if (arriveAt) {
      const [h, m] = arriveAt.split(":").map(Number);
      if (h * 60 + m > LATE_ARRIVAL_HOUR * 60) {
        hints.push({
          id: "late-arrival",
          severity: "warning",
          message: `Späte Ankunft: ${arriveAt} Uhr`,
        });
      }
    }
  }

  return hints;
}

/** Returns true if any hint has severity "warning". */
export function hasWarningHint(hints: PlanHint[]): boolean {
  return hints.some((h) => h.severity === "warning");
}
