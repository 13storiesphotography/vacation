"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractCoordsFromMapsUrl, parseLatLngFromMapsUrl } from "@/lib/geo";

export type VacationActionState = {
  error?: string;
  ok?: boolean;
};

export async function updateVacation(
  _prev: VacationActionState,
  formData: FormData,
): Promise<VacationActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Nicht angemeldet." };
  }

  const vacationId = String(formData.get("vacation_id") ?? "");
  if (!vacationId) {
    return { error: "Urlaub fehlt." };
  }

  const { data: canEditVacation } = await supabase.rpc("is_vacation_settings_editor", {
    p_vacation_id: vacationId,
  });
  if (!canEditVacation) {
    return { error: "Du darfst die Urlaubsdaten nicht bearbeiten." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "van") as
    | "van"
    | "hotel"
    | "camping"
    | "other";
  const region = String(formData.get("region") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const homeLabel = String(formData.get("home_label") ?? "").trim();
  const homeMapsUrl = String(formData.get("home_maps_url") ?? "").trim();
  const includeHome = formData.get("include_home_in_route") === "on";

  if (!title || !startDate || !endDate) {
    return { error: "Titel und Zeitraum sind Pflicht." };
  }
  if (endDate < startDate) {
    return { error: "Ende muss nach dem Start liegen." };
  }

  let homeLat: number | null = null;
  let homeLng: number | null = null;
  if (homeMapsUrl) {
    const sync = parseLatLngFromMapsUrl(homeMapsUrl);
    const extracted = sync ? null : await extractCoordsFromMapsUrl(homeMapsUrl);
    const coords = sync ?? extracted?.coords ?? null;
    if (!coords) {
      return {
        error:
          "Heimatadresse: Keine Koordinaten im Maps-Link gefunden. Bitte „Link teilen“ aus Google Maps nutzen.",
      };
    }
    homeLat = coords.lat;
    homeLng = coords.lng;
  }

  const { error } = await supabase
    .from("vacations")
    .update({
      title,
      type,
      region: region || null,
      description: description || null,
      start_date: startDate,
      end_date: endDate,
      home_label: homeLabel || (homeLat != null ? "Zuhause" : null),
      home_maps_url: homeMapsUrl || null,
      home_lat: homeLat,
      home_lng: homeLng,
      include_home_in_route: includeHome,
    })
    .eq("id", vacationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/vacations/${vacationId}`);
  revalidatePath("/app");
  return { ok: true };
}
