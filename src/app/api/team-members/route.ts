import { NextResponse } from "next/server";
import { permissionSetForRole, pickPermissions, roleForPermissions } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

const MEMBER_ROLES = ["viewer", "editor", "admin"] as const;
type MemberRole = (typeof MEMBER_ROLES)[number];

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    vacationId?: string;
    memberId?: string;
    role?: MemberRole;
    can_manage_team?: boolean;
    can_edit_vacation?: boolean;
    can_edit_spots?: boolean;
    can_edit_plan?: boolean;
  };
  const vacationId = body.vacationId?.trim();
  const memberId = body.memberId?.trim();
  const role = body.role && MEMBER_ROLES.includes(body.role) ? body.role : null;

  if (!vacationId || !memberId) {
    return NextResponse.json({ error: "vacationId und memberId sind nötig." }, { status: 400 });
  }

  const supabase = await createClient();
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
    return NextResponse.json({ error: "Nur Team-Manager dürfen Rechte ändern." }, { status: 403 });
  }

  const { data: member, error: memberError } = await supabase
    .from("vacation_members")
    .select("id, user_id, role, can_manage_team, can_edit_vacation, can_edit_spots, can_edit_plan")
    .eq("id", memberId)
    .eq("vacation_id", vacationId)
    .single();
  if (memberError || !member) {
    return NextResponse.json({ error: "Mitglied nicht gefunden." }, { status: 404 });
  }
  const nextPermissions = role
    ? permissionSetForRole(role)
    : pickPermissions({
        can_manage_team: body.can_manage_team ?? member.can_manage_team,
        can_edit_vacation: body.can_edit_vacation ?? member.can_edit_vacation,
        can_edit_spots: body.can_edit_spots ?? member.can_edit_spots,
        can_edit_plan: body.can_edit_plan ?? member.can_edit_plan,
      });
  const nextRole = role ?? roleForPermissions(nextPermissions);

  if (member.user_id === user.id && !nextPermissions.can_manage_team) {
    return NextResponse.json(
      { error: "Du kannst dir selbst nicht das Team-Verwaltungsrecht entziehen." },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase
    .from("vacation_members")
    .update({ role: nextRole, ...nextPermissions })
    .eq("id", memberId)
    .eq("vacation_id", vacationId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
