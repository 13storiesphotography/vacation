import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerInviteUser } from "@/lib/invite-register";

/**
 * Invite-only registration: validates vacation invite token, then creates
 * (or unlocks) the auth user via the service role — public signups stay off.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    token?: string;
    email?: string;
    password?: string;
    displayName?: string;
  };

  const token = body.token?.trim() ?? "";
  const email = body.email ?? "";
  const password = body.password ?? "";
  const displayName = body.displayName ?? "";

  // Prefer direct admin path when the service role is available on this server.
  if (createAdminClient()) {
    const supabase = await createClient();
    const result = await registerInviteUser(supabase, {
      token,
      email,
      password,
      displayName,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      ok: true,
      vacationId: result.vacationId,
      email: result.email,
    });
  }

  // Fallback: Edge Function always has the service role inside Supabase.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return NextResponse.json(
      { error: "Supabase ist nicht konfiguriert." },
      { status: 503 },
    );
  }

  const response = await fetch(`${url}/functions/v1/register-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ token, email, password, displayName }),
  });

  const payload = (await response.json()) as {
    ok?: boolean;
    error?: string;
    vacationId?: string;
    email?: string;
  };

  if (!response.ok || !payload.ok) {
    return NextResponse.json(
      { error: payload.error ?? "Kontoanlage fehlgeschlagen." },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    vacationId: payload.vacationId,
    email: payload.email,
  });
}
