"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  defaultDayTitle,
  eachDateInclusive,
  type DayPlan,
  type DayPlanSpot,
  type DayPlanWithStops,
} from "@/lib/day-plans";

export type PlanActionState = {
  error?: string;
  ok?: boolean;
};

async function requireMember(vacationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null, error: "Nicht angemeldet." as const };
  }

  const { data: isMember } = await supabase.rpc("is_vacation_member", {
    p_vacation_id: vacationId,
  });
  if (!isMember) {
    return { supabase, user, error: "Kein Zugriff auf diesen Urlaub." as const };
  }

  return { supabase, user, error: null };
}

function revalidateVacation(vacationId: string) {
  revalidatePath(`/app/vacations/${vacationId}`);
}

/** Ensure one day_plan row per vacation date; remove days outside the range. */
export async function ensureVacationDayPlans(
  vacationId: string,
): Promise<{ days: DayPlanWithStops[]; error?: string }> {
  const { supabase, error } = await requireMember(vacationId);
  if (error) return { days: [], error };

  const { data: vacation, error: vacationError } = await supabase
    .from("vacations")
    .select("start_date, end_date")
    .eq("id", vacationId)
    .single();

  if (vacationError || !vacation) {
    return { days: [], error: vacationError?.message ?? "Urlaub nicht gefunden." };
  }

  const dates = eachDateInclusive(vacation.start_date, vacation.end_date);
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
      missing.map((date, index) => ({
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

  return loadDayPlans(vacationId);
}

export async function loadDayPlans(
  vacationId: string,
): Promise<{ days: DayPlanWithStops[]; error?: string }> {
  const { supabase, error } = await requireMember(vacationId);
  if (error) return { days: [], error };

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

  const stopsByDay = new Map<string, DayPlanSpot[]>();
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

export async function updateDayPlanMeta(
  vacationId: string,
  dayPlanId: string,
  patch: { title?: string | null; notes?: string | null },
): Promise<PlanActionState> {
  const { supabase, error } = await requireMember(vacationId);
  if (error) return { error };

  const { error: updateError } = await supabase
    .from("day_plans")
    .update({
      ...(patch.title !== undefined ? { title: patch.title?.trim() || null } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
    })
    .eq("id", dayPlanId)
    .eq("vacation_id", vacationId);

  if (updateError) return { error: updateError.message };
  revalidateVacation(vacationId);
  return { ok: true };
}

export async function setDayOvernight(
  vacationId: string,
  dayPlanId: string,
  overnightSpotId: string | null,
): Promise<PlanActionState> {
  const { supabase, error } = await requireMember(vacationId);
  if (error) return { error };

  if (overnightSpotId) {
    const { data: spot } = await supabase
      .from("spots")
      .select("id")
      .eq("id", overnightSpotId)
      .eq("vacation_id", vacationId)
      .maybeSingle();
    if (!spot) return { error: "Übernachtungs-Spot gehört nicht zu diesem Urlaub." };
  }

  const { error: updateError } = await supabase
    .from("day_plans")
    .update({ overnight_spot_id: overnightSpotId })
    .eq("id", dayPlanId)
    .eq("vacation_id", vacationId);

  if (updateError) return { error: updateError.message };
  revalidateVacation(vacationId);
  return { ok: true };
}

export async function addSpotToDay(
  vacationId: string,
  dayPlanId: string,
  spotId: string,
): Promise<PlanActionState> {
  const { supabase, error } = await requireMember(vacationId);
  if (error) return { error };

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

  const { error: insertError } = await supabase.from("day_plan_spots").insert({
    day_plan_id: dayPlanId,
    spot_id: spotId,
    position: nextPosition,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: "Spot ist an diesem Tag schon eingeplant." };
    }
    return { error: insertError.message };
  }

  revalidateVacation(vacationId);
  return { ok: true };
}

export async function removeSpotFromDay(
  vacationId: string,
  dayPlanId: string,
  spotId: string,
): Promise<PlanActionState> {
  const { supabase, error } = await requireMember(vacationId);
  if (error) return { error };

  const { error: deleteError } = await supabase
    .from("day_plan_spots")
    .delete()
    .eq("day_plan_id", dayPlanId)
    .eq("spot_id", spotId);

  if (deleteError) return { error: deleteError.message };

  await renumberDayStops(supabase, dayPlanId);
  revalidateVacation(vacationId);
  return { ok: true };
}

export async function moveSpotOnDay(
  vacationId: string,
  dayPlanId: string,
  spotId: string,
  direction: "up" | "down",
): Promise<PlanActionState> {
  const { supabase, error } = await requireMember(vacationId);
  if (error) return { error };

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

  // Avoid unique/race issues: park on negative positions, then renumber 0..n
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

  revalidateVacation(vacationId);
  return { ok: true };
}

async function renumberDayStops(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dayPlanId: string,
) {
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

export type { DayPlan, DayPlanWithStops };
