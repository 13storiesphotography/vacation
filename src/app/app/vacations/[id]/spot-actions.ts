"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { enrichFromMapsUrl } from "@/lib/geo";
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

async function readSpotFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "ort") as SpotCategory;
  const description = String(formData.get("description") ?? "").trim();
  const mapsUrl = String(formData.get("maps_url") ?? "").trim();
  const infoUrl = String(formData.get("info_url") ?? "").trim();
  const overnightRaw = String(formData.get("overnight_cost") ?? "").trim();
  const overnightCost = (overnightRaw || null) as OvernightCost | null;
  const priceHint = String(formData.get("price_hint") ?? "").trim();
  const tags = parseTags(String(formData.get("tags") ?? ""));
  const imageUrlManual = String(formData.get("image_url") ?? "").trim();
  const previousAutoImage = String(formData.get("previous_image_url") ?? "").trim();

  let lat: number | null = null;
  let lng: number | null = null;
  let storedMapsUrl: string | null = mapsUrl || null;
  let imageUrl: string | null = imageUrlManual || null;
  let imageManual = Boolean(imageUrlManual);

  if (mapsUrl) {
    const enriched = await enrichFromMapsUrl(mapsUrl);
    if (!enriched.coords) {
      return {
        error:
          "Im Google-Maps-Link steckt keine Position. Ort in Maps öffnen und „Link teilen“ verwenden.",
      } as const;
    }
    lat = enriched.coords.lat;
    lng = enriched.coords.lng;
    storedMapsUrl = mapsUrl || enriched.resolvedUrl;
    if (!imageManual) {
      imageUrl = enriched.imageUrl || previousAutoImage || null;
      imageManual = false;
    }
  }

  return {
    fields: {
      name,
      category,
      description: description || null,
      maps_url: storedMapsUrl,
      info_url: infoUrl || null,
      overnight_cost: category === "stellplatz" ? overnightCost : null,
      price_hint: category === "stellplatz" ? priceHint || null : null,
      tags,
      lat,
      lng,
      image_url: imageUrl,
      image_manual: imageManual,
    },
  } as const;
}

export async function createSpot(
  _prev: SpotActionState,
  formData: FormData,
): Promise<SpotActionState> {
  const vacationId = String(formData.get("vacation_id") ?? "");
  const { supabase, user, error } = await requireMember(vacationId);
  if (error || !user) return { error: error ?? "Nicht angemeldet." };

  const parsed = await readSpotFields(formData);
  if ("error" in parsed) return { error: parsed.error };
  if (!parsed.fields.name) return { error: "Name ist Pflicht." };
  if (!parsed.fields.maps_url) {
    return { error: "Google-Maps-Link ist Pflicht — daraus kommt die Position." };
  }

  const { error: insertError } = await supabase.from("spots").insert({
    vacation_id: vacationId,
    created_by: user.id,
    ...parsed.fields,
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

  const parsed = await readSpotFields(formData);
  if ("error" in parsed) return { error: parsed.error };
  if (!parsed.fields.name) return { error: "Name ist Pflicht." };
  if (!parsed.fields.maps_url) {
    return { error: "Google-Maps-Link ist Pflicht — daraus kommt die Position." };
  }

  const { error: updateError } = await supabase
    .from("spots")
    .update(parsed.fields)
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
