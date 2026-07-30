import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    if (!vacationId || !email) {
      return new Response(
        JSON.stringify({ error: "vacationId und email sind nötig." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Prefer fine-grained team-manager check; fall back to admin alias.
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

    // Email only — member row is created by the Next.js /api/invite route.
    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo },
    );

    if (inviteError) {
      const message = inviteError.message.toLowerCase();
      const alreadyRegistered =
        message.includes("already been registered") ||
        message.includes("already registered") ||
        message.includes("user already exists");
      if (alreadyRegistered) {
        return new Response(
          JSON.stringify({
            ok: true,
            note: "Dieses Konto existiert bereits — die Person kann sich einfach anmelden.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
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
