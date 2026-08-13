import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const COMPLETE_EMAIL =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function alreadyExistsMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("already been registered") ||
    lower.includes("already registered") ||
    lower.includes("user already exists") ||
    lower.includes("email_exists")
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const body = await req.json();
    const token = String(body.token ?? "").trim();
    const email = normalizeEmail(String(body.email ?? ""));
    const password = String(body.password ?? "");
    const displayName = String(body.displayName ?? "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "Einladungs-Token fehlt." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!COMPLETE_EMAIL.test(email)) {
      return new Response(JSON.stringify({ error: "Bitte eine gültige E-Mail eingeben." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Passwort mindestens 8 Zeichen." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!displayName) {
      return new Response(JSON.stringify({ error: "Bitte einen Namen eingeben." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: inviteRows, error: inviteError } = await admin.rpc(
      "get_vacation_invite",
      { p_token: token },
    );
    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invite = inviteRows?.[0] as
      | {
          vacation_id: string;
          email: string;
          invite_expires_at: string | null;
        }
      | undefined;

    if (!invite) {
      return new Response(
        JSON.stringify({ error: "Einladung nicht gefunden oder bereits angenommen." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (normalizeEmail(invite.email) !== email) {
      return new Response(
        JSON.stringify({ error: `Die Einladung gilt nur für ${invite.email}.` }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (invite.invite_expires_at) {
      const expires = new Date(invite.invite_expires_at).getTime();
      if (Number.isFinite(expires) && expires <= Date.now()) {
        return new Response(JSON.stringify({ error: "Diese Einladung ist abgelaufen." }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const meta = { display_name: displayName };
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: meta,
    });

    async function finish(userId: string) {
      await admin.from("profiles").upsert({ id: userId, display_name: displayName });
      return new Response(
        JSON.stringify({ ok: true, vacationId: invite.vacation_id, email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!createError && created.user) {
      return await finish(created.user.id);
    }

    if (createError && alreadyExistsMessage(createError.message)) {
      const list = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
        {
          headers: {
            Authorization: `Bearer ${serviceRole}`,
            apikey: serviceRole,
          },
        },
      );
      const payload = (await list.json()) as {
        users?: Array<{ id: string; user_metadata?: Record<string, unknown> }>;
        user?: { id: string; user_metadata?: Record<string, unknown> };
      };
      const existing =
        payload.user ??
        payload.users?.find((entry) => entry.id) ??
        null;

      if (!existing) {
        return new Response(
          JSON.stringify({
            error: "Dieses Konto existiert schon — bitte anmelden statt neu registrieren.",
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { ...(existing.user_metadata ?? {}), ...meta },
      });
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return await finish(existing.id);
    }

    return new Response(
      JSON.stringify({
        error: createError?.message ?? "Konto konnte nicht angelegt werden.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
