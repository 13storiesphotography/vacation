import { formatDayLabel, type DayPlanWithStops } from "@/lib/day-plans";
import {
  buildDayRoute,
  estimateRoadKmBetween,
  formatRouteDuration,
  formatRouteKm,
  type DayRoute,
} from "@/lib/day-route";
import { resolveSpotCoords, resolveSpotPreviewImage, type LatLng } from "@/lib/geo";
import { isSpotRelevant } from "@/lib/spots";
import type { Database } from "@/lib/database.types";
import type { DayWeather } from "@/lib/weather";

export type VacationSummary = Pick<
  Database["public"]["Tables"]["vacations"]["Row"],
  "id" | "title" | "type" | "region" | "description" | "start_date" | "end_date"
>;

export type SpotRow = Database["public"]["Tables"]["spots"]["Row"];

export type TripPhase = "upcoming" | "active" | "past";

export type DashboardPlace = {
  spotId: string;
  name: string;
  category: SpotRow["category"];
  role: "stop" | "overnight";
  order: number;
  imageUrl: string | null;
  coords: LatLng | null;
  tags: string[];
};

export type DashboardLeg = {
  fromName: string;
  toName: string;
  km: number;
  minutes: number;
  kmLabel: string;
  durationLabel: string;
  source: "google" | "estimate";
  fromCoords?: LatLng | null;
  toCoords?: LatLng | null;
};

export type FeaturedDashboard = {
  vacation: VacationSummary;
  phase: TripPhase;
  /** Inclusive day count of the vacation. */
  totalDays: number;
  /** 1-based day index when active; null before/after. */
  dayIndex: number | null;
  daysUntilStart: number;
  daysUntilEnd: number;
  daysSinceEnd: number;
  heroTitle: string;
  heroSubtitle: string;
  progress: number;
  focusDate: string | null;
  focusLabel: string | null;
  focusTitle: string | null;
  isFocusToday: boolean;
  places: DashboardPlace[];
  overnight: DashboardPlace | null;
  nextLeg: DashboardLeg | null;
  arrivalLeg: DashboardLeg | null;
  route: DayRoute | null;
  weather: DayWeather | null;
  weatherNote: string | null;
  alerts: string[];
  relevantSpotCount: number;
  plannedRelevantCount: number;
  daysWithStops: number;
};

export type DashboardPayload = {
  featured: FeaturedDashboard | null;
  others: VacationSummary[];
};

const TYPE_LABELS: Record<VacationSummary["type"], string> = {
  van: "Van",
  hotel: "Hotel",
  camping: "Camping",
  other: "Reise",
};

export function vacationTypeLabel(type: VacationSummary["type"]): string {
  return TYPE_LABELS[type] ?? type;
}

