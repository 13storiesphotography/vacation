import { NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { isCompleteEmail, normalizeEmail } from "@/lib/email";
import { sendInviteEmail } from "@/lib/invite-mail";
import { permissionSetForRole } from "@/lib/permissions";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

const INVITE_ROLES = ["viewer", "editor", "admin"] as const;
type InviteRole = (typeof INVITE_ROLES)[number];
type StoredRole = Database["public"]["Tables"]["vacation_members"]["Row"]["role"];

export async function POST(request: Request) {
  const body = (await request.json()) as {
    vacationId?: string;
    email?: string;
    role?: InviteRole;
    memberId?: string;
  };
  const vacationId = body.vacationId?.trim();
  const email = normalizeEmail(body.email ?? "");
  const memberId = body.memberId?.trim();
  const role = INVITE_ROLES.includes(body.role ?? "editor") ? (body.role ?? "editor") : null;

  if (!vacationId || (!email && !memberId) || (!memberId && !role)) {
    return NextResponse.json(
      { error: "vacationId und (email oder memberId) sind nötig." },
      { status: 400 },
    );
  }
  if (email && !isCompleteEmail(email)) {
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

  const { data: canManageTeam, error: adminError } = await supabase.rpc("is_vacation_team_manager", {
    p_vacation_id: vacationId,
  });
  if (adminError) {
    return NextResponse.json({ error: adminError.message }, { status: 400 });
  }
  if (!canManageTeam) {
    return NextResponse.json({ error: "Nur Team-Manager können einladen." }, { status: 403 });
  }

  let targetEmail = email;
  let targetRole: StoredRole = role ?? "editor";
  let existingStatus: "invited" | "active" | null = null;
  let permissions = role ? permissionSetForRole(role) : null;

  if (memberId) {
    const { data: memberData, error: memberLookupError } = await supabase
      .from("vacation_members")
      .select("email, role, status, can_manage_team, can_edit_vacation, can_edit_spots, can_edit_plan")
      .eq("id", memberId)
      .eq("vacation_id", vacationId)
      .single();
    if (memberLookupError || !memberData) {
      return NextResponse.json({ error: "Mitglied nicht gefunden." }, { status: 404 });
    }
    targetEmail = memberData.email;
    targetRole = memberData.role;
    existingStatus = memberData.status;
    permissions = {
      can_manage_team: memberData.can_manage_team,
      can_edit_vacation: memberData.can_edit_vacation,
      can_edit_spots: memberData.can_edit_spots,
      can_edit_plan: memberData.can_edit_plan,
    };
  } else {
    const { data: existing } = await supabase
      .from("vacation_members")
      .select("id, status")
      .eq("vacation_id", vacationId)
      .eq("email", targetEmail)
      .maybeSingle();
    existingStatus = existing?.status ?? null;
  }

  if (existingStatus === "active" && !memberId) {
    return NextResponse.json(
      { error: "Diese Person ist bereits aktives Teammitglied." },
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
      ...(permissions ?? permissionSetForRole("editor")),
    },
    { onConflict: "vacation_id,email" },
  );
  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const inviteLink = `${origin}/invite/${inviteToken}`;
  const mail = await sendInviteEmail(
    targetEmail,
    `${origin}/auth/callback?next=/auth/set-password`,
    { supabase, vacationId },
  );

  if (!mail.ok) {
    return NextResponse.json({
      ok: true,
      inviteLink,
      note: `Person ist eingeladen, aber ${mail.note.charAt(0).toLowerCase()}${mail.note.slice(1)}`,
    });
  }

  return NextResponse.json({ ok: true, inviteLink, note: mail.note });
}
