import type { DayPlanWithStops } from "@/lib/day-plans";
import type { DayRoute, RouteSource } from "@/lib/day-route";
import type { Database } from "@/lib/database.types";

type SpotCategory = Database["public"]["Tables"]["spots"]["Row"]["category"];

export const DEFAULT_DWELL_MINUTES = 60;

/** Default on-site minutes when dwell_minutes is unset. */
export function defaultDwellMinutes(category?: SpotCategory | null): number {
  if (category === "versorgung") return 20;
  if (category === "stellplatz" || category === "unterkunft") return 0;
  return DEFAULT_DWELL_MINUTES;
}

/** Normalize DB time ("09:30:00" | "09:30") → "09:30". */
export function normalizeClockTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatClockTime(value: string | null | undefined): string {
  return normalizeClockTime(value) ?? "—";
}

export function minutesFromMidnight(value: string | null | undefined): number | null {
  const normalized = normalizeClockTime(value);
  if (!normalized) return null;
  const [h, m] = normalized.split(":").map(Number);
  return h * 60 + m;
}

export function clockFromMinutes(total: number): string {
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type DayTimelineEntry = {
  spotId: string;
  /** day_plan_spots.id when role is stop. */
  stopId: string | null;
  name: string;
  role: "origin" | "stop" | "overnight";
  arriveAt: string | null;
  departAt: string | null;
  dwellMinutes: number | null;
  dwellIsDefault: boolean;
  driveMinutesBefore: number | null;
  driveKmBefore: number | null;
  driveSource: RouteSource | null;
  /** Traffic-unaware static drive minutes. Present when driveSource=google and trafficAware. */
  driveMinutesStaticBefore: number | null;
  /** Whether the leg used TRAFFIC_AWARE routing preference. */
  driveTrafficAwareBefore: boolean | null;
};

/**
 * Derive a day timeline from depart_at + dwells + route legs.
 * Without depart_at, drive legs still show; clock times stay null.
 */
export function buildDayTimeline(input: {
  day: DayPlanWithStops;
  route: DayRoute | null;
  categoryBySpotId?: Map<string, SpotCategory>;
}): DayTimelineEntry[] {
  const { day, route } = input;
  if (!route || route.waypoints.length === 0) return [];

  const dwellBySpot = new Map(
    day.stops.map((stop) => [stop.spot_id, stop] as const),
  );

  const startMinutes = minutesFromMidnight(day.depart_at ?? null);
  let cursor = startMinutes;
  const entries: DayTimelineEntry[] = [];

  for (let i = 0; i < route.waypoints.length; i += 1) {
    const waypoint = route.waypoints[i];
    const legBefore = i > 0 ? route.legs[i - 1] ?? null : null;

    if (legBefore && cursor != null) {
      cursor += Math.max(0, legBefore.minutes);
    }

    const stopRow = dwellBySpot.get(waypoint.spotId) ?? null;
    const isOvernight = waypoint.role === "overnight";
    const isOrigin = waypoint.role === "origin";

    let dwellMinutes: number | null = null;
    let dwellIsDefault = false;
    if (isOrigin || isOvernight) {
      dwellMinutes = null;
    } else if (stopRow?.dwell_minutes != null) {
      dwellMinutes = stopRow.dwell_minutes;
      dwellIsDefault = false;
    } else {
      dwellMinutes = defaultDwellMinutes(
        input.categoryBySpotId?.get(waypoint.spotId) ?? waypoint.category,
      );
      dwellIsDefault = true;
    }

    const arriveAt =
      isOrigin || cursor == null ? null : clockFromMinutes(cursor);

    let departAt: string | null = null;
    if (isOrigin) {
      departAt = normalizeClockTime(day.depart_at);
      cursor = startMinutes;
    } else if (isOvernight) {
      departAt = null;
    } else if (cursor != null && dwellMinutes != null) {
      cursor += Math.max(0, dwellMinutes);
      departAt = clockFromMinutes(cursor);
    }

    entries.push({
      spotId: waypoint.spotId,
      stopId: stopRow?.id ?? null,
      name: waypoint.name,
      role: waypoint.role,
      arriveAt,
      departAt,
      dwellMinutes,
      dwellIsDefault,
      driveMinutesBefore: legBefore?.minutes ?? null,
      driveKmBefore: legBefore?.km ?? null,
      driveSource: legBefore?.source ?? null,
      driveMinutesStaticBefore: legBefore?.minutesStatic ?? null,
      driveTrafficAwareBefore: legBefore?.trafficAware ?? null,
    });
  }

  return entries;
}

/** Previous day's overnight spot id, if any. */
export function previousOvernightSpotId(
  days: DayPlanWithStops[],
  dayId: string,
): string | null {
  const index = days.findIndex((day) => day.id === dayId);
  if (index <= 0) return null;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (days[i].overnight_spot_id) return days[i].overnight_spot_id;
  }
  return null;
}

export type DayCalendarBlock = {
  id: string;
  kind: "fahrt" | "aufenthalt";
  label: string;
  detail?: string;
  /** Minutes from midnight; may exceed 24h for late arrivals. */
  startMin: number;
  endMin: number;
  spotId?: string;
  role?: DayTimelineEntry["role"];
};

