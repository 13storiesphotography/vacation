import { NextResponse } from "next/server";
import { isCompleteEmail, normalizeEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const admin = createAdminClient();
  if (!admin) {
    console.error(
      "[invite] SUPABASE_SERVICE_ROLE_KEY fehlt — Mitgliedschaft angelegt, E-Mail nicht gesendet.",
    );
    return NextResponse.json({
      ok: true,
      note: "Person ist eingeladen, aber die E-Mail konnte nicht automatisch gesendet werden. Bitte den App-Admin kontaktieren oder die Einladung manuell in Supabase senden.",
    });
  }

  const origin = new URL(request.url).origin;
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/set-password`,
  });

  if (inviteError) {
    console.error("[invite] inviteUserByEmail failed:", inviteError.message);
    return NextResponse.json({
      ok: true,
      note: "Person ist eingeladen, aber der E-Mail-Versand ist fehlgeschlagen. Bitte später erneut versuchen oder manuell in Supabase einladen.",
    });
  }

  return NextResponse.json({ ok: true, note: "Einladung per E-Mail gesendet." });
}
