"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseTags, type OvernightCost, type SpotCategory } from "@/lib/spots";

export type SpotActionState = {
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

function readSpotFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "ort") as SpotCategory;
  const description = String(formData.get("description") ?? "").trim();
  const mapsUrl = String(formData.get("maps_url") ?? "").trim();
  const infoUrl = String(formData.get("info_url") ?? "").trim();
  const overnightRaw = String(formData.get("overnight_cost") ?? "").trim();
  const overnightCost = (overnightRaw || null) as OvernightCost | null;
  const priceHint = String(formData.get("price_hint") ?? "").trim();
  const tags = parseTags(String(formData.get("tags") ?? ""));
  const latRaw = String(formData.get("lat") ?? "").trim();
  const lngRaw = String(formData.get("lng") ?? "").trim();
  const lat = latRaw ? Number(latRaw) : null;
  const lng = lngRaw ? Number(lngRaw) : null;

  return {
    name,
    category,
    description: description || null,
    maps_url: mapsUrl || null,
    info_url: infoUrl || null,
    overnight_cost: category === "stellplatz" ? overnightCost : null,
    price_hint: category === "stellplatz" ? priceHint || null : null,
    tags,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

export async function createSpot(
  _prev: SpotActionState,
  formData: FormData,
): Promise<SpotActionState> {
  const vacationId = String(formData.get("vacation_id") ?? "");
  const { supabase, user, error } = await requireMember(vacationId);
  if (error || !user) return { error: error ?? "Nicht angemeldet." };

  const fields = readSpotFields(formData);
  if (!fields.name) return { error: "Name ist Pflicht." };

  const { error: insertError } = await supabase.from("spots").insert({
    vacation_id: vacationId,
    created_by: user.id,
    ...fields,
  });

  if (insertError) return { error: insertError.message };

  revalidatePath(`/app/vacations/${vacationId}`);
  return { ok: true };
}

export async function updateSpot(
  _prev: SpotActionState,
  formData: FormData,
): Promise<SpotActionState> {
  const vacationId = String(formData.get("vacation_id") ?? "");
  const spotId = String(formData.get("spot_id") ?? "");
  const { supabase, error } = await requireMember(vacationId);
  if (error) return { error };

  const fields = readSpotFields(formData);
  if (!fields.name) return { error: "Name ist Pflicht." };

  const { error: updateError } = await supabase
    .from("spots")
    .update(fields)
    .eq("id", spotId)
    .eq("vacation_id", vacationId);

  if (updateError) return { error: updateError.message };

  revalidatePath(`/app/vacations/${vacationId}`);
  return { ok: true };
}

export async function deleteSpot(vacationId: string, spotId: string): Promise<SpotActionState> {
  const { supabase, error } = await requireMember(vacationId);
  if (error) return { error };

  const { error: deleteError } = await supabase
    .from("spots")
    .delete()
    .eq("id", spotId)
    .eq("vacation_id", vacationId);

  if (deleteError) return { error: deleteError.message };

  revalidatePath(`/app/vacations/${vacationId}`);
  return { ok: true };
}
