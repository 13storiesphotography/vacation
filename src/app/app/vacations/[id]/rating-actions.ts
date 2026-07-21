"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RatingActionState = {
  error?: string;
  ok?: boolean;
};

export async function upsertSpotRating(input: {
  vacationId: string;
  spotId: string;
  rating?: number | null;
  isFavorite?: boolean;
  note?: string | null;
}): Promise<RatingActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: isMember } = await supabase.rpc("is_vacation_member", {
    p_vacation_id: input.vacationId,
  });
  if (!isMember) return { error: "Kein Zugriff." };

  const payload: {
    spot_id: string;
    user_id: string;
    rating?: number | null;
    is_favorite?: boolean;
    note?: string | null;
  } = {
    spot_id: input.spotId,
    user_id: user.id,
  };

  if (input.rating !== undefined) {
    payload.rating = input.rating;
  }
  if (input.isFavorite !== undefined) {
    payload.is_favorite = input.isFavorite;
  }
  if (input.note !== undefined) {
    payload.note = input.note;
  }

  const { error } = await supabase.from("spot_ratings").upsert(payload, {
    onConflict: "spot_id,user_id",
  });

  if (error) return { error: error.message };

  revalidatePath(`/app/vacations/${input.vacationId}`);
  return { ok: true };
}
