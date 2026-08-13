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
    /** Return/create link only — no e-mail (used by „Link teilen“). */
    linkOnly?: boolean;
  };
  const vacationId = body.vacationId?.trim();
  const email = normalizeEmail(body.email ?? "");
  const memberId = body.memberId?.trim();
  const linkOnly = Boolean(body.linkOnly);
  const role = INVITE_ROLES.includes(body.role ?? "editor")
    ? ((body.role ?? "editor") as InviteRole)
    : null;

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

  const { data: canManageTeam, error: adminError } = await supabase.rpc(
    "is_vacation_team_manager",
    { p_vacation_id: vacationId },
  );
  if (adminError) {
    return NextResponse.json({ error: adminError.message }, { status: 400 });
  }
  if (!canManageTeam) {
    return NextResponse.json({ error: "Nur Team-Manager können einladen." }, { status: 403 });
  }

  let targetEmail = email;
  let targetRole: StoredRole = role ?? "editor";
  let existingStatus: "invited" | "active" | null = null;
  let existingToken: string | null = null;
  let existingExpires: string | null = null;
  let permissions = role ? permissionSetForRole(role) : null;

  if (memberId) {
    const { data: memberData, error: memberLookupError } = await supabase
      .from("vacation_members")
      .select(
        "email, role, status, invite_token, invite_expires_at, can_manage_team, can_edit_vacation, can_edit_spots, can_edit_plan",
      )
      .eq("id", memberId)
      .eq("vacation_id", vacationId)
      .single();
    if (memberLookupError || !memberData) {
      return NextResponse.json({ error: "Mitglied nicht gefunden." }, { status: 404 });
    }
    targetEmail = memberData.email;
    targetRole = memberData.role;
    existingStatus = memberData.status;
    existingToken = memberData.invite_token;
    existingExpires = memberData.invite_expires_at;
    permissions = {
      can_manage_team: memberData.can_manage_team,
      can_edit_vacation: memberData.can_edit_vacation,
      can_edit_spots: memberData.can_edit_spots,
      can_edit_plan: memberData.can_edit_plan,
    };
  } else {
    const { data: existing } = await supabase
      .from("vacation_members")
      .select("id, status, invite_token, invite_expires_at")
      .eq("vacation_id", vacationId)
      .eq("email", targetEmail)
      .maybeSingle();
    existingStatus = existing?.status ?? null;
    existingToken = existing?.invite_token ?? null;
    existingExpires = existing?.invite_expires_at ?? null;
  }

  if (existingStatus === "active" && !memberId) {
    return NextResponse.json(
      { error: "Diese Person ist bereits aktives Teammitglied." },
      { status: 400 },
    );
  }

  const origin = new URL(request.url).origin;
  const expiresMs = existingExpires ? new Date(existingExpires).getTime() : NaN;
  const existingStillValid =
    Boolean(existingToken) &&
    existingStatus === "invited" &&
    Number.isFinite(expiresMs) &&
    expiresMs > Date.now();

  // „Link teilen“: reuse the current token — do not rotate or re-mail.
  if (linkOnly && existingStillValid && existingToken) {
    return NextResponse.json({
      ok: true,
      inviteLink: `${origin}/invite/${existingToken}`,
    });
  }

  const inviteToken = crypto.randomUUID();
  const inviteExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const memberPayload = {
    vacation_id: vacationId,
    email: targetEmail,
    role: targetRole,
    status: "invited" as const,
    invited_by: user.id,
    user_id: null,
    invite_token: inviteToken,
    invite_expires_at: inviteExpiresAt,
    ...(permissions ?? permissionSetForRole("editor")),
  };

  // Prefer service-role upsert so RLS cannot block the invite row.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const writer = admin ?? supabase;
  const { error: memberError } = await writer.from("vacation_members").upsert(
    memberPayload,
    { onConflict: "vacation_id,email" },
  );
  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  const inviteLink = `${origin}/invite/${inviteToken}`;
  // After accepting the auth invite / magic link, land on the vacation invite page.
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(`/invite/${inviteToken}`)}`;

  if (linkOnly) {
    return NextResponse.json({ ok: true, inviteLink });
  }

  let vacationTitle: string | undefined;
  const { data: vacationRow } = await writer
    .from("vacations")
    .select("title")
    .eq("id", vacationId)
    .maybeSingle();
  vacationTitle = vacationRow?.title ?? undefined;

  const mail = await sendInviteEmail({
    email: targetEmail,
    inviteLink,
    redirectTo,
    vacationTitle,
    supabase,
    vacationId,
  });

  if (!mail.ok) {
    return NextResponse.json({
      ok: true,
      inviteLink,
      emailSent: false,
      note: mail.note,
    });
  }

  return NextResponse.json({
    ok: true,
    inviteLink,
    emailSent: true,
    note: mail.note,
  });
}
