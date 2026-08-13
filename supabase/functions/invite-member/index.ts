import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
  ].join("\n");
  const html = `<!doctype html><html><body style="font-family:sans-serif;padding:24px;">
    <h1>${title}</h1>
    <p>Du wurdest zum Vacation Planer eingeladen.</p>
    <p><a href="${params.inviteLink}">Einladung öffnen</a></p>
    <p style="word-break:break-all;font-size:12px;color:#666;">${params.inviteLink}</p>
  </body></html>`;
  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Nicht angemeldet." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Nicht angemeldet." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const vacationId = String(body.vacationId ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const redirectTo = String(body.redirectTo ?? "").trim() || undefined;
    const inviteLink = String(body.inviteLink ?? "").trim();
    const vacationTitle = String(body.vacationTitle ?? "").trim() || undefined;

    if (!vacationId || !email) {
      return new Response(
        JSON.stringify({ error: "vacationId und email sind nötig." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: canManage, error: manageError } = await userClient.rpc(
      "is_vacation_team_manager",
      { p_vacation_id: vacationId },
    );
    if (manageError) {
      const { data: isAdmin, error: adminError } = await userClient.rpc(
        "is_vacation_admin",
        { p_vacation_id: vacationId },
      );
      if (adminError || !isAdmin) {
        return new Response(
          JSON.stringify({ error: "Nur Team-Manager können einladen." }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    } else if (!canManage) {
      return new Response(
        JSON.stringify({ error: "Nur Team-Manager können einladen." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Preferred: Resend with the vacation invite link.
    const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
    if (resendKey && inviteLink) {
      const from =
        Deno.env.get("RESEND_FROM")?.trim() ||
        "Vacation Planer <onboarding@resend.dev>";
      const content = inviteEmailHtml({ inviteLink, vacationTitle });
      const mailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject: content.subject,
          html: content.html,
          text: content.text,
        }),
      });
      if (mailRes.ok) {
        return new Response(
          JSON.stringify({ ok: true, note: "Einladung per E-Mail gesendet." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      console.error("Resend failed", mailRes.status, await mailRes.text());
    }

    // Existing auth user → magic login link to the invite page.
    // New user → auth invite email.
    const list = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${serviceRole}`,
          apikey: serviceRole,
        },
      },
    );
    const listed = (await list.json()) as {
      users?: Array<{ id: string; email?: string }>;
      user?: { id: string; email?: string };
    };
    const existing =
      listed.user ??
      listed.users?.find((entry) => entry.email?.toLowerCase() === email) ??
      null;

    if (existing) {
      const { error: otpError } = await admin.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: redirectTo,
        },
      });
      if (otpError) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `E-Mail-Versand fehlgeschlagen: ${otpError.message}`,
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          note: "Login-Link per E-Mail gesendet — danach die Einladung annehmen.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo },
    );

    if (inviteError) {
      if (alreadyExistsMessage(inviteError.message)) {
        const { error: otpError } = await admin.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: redirectTo,
          },
        });
        if (!otpError) {
          return new Response(
            JSON.stringify({
              ok: true,
              note: "Login-Link per E-Mail gesendet — danach die Einladung annehmen.",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
      return new Response(
        JSON.stringify({
          ok: false,
          error: `E-Mail-Versand fehlgeschlagen: ${inviteError.message}`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, note: "Einladung per E-Mail gesendet." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
