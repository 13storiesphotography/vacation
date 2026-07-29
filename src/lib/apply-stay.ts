import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { ensureAndLoadDayPlans } from "@/lib/day-plans-api";
import { stayNightDates, type StayStatus } from "@/lib/stay";

type Client = SupabaseClient<Database>;

type StaySpotRow = {
  id: string;
  stay_check_in: string | null;
  stay_check_out: string | null;
  stay_status: StayStatus | null;
};

/**
 * Sync day_plans.overnight_spot_id from a spot's stay window.
 * - Clears this spot from nights outside the window
 * - Assigns nights in [check_in, check_out) when free or already this spot
 * - Does not overwrite another spot that itself has a stay window
 */
export async function applySpotStayToDayPlans(
  supabase: Client,
  vacationId: string,
  spotId: string,
  stay: {
    stay_check_in: string | null;
    stay_check_out: string | null;
  },
): Promise<{ error?: string; updated?: number }> {
  const { data: vacation, error: vacationError } = await supabase
    .from("vacations")
    .select("start_date, end_date")
    .eq("id", vacationId)
    .single();

  if (vacationError || !vacation) {
    return { error: vacationError?.message ?? "Urlaub nicht gefunden." };
  }

  const ensured = await ensureAndLoadDayPlans(
    supabase,
    vacationId,
    vacation.start_date,
    vacation.end_date,
  );
  if (ensured.error) return { error: ensured.error };

  const nightDates = new Set(
    stayNightDates(stay.stay_check_in, stay.stay_check_out).filter(
      (date) => date >= vacation.start_date && date <= vacation.end_date,
    ),
  );

  // Load sibling overnight spots with stay windows (for conflict checks).
  const { data: staySpots, error: staySpotsError } = await supabase
    .from("spots")
    .select("id, stay_check_in, stay_check_out, stay_status")
    .eq("vacation_id", vacationId)
    .not("stay_check_in", "is", null);

  if (staySpotsError) return { error: staySpotsError.message };

  const stayById = new Map<string, StaySpotRow>();
  for (const row of (staySpots ?? []) as StaySpotRow[]) {
    stayById.set(row.id, row);
  }

  let updated = 0;

  for (const day of ensured.days) {
    const wantsThis = nightDates.has(day.date);
    const current = day.overnight_spot_id;

    if (current === spotId && !wantsThis) {
      const { error } = await supabase
        .from("day_plans")
        .update({ overnight_spot_id: null })
        .eq("id", day.id)
        .eq("vacation_id", vacationId);
      if (error) return { error: error.message };
      updated += 1;
      continue;
    }

    if (!wantsThis) continue;
    if (current === spotId) continue;

    if (current) {
      const other = stayById.get(current);
      // Protect another planned stay.
      if (other?.stay_check_in && other?.stay_check_out) continue;
    }

    const { error } = await supabase
      .from("day_plans")
      .update({ overnight_spot_id: spotId })
      .eq("id", day.id)
      .eq("vacation_id", vacationId);
    if (error) return { error: error.message };
    updated += 1;
  }

  return { updated };
}

/** Re-apply all spots that have a stay window (e.g. on Plan open). */
export async function syncAllSpotStays(
  supabase: Client,
  vacationId: string,
): Promise<{ error?: string }> {
  const { data: spots, error } = await supabase
    .from("spots")
    .select("id, stay_check_in, stay_check_out")
    .eq("vacation_id", vacationId)
    .not("stay_check_in", "is", null)
    .order("stay_check_in", { ascending: true });

  if (error) return { error: error.message };

  for (const spot of spots ?? []) {
    const result = await applySpotStayToDayPlans(supabase, vacationId, spot.id, {
      stay_check_in: spot.stay_check_in,
      stay_check_out: spot.stay_check_out,
    });
    if (result.error) return { error: result.error };
  }

  return {};
}
