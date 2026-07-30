import { NextResponse } from "next/server";
import { sendInviteEmail } from "@/lib/invite-mail";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { User } from "@supabase/supabase-js";

type Member = Database["public"]["Tables"]["vacation_members"]["Row"];
type ServerClient = Awaited<ReturnType<typeof createServerSupabase>>;

type AdminContext =
  | { ok: true; supabase: ServerClient; user: User }
  | { ok: false; response: NextResponse };

async function requireVacationAdmin(vacationId: string): Promise<AdminContext> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 }),
    };
  }

  const { data: canManageTeam, error: adminError } = await supabase.rpc(
    "is_vacation_team_manager",
    {
      p_vacation_id: vacationId,
    },
  );
  if (adminError) {
    return {
      ok: false,
      response: NextResponse.json({ error: adminError.message }, { status: 400 }),
    };
  }
  if (!canManageTeam) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Nur Team-Manager können das Team verwalten." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, supabase, user };
}

async function loadMember(
  supabase: ServerClient,
  vacationId: string,
  memberId: string,
): Promise<{ member: Member } | { response: NextResponse }> {
  const { data: member, error } = await supabase
    .from("vacation_members")
    .select("*")
    .eq("id", memberId)
    .eq("vacation_id", vacationId)
    .maybeSingle();

  if (error) {
    return { response: NextResponse.json({ error: error.message }, { status: 400 }) };
  }
  if (!member) {
    return {
      response: NextResponse.json({ error: "Mitglied nicht gefunden." }, { status: 404 }),
    };
  }
  return { member };
}

/** Resend invite email for an invited member. */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    vacationId?: string;
    memberId?: string;
    action?: string;
  };
  const vacationId = body.vacationId?.trim();
  const memberId = body.memberId?.trim();
  const action = body.action?.trim() || "resend";

  if (!vacationId || !memberId) {
    return NextResponse.json(
      { error: "vacationId und memberId sind nötig." },
      { status: 400 },
    );
  }
  if (action !== "resend") {
    return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
  }

  const auth = await requireVacationAdmin(vacationId);
  if (!auth.ok) return auth.response;

  const loaded = await loadMember(auth.supabase, vacationId, memberId);
  if ("response" in loaded) return loaded.response;
  const { member } = loaded;

  if (member.status !== "invited") {
    return NextResponse.json(
      { error: "Nur offene Einladungen können erneut gesendet werden." },
      { status: 400 },
    );
  }

  const origin = new URL(request.url).origin;
  const token = member.invite_token?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "Für diese Einladung fehlt ein gültiger Link." },
      { status: 400 },
    );
  }

  const inviteLink = `${origin}/invite/${token}`;
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(`/invite/${token}`)}`;

  let vacationTitle: string | undefined;
  const { data: vacationRow } = await auth.supabase
    .from("vacations")
    .select("title")
    .eq("id", vacationId)
    .maybeSingle();
  vacationTitle = vacationRow?.title ?? undefined;

  const mail = await sendInviteEmail({
    email: member.email,
    inviteLink,
    redirectTo,
    vacationTitle,
    supabase: auth.supabase,
    vacationId,
  });

  if (!mail.ok) {
    return NextResponse.json(
      { error: mail.note, inviteLink, emailSent: false },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, note: mail.note, inviteLink, emailSent: true });
}

/** Withdraw an invite or remove a member from the vacation. */
export async function DELETE(request: Request) {
  const body = (await request.json()) as {
    vacationId?: string;
    memberId?: string;
  };
  const vacationId = body.vacationId?.trim();
  const memberId = body.memberId?.trim();

  if (!vacationId || !memberId) {
    return NextResponse.json(
      { error: "vacationId und memberId sind nötig." },
      { status: 400 },
    );
  }

  const auth = await requireVacationAdmin(vacationId);
  if (!auth.ok) return auth.response;

  const loaded = await loadMember(auth.supabase, vacationId, memberId);
  if ("response" in loaded) return loaded.response;
  const { member } = loaded;

  if (member.user_id && member.user_id === auth.user.id) {
    return NextResponse.json(
      { error: "Du kannst dich nicht selbst entfernen." },
      { status: 400 },
    );
  }

  if (member.can_manage_team && member.status === "active") {
    const { count, error: countError } = await auth.supabase
      .from("vacation_members")
      .select("id", { count: "exact", head: true })
      .eq("vacation_id", vacationId)
      .eq("can_manage_team", true)
      .eq("status", "active");

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Der letzte Team-Manager kann nicht entfernt werden." },
        { status: 400 },
      );
    }
  }

  const { error: deleteError } = await auth.supabase
    .from("vacation_members")
    .delete()
    .eq("id", member.id)
    .eq("vacation_id", vacationId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  const note =
    member.status === "invited" ? "Einladung zurückgezogen." : "Mitglied entfernt.";

  return NextResponse.json({ ok: true, note });
}
