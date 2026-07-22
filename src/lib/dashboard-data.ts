import { createClient } from "@/lib/supabase/server";
import { loadDayPlansClient } from "@/lib/day-plans-api";
import {
  buildFeaturedDashboard,
  pickFeaturedVacation,
  todayIso,
  type DashboardPayload,
  type FeaturedDashboard,
  type SpotRow,
  type VacationSummary,
} from "@/lib/dashboard";
import { formatRouteDuration, formatRouteKm } from "@/lib/day-route";
import { resolveSpotCoords } from "@/lib/geo";
import { enrichDayRoute, enrichDrivingLeg } from "@/lib/route-enrichment";
import { fetchDailyWeather } from "@/lib/weather";

function weatherWindow(today: string, focusDate: string | null, endDate: string) {
  const start = focusDate && focusDate >= today ? focusDate : today;
  // Open-Meteo accepts a range; keep it tight to reduce payload.
  const end = endDate < start ? start : endDate;
  return { start, end };
}

async function enrichFeaturedDayRoute(
  featured: FeaturedDashboard,
): Promise<FeaturedDashboard> {
  if (!featured.route || featured.route.legs.length === 0) return featured;
  const route = await enrichDayRoute(featured.route);
  const first = route.legs[0];
  const fromWp = first
    ? route.waypoints.find((point) => point.spotId === first.fromSpotId)
    : null;
  const toWp = first
    ? route.waypoints.find((point) => point.spotId === first.toSpotId)
    : null;
  return {
    ...featured,
    route,
    nextLeg: first
      ? {
          fromName: first.fromName,
          toName: first.toName,
          km: first.km,
          minutes: first.minutes,
          kmLabel: formatRouteKm(first.km),
          durationLabel: formatRouteDuration(first.minutes),
          source: first.source,
          fromCoords: fromWp?.coords ?? null,
          toCoords: toWp?.coords ?? null,
        }
      : featured.nextLeg,
  };
}

export async function loadDashboardPayload(): Promise<DashboardPayload> {
  const supabase = await createClient();
  const today = todayIso();

  const { data: vacations, error } = await supabase
    .from("vacations")
    .select("id, title, type, region, description, start_date, end_date")
    .order("start_date", { ascending: true });

  if (error || !vacations?.length) {
    return { featured: null, others: [] };
  }

  const list = vacations as VacationSummary[];
  const featuredVacation = pickFeaturedVacation(list, today);
  if (!featuredVacation) {
    return { featured: null, others: [] };
  }

  const others = list.filter((vacation) => vacation.id !== featuredVacation.id);

  const [{ data: spots }, dayPlans] = await Promise.all([
    supabase
      .from("spots")
      .select("*")
      .eq("vacation_id", featuredVacation.id)
      .order("created_at", { ascending: false }),
    loadDayPlansClient(supabase, featuredVacation.id),
  ]);

  const spotRows = (spots ?? []) as SpotRow[];
  const days = dayPlans.days ?? [];

  // Weather coords: prefer first planned place on focus day, else any spot with coords.
  const draft = buildFeaturedDashboard({
    vacation: featuredVacation,
    spots: spotRows,
    days,
    weatherByDate: new Map(),
    today,
  });

  let weatherByDate = new Map();
  const weatherCoords =
    draft.places.find((place) => place.coords)?.coords ??
    spotRows.map((spot) => resolveSpotCoords(spot)).find(Boolean) ??
    null;

  if (weatherCoords && draft.focusDate) {
    const window = weatherWindow(today, draft.focusDate, featuredVacation.end_date);
    // Cap end to ~16 days ahead of today for forecast validity.
    const maxEnd = new Date(`${today}T12:00:00Z`);
    maxEnd.setUTCDate(maxEnd.getUTCDate() + 15);
    const maxEndIso = maxEnd.toISOString().slice(0, 10);
    const end = window.end > maxEndIso ? maxEndIso : window.end;
    if (end >= window.start) {
      weatherByDate = await fetchDailyWeather({
        lat: weatherCoords.lat,
        lng: weatherCoords.lng,
        startDate: window.start,
        endDate: end,
      });
    }
  }

  let featured = buildFeaturedDashboard({
    vacation: featuredVacation,
    spots: spotRows,
    days,
    weatherByDate,
    today,
  });

  featured = await enrichFeaturedDayRoute(featured);

  if (featured.arrivalLeg?.fromCoords && featured.arrivalLeg?.toCoords) {
    const google = await enrichDrivingLeg(
      featured.arrivalLeg.fromCoords,
      featured.arrivalLeg.toCoords,
    );
    if (google) {
      featured = {
        ...featured,
        arrivalLeg: {
          ...featured.arrivalLeg,
          km: google.km,
          minutes: google.minutes,
          kmLabel: formatRouteKm(google.km),
          durationLabel: formatRouteDuration(google.minutes),
          source: google.source,
        },
      };
    }
  }

  return { featured, others };
}
