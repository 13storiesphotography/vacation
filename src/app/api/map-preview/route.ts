import { NextRequest, NextResponse } from "next/server";
import { isValidLatLng } from "@/lib/geo";
import { renderMapPreviewPng } from "@/lib/map-preview";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));

  if (!isValidLatLng(lat, lng)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  try {
    const png = await renderMapPreviewPng(lat, lng);
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch (error) {
    console.error("map preview failed", error);
    return NextResponse.json({ error: "Preview failed" }, { status: 502 });
  }
}
