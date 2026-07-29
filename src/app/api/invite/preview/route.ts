import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "token fehlt." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_vacation_invite", {
    p_token: token,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const invite = data?.[0];
  if (!invite) {
    return NextResponse.json({ error: "Einladung nicht gefunden oder abgelaufen." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, invite });
}
