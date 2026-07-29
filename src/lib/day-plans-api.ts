import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  defaultDayTitle,
  eachDateInclusive,
  type DayPlanWithStops,
} from "@/lib/day-plans";

type Client = SupabaseClient<Database>;

/** Ensure one day_plan row per vacation date; then load days + stops. */
export async function ensureAndLoadDayPlans(
  supabase: Client,
  vacationId: string,
  startDate: string,
  endDate: string,
): Promise<{ days: DayPlanWithStops[]; error?: string }> {
  const dates = eachDateInclusive(startDate, endDate);
  if (dates.length === 0) {
    return { days: [], error: "Ungültiger Zeitraum." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("day_plans")
    .select("*")
    .eq("vacation_id", vacationId)
    .order("date", { ascending: true });

  if (existingError) return { days: [], error: existingError.message };

  const byDate = new Map((existing ?? []).map((day) => [day.date, day]));
  const missing = dates.filter((date) => !byDate.has(date));

  if (missing.length > 0) {
    const { error: insertError } = await supabase.from("day_plans").insert(
      missing.map((date) => ({
        vacation_id: vacationId,
        date,
        title: defaultDayTitle(date, dates.indexOf(date)),
      })),
    );
    if (insertError) return { days: [], error: insertError.message };
  }

  const outside = (existing ?? []).filter((day) => !dates.includes(day.date));
  if (outside.length > 0) {
    const { error: deleteError } = await supabase
      .from("day_plans")
      .delete()
      .in(
        "id",
        outside.map((day) => day.id),
      );
    if (deleteError) return { days: [], error: deleteError.message };
  }

  return loadDayPlansClient(supabase, vacationId);
}

export async function loadDayPlansClient(
  supabase: Client,
  vacationId: string,
): Promise<{ days: DayPlanWithStops[]; error?: string }> {
  const { data: days, error: daysError } = await supabase
    .from("day_plans")
    .select("*")
    .eq("vacation_id", vacationId)
    .order("date", { ascending: true });

  if (daysError) return { days: [], error: daysError.message };
  if (!days?.length) return { days: [] };

  const { data: stops, error: stopsError } = await supabase
    .from("day_plan_spots")
    .select("*")
    .in(
      "day_plan_id",
      days.map((day) => day.id),
    )
    .order("position", { ascending: true });

  if (stopsError) return { days: [], error: stopsError.message };

  const stopsByDay = new Map<string, DayPlanWithStops["stops"]>();
  for (const stop of stops ?? []) {
    const list = stopsByDay.get(stop.day_plan_id) ?? [];
    list.push(stop);
    stopsByDay.set(stop.day_plan_id, list);
  }

  return {
    days: days.map((day) => ({
      ...day,
      stops: stopsByDay.get(day.id) ?? [],
    })),
  };
}

export async function updateDayPlanMetaClient(
  supabase: Client,
  vacationId: string,
  dayPlanId: string,
  patch: {
    title?: string | null;
    notes?: string | null;
    depart_at?: string | null;
  },
): Promise<{ error?: string; ok?: boolean }> {
  const { error } = await supabase
    .from("day_plans")
    .update({
      ...(patch.title !== undefined ? { title: patch.title?.trim() || null } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
      ...(patch.depart_at !== undefined ? { depart_at: patch.depart_at } : {}),
    })
    .eq("id", dayPlanId)
    .eq("vacation_id", vacationId);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function updateStopDwellClient(
  supabase: Client,
  dayPlanId: string,
  stopId: string,
  dwellMinutes: number | null,
): Promise<{ error?: string; ok?: boolean }> {
  const { error } = await supabase
    .from("day_plan_spots")
    .update({ dwell_minutes: dwellMinutes })
    .eq("id", stopId)
    .eq("day_plan_id", dayPlanId);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function setDayOvernightClient(
  supabase: Client,
  vacationId: string,
  dayPlanId: string,
  overnightSpotId: string | null,
): Promise<{ error?: string; ok?: boolean }> {
  if (overnightSpotId) {
    const { data: spot } = await supabase
      .from("spots")
      .select("id")
      .eq("id", overnightSpotId)
      .eq("vacation_id", vacationId)
      .maybeSingle();
    if (!spot) return { error: "Übernachtungs-Spot gehört nicht zu diesem Urlaub." };
  }

  const { error } = await supabase
    .from("day_plans")
    .update({ overnight_spot_id: overnightSpotId })
    .eq("id", dayPlanId)
    .eq("vacation_id", vacationId);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function addSpotToDayClient(
  supabase: Client,
  vacationId: string,
  dayPlanId: string,
  spotId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const [{ data: day }, { data: spot }] = await Promise.all([
    supabase
      .from("day_plans")
      .select("id")
      .eq("id", dayPlanId)
      .eq("vacation_id", vacationId)
      .maybeSingle(),
    supabase
      .from("spots")
      .select("id")
      .eq("id", spotId)
      .eq("vacation_id", vacationId)
      .maybeSingle(),
  ]);

  if (!day) return { error: "Tag nicht gefunden." };
  if (!spot) return { error: "Spot gehört nicht zu diesem Urlaub." };

  const { data: existing } = await supabase
    .from("day_plan_spots")
    .select("position")
    .eq("day_plan_id", dayPlanId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  const { error } = await supabase.from("day_plan_spots").insert({
    day_plan_id: dayPlanId,
    spot_id: spotId,
    position: nextPosition,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Spot ist an diesem Tag schon eingeplant." };
    }
    return { error: error.message };
  }

  return { ok: true };
}

export async function removeSpotFromDayClient(
  supabase: Client,
  dayPlanId: string,
  spotId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const { error } = await supabase
    .from("day_plan_spots")
    .delete()
    .eq("day_plan_id", dayPlanId)
    .eq("spot_id", spotId);

  if (error) return { error: error.message };

  await renumberDayStops(supabase, dayPlanId);
  return { ok: true };
}

export async function moveSpotOnDayClient(
  supabase: Client,
  dayPlanId: string,
  spotId: string,
  direction: "up" | "down",
): Promise<{ error?: string; ok?: boolean }> {
  const { data: stops, error: stopsError } = await supabase
    .from("day_plan_spots")
    .select("*")
    .eq("day_plan_id", dayPlanId)
    .order("position", { ascending: true });

  if (stopsError) return { error: stopsError.message };
  const list = [...(stops ?? [])];
  const index = list.findIndex((stop) => stop.spot_id === spotId);
  if (index < 0) return { error: "Stop nicht gefunden." };

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= list.length) return { ok: true };

  const tmp = list[index];
  list[index] = list[swapWith];
  list[swapWith] = tmp;

  for (const [i, stop] of list.entries()) {
    const { error: parkError } = await supabase
      .from("day_plan_spots")
      .update({ position: -(i + 1) })
      .eq("id", stop.id);
    if (parkError) return { error: parkError.message };
  }
  for (const [i, stop] of list.entries()) {
    const { error: placeError } = await supabase
      .from("day_plan_spots")
      .update({ position: i })
      .eq("id", stop.id);
    if (placeError) return { error: placeError.message };
  }

  return { ok: true };
}

async function renumberDayStops(supabase: Client, dayPlanId: string) {
  const { data: stops } = await supabase
    .from("day_plan_spots")
    .select("id")
    .eq("day_plan_id", dayPlanId)
    .order("position", { ascending: true });

  for (const [index, stop] of (stops ?? []).entries()) {
    await supabase
      .from("day_plan_spots")
      .update({ position: index })
      .eq("id", stop.id);
  }
}
