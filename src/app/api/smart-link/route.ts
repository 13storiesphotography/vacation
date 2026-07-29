import { NextResponse } from "next/server";
import { enrichSmartLink } from "@/lib/smart-link";

export async function POST(request: Request) {
  let url = "";
  try {
    const body = (await request.json()) as { url?: string };
    url = String(body.url ?? "").trim();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Ungültige Anfrage.",
        provider: "unknown",
        providerLabel: "Link",
        title: null,
        description: null,
        imageUrl: null,
        locationHint: null,
        mapsUrl: null,
        infoUrl: null,
        lat: null,
        lng: null,
        suggestedCategory: "ort",
        overnightCost: null,
      },
      { status: 400 },
    );
  }

  try {
    const result = await enrichSmartLink(url);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[smart-link]", error);
    return NextResponse.json(
      {
        ok: false,
        message:
          "Link konnte gerade nicht gelesen werden. Name/Bild ggf. manuell eintragen.",
        provider: "unknown",
        providerLabel: "Link",
        title: null,
        description: null,
        imageUrl: null,
        locationHint: null,
        mapsUrl: null,
        infoUrl: url || null,
        lat: null,
        lng: null,
        suggestedCategory: "ort",
        overnightCost: null,
      },
      { status: 200 },
    );
  }
}
