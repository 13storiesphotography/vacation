import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

export type InviteMailResult =
  | { ok: true; note: string }
  | { ok: false; note: string };

type ServerClient = SupabaseClient<Database>;

export type SendInviteEmailParams = {
  email: string;
  /** App invite URL the person should open (`/invite/{token}`). */
  inviteLink: string;
  /** Auth redirect used for magic-link / auth-invite flows. */
  redirectTo: string;
  vacationTitle?: string;
  supabase?: ServerClient;
  vacationId?: string;
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
      if (payload.user?.email?.toLowerCase() === email) return payload.user;
      const match = payload.users?.find(
        (entry) => entry.email?.toLowerCase() === email.toLowerCase(),
      );
      if (match) return match;
    }
  }

  for (let page = 1; page <= 5; page += 1) {
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

function inviteEmailHtml(params: {
  inviteLink: string;
  vacationTitle?: string;
}): { subject: string; html: string; text: string } {
  const title = params.vacationTitle?.trim() || "Vacation Planer";
  const subject = `Einladung: ${title}`;
  const text = [
    `Du wurdest zu „${title}“ eingeladen.`,
    "",
    "Öffne diesen Link, um beizutreten:",
    params.inviteLink,
    "",
    "Wenn du noch kein Konto hast, kannst du dich dort registrieren.",
    "Wenn du schon eines hast, melde dich an und nimm die Einladung an.",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#eef2f4;padding:24px;color:#142430;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px 24px;box-shadow:0 8px 28px rgba(20,36,48,.08);">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#0f6e8c;">Einladung</p>
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:rgba(20,36,48,.72);">
        Du wurdest zum gemeinsamen Urlaubsplaner eingeladen. Mit dem Button kommst du direkt zur Einladung.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${escapeAttr(params.inviteLink)}"
           style="display:inline-block;background:#142430;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 18px;border-radius:999px;">
          Einladung öffnen
        </a>
      </p>
      <p style="margin:0;font-size:12px;line-height:1.5;color:rgba(20,36,48,.5);word-break:break-all;">
        Oder Link kopieren:<br/>${escapeHtml(params.inviteLink)}
      </p>
    </div>
  </body>
</html>`;

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

/** Preferred: Resend with the real vacation invite link. */
async function sendViaResend(params: SendInviteEmailParams): Promise<InviteMailResult | null> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;

  const from =
    process.env.RESEND_FROM?.trim() || "Vacation Planer <onboarding@resend.dev>";
  const content = inviteEmailHtml({
    inviteLink: params.inviteLink,
    vacationTitle: params.vacationTitle,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.email],
      subject: content.subject,
      html: content.html,
      text: content.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[invite] Resend failed:", response.status, detail);
    return null;
  }

  return { ok: true, note: "Einladung per E-Mail gesendet." };
}

/**
 * Existing auth users: Supabase inviteUserByEmail will NOT send again.
 * Send a magic login link that lands on the vacation invite page.
 */
async function sendViaMagicLink(
  admin: SupabaseClient<Database>,
  email: string,
  redirectTo: string,
): Promise<InviteMailResult> {
  const { error } = await admin.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    console.error("[invite] magic link failed:", error.message);
    return {
      ok: false,
      note: "Der E-Mail-Versand ist fehlgeschlagen. Bitte den Link unten teilen.",
    };
  }

  return {
    ok: true,
    note: "Login-Link per E-Mail gesendet — danach die Einladung annehmen.",
  };
}

async function sendViaAuthInvite(
  admin: SupabaseClient<Database>,
  email: string,
  redirectTo: string,
): Promise<InviteMailResult> {
  const existing = await findAuthUserByEmail(admin, email);
  if (existing) {
    return sendViaMagicLink(admin, email, redirectTo);
  }

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (!inviteError) {
    return { ok: true, note: "Einladung per E-Mail gesendet." };
  }

  if (alreadyExistsMessage(inviteError.message)) {
    // Race / lookup miss — still try magic link instead of a fake success.
    return sendViaMagicLink(admin, email, redirectTo);
  }

  console.error("[invite] inviteUserByEmail failed:", inviteError.message);
  return {
    ok: false,
    note: "Der E-Mail-Versand ist fehlgeschlagen. Bitte den Link unten teilen.",
  };
}

async function sendViaEdgeFunction(
  supabase: ServerClient,
  params: SendInviteEmailParams,
): Promise<InviteMailResult> {
  const { data, error } = await supabase.functions.invoke("invite-member", {
    body: {
      vacationId: params.vacationId,
      email: params.email,
      redirectTo: params.redirectTo,
      inviteLink: params.inviteLink,
      vacationTitle: params.vacationTitle,
    },
  });

  if (error) {
    console.error("[invite] edge invite-member failed:", error.message, data);
    const payload = (data ?? {}) as { error?: string; note?: string };
    if (payload.error || payload.note) {
      return {
        ok: false,
        note:
          payload.note ??
          payload.error ??
          "Die E-Mail konnte nicht automatisch gesendet werden. Bitte den Link unten teilen.",
      };
    }
    return {
      ok: false,
      note: "Die E-Mail konnte nicht automatisch gesendet werden. Bitte den Link unten teilen.",
    };
  }

  const payload = (data ?? {}) as { ok?: boolean; error?: string; note?: string };
  if (payload.error || payload.ok === false) {
    return {
      ok: false,
      note:
        payload.note ??
        payload.error ??
        "Der E-Mail-Versand ist fehlgeschlagen. Bitte den Link unten teilen.",
    };
  }

  return {
    ok: true,
    note: payload.note ?? "Einladung per E-Mail gesendet.",
  };
}

/**
 * Send a vacation invite email.
 *
 * Prefer Resend (real invite link). Otherwise use Supabase Auth mail:
 * - new users → inviteUserByEmail
 * - existing users → magic login link to the invite page
 *   (inviteUserByEmail does not re-mail existing accounts)
 */
export async function sendInviteEmail(
  params: SendInviteEmailParams,
): Promise<InviteMailResult> {
  const viaResend = await sendViaResend(params);
  if (viaResend) return viaResend;

  const admin = createAdminClient();
  if (admin) {
    return sendViaAuthInvite(admin, params.email, params.redirectTo);
  }

  if (params.supabase && params.vacationId) {
    console.warn(
      "[invite] SUPABASE_SERVICE_ROLE_KEY fehlt lokal — nutze Edge Function invite-member.",
    );
    return sendViaEdgeFunction(params.supabase, params);
  }

  console.error(
    "[invite] Kein Mail-Provider (RESEND_API_KEY / SERVICE_ROLE / Edge) verfügbar.",
  );
  return {
    ok: false,
    note: "Die E-Mail konnte nicht automatisch gesendet werden. Bitte den Link unten teilen.",
  };
}