function blockDetailDrive(entry: DayTimelineEntry): string | undefined {
  const parts: string[] = [];
  if (entry.driveMinutesBefore != null) {
    const h = Math.floor(entry.driveMinutesBefore / 60);
    const m = entry.driveMinutesBefore % 60;
    parts.push(h > 0 ? `${h} Std ${m} Min` : `${m} Min`);
  }
  if (entry.driveKmBefore != null && entry.driveKmBefore > 0) {
    parts.push(`${Math.round(entry.driveKmBefore)} km`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/**
 * Map timeline entries to calendar blocks (Fahrten + Aufenthalte).
 * Requires clock times (depart_at set). Returns [] if clocks are missing.
 */
export function timelineToCalendarBlocks(
  entries: DayTimelineEntry[],
): DayCalendarBlock[] {
  if (entries.length === 0) return [];
  const hasClocks = entries.some(
    (entry) => entry.arriveAt != null || entry.departAt != null,
  );
  if (!hasClocks) return [];

  const blocks: DayCalendarBlock[] = [];
  let prevDepartMin: number | null = null;

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    let arriveMin = minutesFromMidnight(entry.arriveAt);
    let departMin = minutesFromMidnight(entry.departAt);

    // Keep a monotonic day if we wrapped past midnight.
    if (
      arriveMin != null &&
      prevDepartMin != null &&
      arriveMin < prevDepartMin
    ) {
      arriveMin += 24 * 60;
    }
    if (
      departMin != null &&
      arriveMin != null &&
      departMin < arriveMin
    ) {
      departMin += 24 * 60;
    }
    if (
      departMin != null &&
      prevDepartMin != null &&
      departMin < prevDepartMin
    ) {
      departMin += 24 * 60;
    }
    if (
      entry.driveMinutesBefore != null &&
      entry.driveMinutesBefore > 0 &&
      prevDepartMin != null
    ) {
      const driveStart: number = prevDepartMin;
      const driveEnd: number = prevDepartMin + entry.driveMinutesBefore;
      if (arriveMin == null) arriveMin = driveEnd;
      else if (arriveMin < driveStart) arriveMin += 24 * 60;
      blocks.push({
        id: `fahrt-${index}-${entry.spotId}`,
        kind: "fahrt",
        label: `Fahrt → ${entry.name}`,
        detail: blockDetailDrive(entry),
        startMin: driveStart,
        endMin: driveEnd,
        spotId: entry.spotId,
      });
    } else if (
      entry.driveMinutesBefore != null &&
      entry.driveMinutesBefore > 0 &&
      arriveMin != null
    ) {
      const driveEnd: number = arriveMin;
      const driveStart: number = arriveMin - entry.driveMinutesBefore;
      blocks.push({
        id: `fahrt-${index}-${entry.spotId}`,
        kind: "fahrt",
        label: `Fahrt → ${entry.name}`,
        detail: blockDetailDrive(entry),
        startMin: driveStart,
        endMin: driveEnd,
        spotId: entry.spotId,
      });
    }

    if (entry.role === "origin" && departMin != null) {
      prevDepartMin = departMin;
      continue;
    }

    if (entry.role === "stop" && arriveMin != null) {
      if (departMin != null && departMin < arriveMin) departMin += 24 * 60;
      const dwellEnd: number =
        departMin ??
        arriveMin + Math.max(0, entry.dwellMinutes ?? defaultDwellMinutes(null));
      const visualEnd: number = Math.max(dwellEnd, arriveMin + 20);
      blocks.push({
        id: `aufenthalt-${index}-${entry.spotId}`,
        kind: "aufenthalt",
        label: entry.name,
        detail:
          entry.dwellMinutes != null
            ? entry.dwellIsDefault
              ? `${entry.dwellMinutes} Min (Standard)`
              : `${entry.dwellMinutes} Min`
            : undefined,
        startMin: arriveMin,
        endMin: visualEnd,
        spotId: entry.spotId,
        role: "stop",
      });
      prevDepartMin = dwellEnd;
      continue;
    }

    if (entry.role === "overnight" && arriveMin != null) {
      const midnight = Math.ceil((arriveMin + 1) / (24 * 60)) * (24 * 60);
      const overnightEnd = Math.max(
        arriveMin + 90,
        Math.min(midnight, arriveMin + 12 * 60),
      );
      blocks.push({
        id: `overnight-${index}-${entry.spotId}`,
        kind: "aufenthalt",
        label: `Übernachtung · ${entry.name}`,
        detail: `Ankunft ${clockFromMinutes(arriveMin)}`,
        startMin: arriveMin,
        endMin: overnightEnd,
        spotId: entry.spotId,
        role: "overnight",
      });
      prevDepartMin = overnightEnd;
      continue;
    }

    if (departMin != null) prevDepartMin = departMin;
    else if (arriveMin != null) prevDepartMin = arriveMin;
  }

  return blocks.filter((block) => block.endMin > block.startMin);
}

/** Hour range covering blocks, snapped to full hours with padding. */
export function calendarHourRange(
  blocks: DayCalendarBlock[],
  fallbackStart = 6,
  fallbackEnd = 22,
): { startHour: number; endHour: number } {
  if (blocks.length === 0) {
    return { startHour: fallbackStart, endHour: fallbackEnd };
  }
  const min = Math.min(...blocks.map((block) => block.startMin));
  const max = Math.max(...blocks.map((block) => block.endMin));
  const startHour = Math.max(0, Math.floor(min / 60) - 1);
  const endHour = Math.min(36, Math.ceil(max / 60) + 1); // allow past midnight visually
  return {
    startHour,
    endHour: Math.max(startHour + 4, endHour),
  };
}
