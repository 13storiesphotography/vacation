import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MEMBER_ROLES = ["viewer", "editor", "admin"] as const;
type MemberRole = (typeof MEMBER_ROLES)[number];

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    vacationId?: string;
    memberId?: string;
    role?: MemberRole;
  };
  const vacationId = body.vacationId?.trim();
  const memberId = body.memberId?.trim();
  const role = MEMBER_ROLES.includes(body.role ?? "viewer") ? body.role : null;

  if (!vacationId || !memberId || !role) {
    return NextResponse.json({ error: "vacationId, memberId und role sind nötig." }, { status: 400 });
  }

  const supabase = await createClient();
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
    return NextResponse.json({ error: "Nur Admins dürfen Rollen ändern." }, { status: 403 });
  }

  const { data: member, error: memberError } = await supabase
    .from("vacation_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("vacation_id", vacationId)
    .single();
  if (memberError || !member) {
    return NextResponse.json({ error: "Mitglied nicht gefunden." }, { status: 404 });
  }
  if (member.user_id === user.id && role !== "admin") {
    return NextResponse.json(
      { error: "Deine eigene Rolle kannst du nicht unter Admin herunterstufen." },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase
    .from("vacation_members")
    .update({ role })
    .eq("id", memberId)
    .eq("vacation_id", vacationId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