/** Local calendar YYYY-MM-DD (Europe-facing; uses runtime timezone). */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoDay(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = parseIsoDay(fromIso).getTime();
  const to = parseIsoDay(toIso).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function pickFeaturedVacation(
  vacations: VacationSummary[],
  today = todayIso(),
): VacationSummary | null {
  if (vacations.length === 0) return null;
  const active = vacations
    .filter((v) => v.start_date <= today && v.end_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (active[0]) return active[0];

  const upcoming = vacations
    .filter((v) => v.start_date > today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (upcoming[0]) return upcoming[0];

  return [...vacations].sort((a, b) => b.end_date.localeCompare(a.end_date))[0] ?? null;
}

export function tripPhase(vacation: VacationSummary, today: string): TripPhase {
  if (today < vacation.start_date) return "upcoming";
  if (today > vacation.end_date) return "past";
  return "active";
}

function findFocusDay(
  days: DayPlanWithStops[],
  vacation: VacationSummary,
  today: string,
  phase: TripPhase,
): { day: DayPlanWithStops; index: number } | null {
  if (days.length === 0) return null;
  if (phase === "upcoming") {
    const withStops = days.find((day) => day.stops.length > 0 || day.overnight_spot_id);
    const day = withStops ?? days[0];
    return day ? { day, index: days.indexOf(day) } : null;
  }
  if (phase === "past") {
    const last = [...days].reverse().find((day) => day.stops.length > 0 || day.overnight_spot_id);
    const day = last ?? days[days.length - 1];
    return day ? { day, index: days.indexOf(day) } : null;
  }
  const todayIndex = days.findIndex((day) => day.date === today);
  if (todayIndex >= 0) {
    const todayDay = days[todayIndex];
    if (todayDay.stops.length > 0 || todayDay.overnight_spot_id) {
      return { day: todayDay, index: todayIndex };
    }
    const next = days.slice(todayIndex + 1).find((day) => day.stops.length > 0 || day.overnight_spot_id);
    if (next) return { day: next, index: days.indexOf(next) };
    return { day: todayDay, index: todayIndex };
  }
  // Active but today not materialized — pick nearest day by date.
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const next = sorted.find((day) => day.date >= today) ?? sorted[sorted.length - 1];
  return next ? { day: next, index: days.indexOf(next) } : null;
}

function toPlace(
  spot: SpotRow,
  role: "stop" | "overnight",
  order: number,
): DashboardPlace {
  return {
    spotId: spot.id,
    name: spot.name,
    category: spot.category,
    role,
    order,
    imageUrl: resolveSpotPreviewImage(spot),
    coords: resolveSpotCoords(spot),
    tags: spot.tags ?? [],
  };
}

function previousOvernightOrigin(
  days: DayPlanWithStops[],
  focusIndex: number,
  spotsById: Map<string, SpotRow>,
): { name: string; coords: LatLng } | null {
  for (let i = focusIndex - 1; i >= 0; i -= 1) {
    const overnightId = days[i]?.overnight_spot_id;
    if (!overnightId) continue;
    const spot = spotsById.get(overnightId);
    if (!spot) continue;
    const coords = resolveSpotCoords(spot);
    if (!coords) continue;
    return { name: spot.name, coords };
  }
  return null;
}

export function buildFeaturedDashboard(input: {
  vacation: VacationSummary;
  spots: SpotRow[];
  days: DayPlanWithStops[];
  weatherByDate: Map<string, DayWeather>;
  today?: string;
}): FeaturedDashboard {
  const today = input.today ?? todayIso();
  const { vacation, spots, days } = input;
  const phase = tripPhase(vacation, today);
  const totalDays = Math.max(1, daysBetween(vacation.start_date, vacation.end_date) + 1);
  const daysUntilStart = daysBetween(today, vacation.start_date);
  const daysUntilEnd = daysBetween(today, vacation.end_date);
  const daysSinceEnd = daysBetween(vacation.end_date, today);

  const spotsById = new Map(spots.map((spot) => [spot.id, spot]));
  const focus = findFocusDay(days, vacation, today, phase);
  const focusDay = focus?.day ?? null;
  const focusIndex = focus?.index ?? -1;

  const route = focusDay ? buildDayRoute(focusDay, spotsById, focusIndex) : null;
  const places: DashboardPlace[] = [];
  if (route) {
    for (const waypoint of route.waypoints) {
      const spot = spotsById.get(waypoint.spotId);
      if (!spot) continue;
      places.push(toPlace(spot, waypoint.role, waypoint.order));
    }
  }

  let overnight: DashboardPlace | null = null;
  if (focusDay?.overnight_spot_id) {
    const spot = spotsById.get(focusDay.overnight_spot_id);
    if (spot) {
      overnight = toPlace(spot, "overnight", places.length + 1);
      if (!places.some((place) => place.spotId === spot.id)) {
        places.push(overnight);
      }
    }
  }

  let nextLeg: DashboardLeg | null = null;
  if (route && route.legs.length > 0) {
    const leg = route.legs[0];
    const fromWp = route.waypoints.find((point) => point.spotId === leg.fromSpotId);
    const toWp = route.waypoints.find((point) => point.spotId === leg.toSpotId);
    nextLeg = {
      fromName: leg.fromName,
      toName: leg.toName,
      km: leg.km,
      minutes: leg.minutes,
      kmLabel: formatRouteKm(leg.km),
      durationLabel: formatRouteDuration(leg.minutes),
      source: leg.source,
      fromCoords: fromWp?.coords ?? null,
      toCoords: toWp?.coords ?? null,
    };
  }

  let arrivalLeg: DashboardLeg | null = null;
  const origin = focusIndex >= 0 ? previousOvernightOrigin(days, focusIndex, spotsById) : null;
  const firstPlace = places.find((place) => place.coords);
  if (origin && firstPlace?.coords) {
    const km = estimateRoadKmBetween(origin.coords, firstPlace.coords);
    const minutes = Math.max(1, Math.round((km / 65) * 60));
    arrivalLeg = {
      fromName: origin.name,
      toName: firstPlace.name,
      km,
      minutes,
      kmLabel: formatRouteKm(km),
      durationLabel: formatRouteDuration(minutes),
      source: "estimate",
      fromCoords: origin.coords,
      toCoords: firstPlace.coords,
    };
  }

  const weather = focusDay ? input.weatherByDate.get(focusDay.date) ?? null : null;
  let weatherNote: string | null = null;
  if (focusDay && !weather) {
    if (daysBetween(today, focusDay.date) > 15) {
      weatherNote = "Wettervorschau erscheint ca. 2 Wochen vor dem Tag.";
    } else if (!firstPlace?.coords && !overnight?.coords) {
      weatherNote = "Wetter braucht einen Spot mit Position.";
    }
  }

  const relevant = spots.filter((spot) => isSpotRelevant(spot));
  const assigned = new Set<string>();
  for (const day of days) {
    for (const stop of day.stops) assigned.add(stop.spot_id);
    if (day.overnight_spot_id) assigned.add(day.overnight_spot_id);
  }
  const plannedRelevantCount = relevant.filter((spot) => assigned.has(spot.id)).length;
  const daysWithStops = days.filter((day) => day.stops.length > 0).length;

  const alerts: string[] = [];
  if (phase !== "past") {
    const upcomingEmpty = days
      .filter((day) => day.date >= today)
      .filter((day) => day.stops.length === 0 && !day.overnight_spot_id)
      .slice(0, 3);
    if (upcomingEmpty.length > 0) {
      alerts.push(
        upcomingEmpty.length === 1
          ? `${formatDayLabel(upcomingEmpty[0].date)} ist noch leer.`
          : `${upcomingEmpty.length} kommende Tage sind noch leer.`,
      );
    }
    const needsOvernight =
      vacation.type === "van" || vacation.type === "camping" || vacation.type === "hotel";
    if (needsOvernight && focusDay && !focusDay.overnight_spot_id && focusDay.date >= today) {
      alerts.push(`Übernachtung für ${formatDayLabel(focusDay.date)} noch offen.`);
    }
    const openRelevant = relevant.length - plannedRelevantCount;
    if (openRelevant > 0) {
      alerts.push(
        `${openRelevant} relevante Spot${openRelevant === 1 ? "" : "s"} noch nicht eingeplant.`,
      );
    }
  }

  let heroTitle = vacation.title;
  let heroSubtitle = `${formatDayLabel(vacation.start_date)} – ${formatDayLabel(vacation.end_date)}`;
  let progress = 0;
  let dayIndex: number | null = null;

  if (phase === "upcoming") {
    if (daysUntilStart <= 0) {
      heroTitle = "Gleich geht’s los";
    } else if (daysUntilStart === 1) {
      heroTitle = "Morgen geht’s los";
    } else {
      heroTitle = `Noch ${daysUntilStart} Tage`;
    }
    heroSubtitle = `${vacation.title} · Vorfreude auf ${formatDayLabel(vacation.start_date)}`;
    progress = Math.min(0.95, Math.max(0.05, 1 - daysUntilStart / Math.max(daysUntilStart + 14, 30)));
  } else if (phase === "active") {
    dayIndex = Math.min(totalDays, Math.max(1, daysBetween(vacation.start_date, today) + 1));
    heroTitle = `Tag ${dayIndex} von ${totalDays}`;
    heroSubtitle =
      focusDay && focusDay.date === today
        ? `Heute · ${vacation.title}`
        : `Unterwegs · ${vacation.title}`;
    progress = dayIndex / totalDays;
  } else {
    heroTitle = daysSinceEnd <= 1 ? "Frisch zurück" : `Vor ${daysSinceEnd} Tagen zu Ende`;
    heroSubtitle = `${vacation.title} · Rückblick`;
    progress = 1;
  }

  if (vacation.region) {
    heroSubtitle += ` · ${vacation.region}`;
  } else {
    heroSubtitle += ` · ${vacationTypeLabel(vacation.type)}`;
  }

  return {
    vacation,
    phase,
    totalDays,
    dayIndex,
    daysUntilStart,
    daysUntilEnd,
    daysSinceEnd,
    heroTitle,
    heroSubtitle,
    progress,
    focusDate: focusDay?.date ?? null,
    focusLabel: focusDay ? formatDayLabel(focusDay.date) : null,
    focusTitle: focusDay?.title ?? (focusIndex >= 0 ? `Tag ${focusIndex + 1}` : null),
    isFocusToday: focusDay?.date === today,
    places,
    overnight,
    nextLeg,
    arrivalLeg,
    route,
    weather,
    weatherNote,
    alerts,
    relevantSpotCount: relevant.length,
    plannedRelevantCount,
    daysWithStops,
  };
}
