import { NextResponse } from "next/server";
import { isCompleteEmail, normalizeEmail } from "@/lib/email";
import { sendInviteEmail } from "@/lib/invite-mail";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { vacationId?: string; email?: string };
  const vacationId = body.vacationId?.trim();
  const email = normalizeEmail(body.email ?? "");

  if (!vacationId || !email) {
    return NextResponse.json({ error: "vacationId und email sind nötig." }, { status: 400 });
  }
  if (!isCompleteEmail(email)) {
    return NextResponse.json(
      { error: "Bitte gib eine vollständige E-Mail-Adresse ein (z. B. name@domain.de)." },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_vacation_admin", {
    p_vacation_id: vacationId,
  });
  if (adminError) {
    return NextResponse.json({ error: adminError.message }, { status: 400 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: "Nur Admins können einladen." }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from("vacation_members")
    .select("id, status")
    .eq("vacation_id", vacationId)
    .eq("email", email)
    .maybeSingle();

  if (existing?.status === "active") {
    return NextResponse.json(
      { error: "Diese Person ist bereits aktives Teammitglied." },
      { status: 400 },
    );
  }

  const { error: memberError } = await supabase.from("vacation_members").upsert(
    {
      vacation_id: vacationId,
      email,
      role: "member",
      status: "invited",
      invited_by: user.id,
    },
    { onConflict: "vacation_id,email" },
  );
  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const mail = await sendInviteEmail(
    email,
    `${origin}/auth/callback?next=/auth/set-password`,
    { supabase, vacationId },
  );

  if (!mail.ok) {
    return NextResponse.json({
      ok: true,
      note: `Person ist eingeladen, aber ${mail.note.charAt(0).toLowerCase()}${mail.note.slice(1)}`,
    });
  }

  return NextResponse.json({ ok: true, note: mail.note });
}
