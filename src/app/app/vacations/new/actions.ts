"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CreateVacationState = {
  error?: string;
};

export async function createVacation(
  _prev: CreateVacationState,
  formData: FormData,
): Promise<CreateVacationState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Nicht angemeldet." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "van") as "van" | "hotel" | "camping" | "other";
  const region = String(formData.get("region") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");

  if (!title || !startDate || !endDate) {
    return { error: "Titel und Zeitraum sind Pflicht." };
  }

  const { data, error } = await supabase
    .from("vacations")
    .insert({
      title,
      type,
      region: region || null,
      description: description || null,
      start_date: startDate,
      end_date: endDate,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  redirect(`/app/vacations/${data.id}`);
}
