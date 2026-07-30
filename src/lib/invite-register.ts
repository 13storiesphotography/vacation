import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCompleteEmail, normalizeEmail } from "@/lib/email";
import type { Database } from "@/lib/database.types";

export type RegisterInviteInput = {
  token: string;
  email: string;
  password: string;
  displayName: string;
};

export type RegisterInviteResult =
  | { ok: true; vacationId: string; email: string }
  | { ok: false; error: string; status: number };

type InviteRow = {
  vacation_id: string;
  email: string;
  status: string;
  invite_expires_at: string | null;
};

function alreadyExistsMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("already been registered") ||
    lower.includes("already registered") ||
    lower.includes("user already exists") ||
    lower.includes("email_exists")
  );
}

async function findAuthUserByEmail(
  admin: SupabaseClient<Database>,
  email: string,
): Promise<User | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && serviceRole) {
    const response = await fetch(
      `${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${serviceRole}`,
          apikey: serviceRole,
        },
        cache: "no-store",
      },
    );
    if (response.ok) {
      const payload = (await response.json()) as { users?: User[]; user?: User };
      if (payload.user?.id) return payload.user;
      const match = payload.users?.find(
        (entry) => entry.email?.toLowerCase() === email.toLowerCase(),
      );
      if (match) return match;
    }
  }

  // Fallback: paginate (small projects).
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const match = data.users.find(
      (entry) => entry.email?.toLowerCase() === email.toLowerCase(),
    );
    if (match) return match;
    if (data.users.length < 200) break;
  }
  return null;
}

async function ensureProfileName(
  admin: SupabaseClient<Database>,
  userId: string,
  displayName: string,
) {
  const name = displayName.trim();
  if (!name) return;
  await admin.from("profiles").upsert({ id: userId, display_name: name });
}

/**
 * Create (or unlock) an auth user for a valid vacation invite.
 * Public signups stay disabled — only the service role creates accounts.
 */
export async function registerInviteUser(
  supabase: SupabaseClient<Database>,
  input: RegisterInviteInput,
): Promise<RegisterInviteResult> {
  const token = input.token.trim();
  const email = normalizeEmail(input.email);
  const password = input.password;
  const displayName = input.displayName.trim();

  if (!token) {
    return { ok: false, error: "Einladungs-Token fehlt.", status: 400 };
  }
  if (!isCompleteEmail(email)) {
    return { ok: false, error: "Bitte eine gültige E-Mail eingeben.", status: 400 };
  }
  if (password.length < 8) {
    return { ok: false, error: "Passwort mindestens 8 Zeichen.", status: 400 };
  }
  if (!displayName) {
    return { ok: false, error: "Bitte einen Namen eingeben.", status: 400 };
  }

  const { data, error } = await supabase.rpc("get_vacation_invite", {
    p_token: token,
  });
  if (error) {
    return { ok: false, error: error.message, status: 400 };
  }

  const invite = (data?.[0] ?? null) as InviteRow | null;
  if (!invite) {
    return {
      ok: false,
      error: "Einladung nicht gefunden oder bereits angenommen.",
      status: 404,
    };
  }

  if (normalizeEmail(invite.email) !== email) {
    return {
      ok: false,
      error: `Die Einladung gilt nur für ${invite.email}.`,
      status: 403,
    };
  }

  if (invite.invite_expires_at) {
    const expires = new Date(invite.invite_expires_at).getTime();
    if (Number.isFinite(expires) && expires <= Date.now()) {
      return { ok: false, error: "Diese Einladung ist abgelaufen.", status: 410 };
    }
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Kontoanlage ist serverseitig nicht konfiguriert (SERVICE_ROLE fehlt). Bitte Admin kontaktieren.",
      status: 503,
    };
  }

  const meta = { display_name: displayName };

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: meta,
  });

  if (!createError && created.user) {
    await ensureProfileName(admin, created.user.id, displayName);
    return { ok: true, vacationId: invite.vacation_id, email };
  }

  if (createError && alreadyExistsMessage(createError.message)) {
    const existing = await findAuthUserByEmail(admin, email);
    if (!existing) {
      return {
        ok: false,
        error:
          "Dieses Konto existiert schon — bitte anmelden statt neu registrieren.",
        status: 409,
      };
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { ...existing.user_metadata, ...meta },
    });
    if (updateError) {
      return { ok: false, error: updateError.message, status: 400 };
    }

    await ensureProfileName(admin, existing.id, displayName);
    return { ok: true, vacationId: invite.vacation_id, email };
  }

  return {
    ok: false,
    error: createError?.message ?? "Konto konnte nicht angelegt werden.",
    status: 400,
  };
}
