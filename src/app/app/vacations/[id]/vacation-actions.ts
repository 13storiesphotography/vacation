"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  const { data: isAdmin } = await supabase.rpc("is_vacation_admin", {
    p_vacation_id: vacationId,
  });
  if (!isAdmin) {
    return { error: "Nur Admins können den Urlaub bearbeiten." };
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

  if (!title || !startDate || !endDate) {
    return { error: "Titel und Zeitraum sind Pflicht." };
  }
  if (endDate < startDate) {
    return { error: "Ende muss nach dem Start liegen." };
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
    })
    .eq("id", vacationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/vacations/${vacationId}`);
  revalidatePath("/app");
  return { ok: true };
}
