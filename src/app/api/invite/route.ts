import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { vacationId?: string; email?: string };
  const vacationId = body.vacationId?.trim();
  const email = body.email?.trim().toLowerCase();

  if (!vacationId || !email) {
    return NextResponse.json({ error: "vacationId und email sind nötig." }, { status: 400 });
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

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRole || !url) {
    return NextResponse.json({
      ok: true,
      note: "Mitgliedschaft angelegt. SUPABASE_SERVICE_ROLE_KEY fehlt — bitte Einladung manuell im Supabase Dashboard senden (Authentication → Users → Invite).",
    });
  }

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const origin = new URL(request.url).origin;
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/set-password`,
  });

  if (inviteError) {
    return NextResponse.json({
      ok: true,
      note: `Mitgliedschaft gespeichert, E-Mail-Invite: ${inviteError.message}`,
    });
  }

  return NextResponse.json({ ok: true, note: "Einladung per E-Mail gesendet." });
}
