"use server";

import { enrichSmartLink, type SmartLinkResult } from "@/lib/smart-link";

export type { SmartLinkResult };

export async function previewSmartLink(url: string): Promise<SmartLinkResult> {
  return enrichSmartLink(url);
}
