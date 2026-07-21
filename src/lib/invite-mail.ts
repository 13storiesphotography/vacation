import { createAdminClient } from "@/lib/supabase/admin";

export type InviteMailResult =
  | { ok: true; note: string }
  | { ok: false; note: string };

/** Send (or re-send) a Supabase auth invite email. Membership must already exist. */
export async function sendInviteEmail(
  email: string,
  redirectTo: string,
): Promise<InviteMailResult> {
  const admin = createAdminClient();
  if (!admin) {
    console.error(
      "[invite] SUPABASE_SERVICE_ROLE_KEY fehlt — E-Mail nicht gesendet.",
    );
    return {
      ok: false,
      note: "Die E-Mail konnte nicht automatisch gesendet werden. Bitte den App-Admin kontaktieren oder die Einladung manuell in Supabase senden.",
    };
  }

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (!inviteError) {
    return { ok: true, note: "Einladung per E-Mail gesendet." };
  }

  const message = inviteError.message.toLowerCase();
  const alreadyRegistered =
    message.includes("already been registered") ||
    message.includes("already registered") ||
    message.includes("user already exists");

  if (alreadyRegistered) {
    return {
      ok: true,
      note: "Dieses Konto existiert bereits — die Person kann sich einfach anmelden.",
    };
  }

  console.error("[invite] inviteUserByEmail failed:", inviteError.message);
  return {
    ok: false,
    note: "Der E-Mail-Versand ist fehlgeschlagen. Bitte später erneut versuchen.",
  };
}
