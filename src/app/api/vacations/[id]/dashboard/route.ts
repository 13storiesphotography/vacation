import { NextResponse } from "next/server";
import { loadVacationDashboard } from "@/lib/dashboard-data";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Authenticated trip dashboard for one vacation (Urlaub tab). */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Urlaub fehlt." }, { status: 400 });
  }

  const loaded = await loadVacationDashboard(id);
  if (!loaded) {
    return NextResponse.json(
      { error: "Urlaub nicht gefunden oder kein Zugriff." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    featured: loaded.featured,
    days: loaded.days,
  });
}
