import { NextResponse } from "next/server";
import { enrichSmartLink } from "@/lib/smart-link";

export async function POST(request: Request) {
  let url = "";
  try {
    const body = (await request.json()) as { url?: string };
    url = String(body.url ?? "").trim();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Ungültige Anfrage.", provider: "unknown", providerLabel: "Link" },
      { status: 400 },
    );
  }

  const result = await enrichSmartLink(url);
  return NextResponse.json(result);
}
