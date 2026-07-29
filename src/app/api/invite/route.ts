import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

const INVITE_ROLES = ["viewer", "editor", "admin"] as const;
type InviteRole = (typeof INVITE_ROLES)[number];

export async function POST(request: Request) {
  const body = (await request.json()) as {
    vacationId?: string;
    email?: string;
    role?: InviteRole;
    memberId?: string;
  };
  const vacationId = body.vacationId?.trim();
  const email = body.email?.trim().toLowerCase();
  const role = INVITE_ROLES.includes(body.role ?? "editor") ? (body.role ?? "editor") : null;
  const memberId = body.memberId?.trim();

  if (!vacationId || (!email && !memberId) || !role) {
    return NextResponse.json(
      { error: "vacationId und (email oder memberId) sind nötig." },
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

  let targetEmail = email ?? "";
  let targetRole = role;
  let existingStatus: "invited" | "active" | null = null;

  if (memberId) {
    const { data: memberData, error: memberLookupError } = await supabase
      .from("vacation_members")
      .select("email, role, status")
      .eq("id", memberId)
      .eq("vacation_id", vacationId)
      .single();
    if (memberLookupError || !memberData) {
      return NextResponse.json({ error: "Mitglied nicht gefunden." }, { status: 404 });
    }
    targetEmail = memberData.email;
    targetRole = memberData.role;
    existingStatus = memberData.status;
  } else {
    const { data: existingMember } = await supabase
      .from("vacation_members")
      .select("status")
      .eq("vacation_id", vacationId)
      .eq("email", targetEmail)
      .maybeSingle();
    existingStatus = existingMember?.status ?? null;
  }

  if (existingStatus === "active" && !memberId) {
    return NextResponse.json(
      { error: "Diese Person ist bereits aktiv im Team. Rolle unten direkt ändern." },
      { status: 400 },
    );
  }

  const inviteToken = crypto.randomUUID();
  const inviteExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { error: memberError } = await supabase.from("vacation_members").upsert(
    {
      vacation_id: vacationId,
      email: targetEmail,
      role: targetRole,
      status: "invited",
      invited_by: user.id,
      user_id: null,
      invite_token: inviteToken,
      invite_expires_at: inviteExpiresAt,
    },
    { onConflict: "vacation_id,email" },
  );
  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const inviteLink = `${origin}/invite/${inviteToken}`;

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRole || !url) {
    return NextResponse.json({
      ok: true,
      inviteLink,
      note: "Einladungslink erstellt. E-Mail-Versand ist in dieser Umgebung nicht aktiv.",
    });
  }

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(targetEmail, {
    redirectTo: `${origin}/auth/callback?next=/auth/set-password`,
  });

  if (inviteError) {
    return NextResponse.json({
      ok: true,
      inviteLink,
      note: `Einladungslink erstellt. E-Mail-Invite: ${inviteError.message}`,
    });
  }

  return NextResponse.json({
    ok: true,
    inviteLink,
    note: "Einladung per E-Mail gesendet und als Link bereitgestellt.",
  });
}
