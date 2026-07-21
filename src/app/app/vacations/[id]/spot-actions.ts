"use server";

import { revalidatePath } from "next/cache";
import { applySpotStayToDayPlans } from "@/lib/apply-stay";
import { createClient } from "@/lib/supabase/server";
import { isAirbnbUrl } from "@/lib/airbnb";
import {
  enrichFromMapsUrl,
  isAppMapPreviewUrl,
  isUsablePreviewImage,
  previewImageFromCoords,
} from "@/lib/geo";
import { isOvernightCategory } from "@/lib/overnight";
import { parseTags, type OvernightCost, type SpotCategory } from "@/lib/spots";
import { parseStayNights, parseStayStatus, validateStayRange } from "@/lib/stay";

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
  const stayCheckIn = String(formData.get("stay_check_in") ?? "").trim() || null;
  const stayCheckOut = String(formData.get("stay_check_out") ?? "").trim() || null;
  const stayNights = parseStayNights(String(formData.get("stay_nights") ?? ""));
  const stayStatus = parseStayStatus(String(formData.get("stay_status") ?? "").trim());
  const tags = parseTags(String(formData.get("tags") ?? ""));
  const imageUrlManual = String(formData.get("image_url") ?? "").trim();
  const previousAutoImage = String(formData.get("previous_image_url") ?? "").trim();
  const airbnbListing = isAirbnbUrl(infoUrl);
  const hasListingLink = Boolean(infoUrl);

  const stayError = isOvernightCategory(category)
    ? validateStayRange(stayCheckIn, stayCheckOut)
    : null;
  if (stayError) {
    return { error: stayError } as const;
  }

  // If dates exist but nights empty, derive nights from dates for storage.
  const resolvedNights =
    stayNights ??
    (stayCheckIn && stayCheckOut
      ? Math.max(1, Math.round(
          (Date.parse(`${stayCheckOut}T12:00:00Z`) -
            Date.parse(`${stayCheckIn}T12:00:00Z`)) /
            86_400_000,
        ))
      : null);

  let lat: number | null = null;
  let lng: number | null = null;
  let storedMapsUrl: string | null = mapsUrl || null;
  let imageUrl: string | null = imageUrlManual || null;
  let imageManual = Boolean(imageUrlManual);

  if (mapsUrl) {
    try {
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
        const preferred = enriched.imageUrl;
        const previousIsPlacePhoto =
          previousAutoImage &&
          isUsablePreviewImage(previousAutoImage) &&
          !isAppMapPreviewUrl(previousAutoImage);
        const preferredIsPlacePhoto =
          preferred &&
          isUsablePreviewImage(preferred) &&
          !isAppMapPreviewUrl(preferred);

        imageUrl =
          (preferredIsPlacePhoto ? preferred : null) ||
          (previousIsPlacePhoto ? previousAutoImage : null) ||
          (preferred && isUsablePreviewImage(preferred) ? preferred : null) ||
          (previousAutoImage && isUsablePreviewImage(previousAutoImage)
            ? previousAutoImage
            : null) ||
          (lat != null && lng != null ? previewImageFromCoords(lat, lng) : null);
        imageManual = false;
      }
    } catch (error) {
      console.error("[spot] enrichFromMapsUrl failed:", error);
      return {
        error:
          "Google-Maps-Link konnte nicht gelesen werden. Bitte Link prüfen oder Position später setzen.",
      } as const;
    }
  } else if (imageManual) {
    // Airbnb / manual image without Maps coords.
    imageManual = true;
  }

  const overnight = isOvernightCategory(category);

  return {
    fields: {
      name,
      category,
      description: description || null,
      maps_url: storedMapsUrl,
      info_url: infoUrl || null,
      overnight_cost: overnight ? overnightCost : null,
      price_hint: overnight ? priceHint || null : null,
      stay_check_in: overnight ? stayCheckIn : null,
      stay_check_out: overnight ? stayCheckOut : null,
      stay_nights: overnight ? resolvedNights : null,
      stay_status: overnight ? stayStatus : null,
      tags,
      lat,
      lng,
      image_url: imageUrl,
      image_manual: imageManual || (hasListingLink && Boolean(imageUrlManual) && !mapsUrl),
    },
    airbnbListing,
    hasListingLink,
  } as const;
}

function requireLocationOrListing(
  parsed: Awaited<ReturnType<typeof readSpotFields>>,
): { error: string } | null {
  if ("error" in parsed) {
    return { error: parsed.error || "Spot konnte nicht gelesen werden." };
  }
  if (!parsed.fields.name) return { error: "Name ist Pflicht." };
  if (!parsed.fields.maps_url && !parsed.hasListingLink) {
    return {
      error: "Bitte einen Link einfügen (Google Maps, Airbnb, Park4Night, …).",
    };
  }
  return null;
}

export async function createSpot(
  _prev: SpotActionState,
  formData: FormData,
): Promise<SpotActionState> {
  const vacationId = String(formData.get("vacation_id") ?? "");
  const { supabase, user, error } = await requireMember(vacationId);
  if (error || !user) return { error: error ?? "Nicht angemeldet." };

  const parsed = await readSpotFields(formData);
  const invalid = requireLocationOrListing(parsed);
  if (invalid) return invalid;
  if ("error" in parsed) return { error: parsed.error };

  const { data: inserted, error: insertError } = await supabase
    .from("spots")
    .insert({
      vacation_id: vacationId,
      created_by: user.id,
      ...parsed.fields,
    })
    .select("id")
    .single();

  if (insertError) return { error: insertError.message };

  if (
    inserted?.id &&
    isOvernightCategory(parsed.fields.category) &&
    (parsed.fields.stay_check_in || parsed.fields.stay_check_out)
  ) {
    const sync = await applySpotStayToDayPlans(supabase, vacationId, inserted.id, {
      stay_check_in: parsed.fields.stay_check_in,
      stay_check_out: parsed.fields.stay_check_out,
    });
    if (sync.error) return { error: sync.error };
  }

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
  const invalid = requireLocationOrListing(parsed);
  if (invalid) return invalid;
  if ("error" in parsed) return { error: parsed.error };

  const { error: updateError } = await supabase
    .from("spots")
    .update(parsed.fields)
    .eq("id", spotId)
    .eq("vacation_id", vacationId);

  if (updateError) return { error: updateError.message };

  const sync = await applySpotStayToDayPlans(supabase, vacationId, spotId, {
    stay_check_in: parsed.fields.stay_check_in,
    stay_check_out: parsed.fields.stay_check_out,
  });
  if (sync.error) return { error: sync.error };

  revalidatePath(`/app/vacations/${vacationId}`);
  return { ok: true };
}

export async function deleteSpot(vacationId: string, spotId: string): Promise<SpotActionState> {
  const { supabase, error } = await requireMember(vacationId);
  if (error) return { error };

  // Clear overnight refs first (FK may restrict), then delete.
  await supabase
    .from("day_plans")
    .update({ overnight_spot_id: null })
    .eq("vacation_id", vacationId)
    .eq("overnight_spot_id", spotId);

  const { error: deleteError } = await supabase
    .from("spots")
    .delete()
    .eq("id", spotId)
    .eq("vacation_id", vacationId);

  if (deleteError) return { error: deleteError.message };

  revalidatePath(`/app/vacations/${vacationId}`);
  return { ok: true };
}
