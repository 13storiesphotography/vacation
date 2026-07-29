import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

export type InviteMailResult =
  | { ok: true; note: string }
  | { ok: false; note: string };

type ServerClient = SupabaseClient<Database>;

function mapInviteErrorMessage(message: string): InviteMailResult {
  const lower = message.toLowerCase();
  const alreadyRegistered =
    lower.includes("already been registered") ||
    lower.includes("already registered") ||
    lower.includes("user already exists");

  if (alreadyRegistered) {
    return {
      ok: true,
      note: "Dieses Konto existiert bereits — die Person kann sich einfach anmelden.",
    };
  }

  return {
    ok: false,
    note: "Der E-Mail-Versand ist fehlgeschlagen. Bitte später erneut versuchen.",
  };
}

async function sendViaAdmin(
  email: string,
  redirectTo: string,
): Promise<InviteMailResult | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (!inviteError) {
    return { ok: true, note: "Einladung per E-Mail gesendet." };
  }

  console.error("[invite] inviteUserByEmail failed:", inviteError.message);
  return mapInviteErrorMessage(inviteError.message);
}

async function sendViaEdgeFunction(
  supabase: ServerClient,
  params: { vacationId: string; email: string; redirectTo: string },
): Promise<InviteMailResult> {
  const { data, error } = await supabase.functions.invoke("invite-member", {
    body: {
      vacationId: params.vacationId,
      email: params.email,
      redirectTo: params.redirectTo,
    },
  });

  if (error) {
    console.error("[invite] edge invite-member failed:", error.message);
    return {
      ok: false,
      note: "Die E-Mail konnte nicht automatisch gesendet werden. Bitte später erneut versuchen.",
    };
  }

  const payload = (data ?? {}) as { ok?: boolean; error?: string; note?: string };
  if (payload.error) {
    return { ok: false, note: payload.error };
  }

  if (payload.note) {
    const mapped = mapInviteErrorMessage(payload.note);
    if (!mapped.ok || mapped.note.includes("Konto existiert")) {
      return mapped;
    }
    // Edge sometimes returns "Member saved; invite: …" on partial success.
    if (/invite:/i.test(payload.note)) {
      return mapInviteErrorMessage(payload.note);
    }
  }

  return { ok: true, note: "Einladung per E-Mail gesendet." };
}

/**
 * Send (or re-send) a Supabase auth invite email.
 * Prefers SUPABASE_SERVICE_ROLE_KEY on the Next server; falls back to the
 * `invite-member` Edge Function (which already has the service role in Supabase).
 */
export async function sendInviteEmail(
  email: string,
  redirectTo: string,
  options?: {
    supabase?: ServerClient;
    vacationId?: string;
  },
): Promise<InviteMailResult> {
  const viaAdmin = await sendViaAdmin(email, redirectTo);
  if (viaAdmin) return viaAdmin;

  if (options?.supabase && options.vacationId) {
    console.warn(
      "[invite] SUPABASE_SERVICE_ROLE_KEY fehlt lokal — nutze Edge Function invite-member.",
    );
    return sendViaEdgeFunction(options.supabase, {
      vacationId: options.vacationId,
      email,
      redirectTo,
    });
  }

  console.error(
    "[invite] SUPABASE_SERVICE_ROLE_KEY fehlt und keine Edge-Function-Session verfügbar.",
  );
  return {
    ok: false,
    note: "Die E-Mail konnte nicht automatisch gesendet werden. Bitte den App-Admin kontaktieren oder die Einladung manuell in Supabase senden.",
  };
}
