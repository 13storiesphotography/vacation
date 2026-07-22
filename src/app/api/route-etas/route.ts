import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidLatLng, type LatLng } from "@/lib/geo";
import { computeDrivingRoute } from "@/lib/google-routes";

export const runtime = "nodejs";

const MAX_POINTS = 25;

type Body = {
  points?: Array<{ lat?: unknown; lng?: unknown }>;
};

function parsePoints(raw: Body["points"]): LatLng[] | null {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > MAX_POINTS) return null;
  const points: LatLng[] = [];
  for (const entry of raw) {
    const lat = typeof entry?.lat === "number" ? entry.lat : Number(entry?.lat);
    const lng = typeof entry?.lng === "number" ? entry.lng : Number(entry?.lng);
    if (!isValidLatLng(lat, lng)) return null;
    points.push({ lat, lng });
  }
  return points;
}

/** Authenticated driving ETAs via Google Routes API. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }

  const points = parsePoints(body.points);
  if (!points) {
    return NextResponse.json(
      { error: "2–25 gültige Koordinaten nötig." },
      { status: 400 },
    );
  }

  const result = await computeDrivingRoute(points);
  if (!result) {
    return NextResponse.json(
      {
        error: "Routenzeit nicht verfügbar.",
        available: false,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    available: true,
    source: "google",
    legs: result.legs,
    totalKm: result.totalKm,
    totalMinutes: result.totalMinutes,
    encodedPolyline: result.encodedPolyline,
  });
}
