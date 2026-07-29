function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  // iPadOS desktop UA
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function copyViaExecCommand(value: string): boolean {
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.setAttribute("aria-hidden", "true");
  // iOS needs the field in-viewport and selectable; opacity-0 often fails.
  field.style.position = "fixed";
  field.style.top = "0";
  field.style.left = "0";
  field.style.width = "2em";
  field.style.height = "2em";
  field.style.padding = "0";
  field.style.border = "none";
  field.style.outline = "none";
  field.style.boxShadow = "none";
  field.style.background = "transparent";
  field.style.color = "transparent";
  field.style.zIndex = "-1";
  document.body.appendChild(field);

  const selection = document.getSelection();
  const previousRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  field.focus({ preventScroll: true });
  field.select();
  field.setSelectionRange(0, value.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }

  document.body.removeChild(field);
  if (selection) {
    selection.removeAllRanges();
    if (previousRange) selection.addRange(previousRange);
  }
  return ok;
}

async function shareUrl(value: string): Promise<boolean> {
  if (typeof navigator.share !== "function") return false;
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    await navigator.share({ url: value, title: "Einladung" });
    return true;
  } catch (error) {
    // AbortError = user cancelled — treat as handled, not a hard failure.
    if (error instanceof DOMException && error.name === "AbortError") return true;
    return false;
  }
}

export type CopyTextResult = "copied" | "shared" | "failed";

/**
 * Copy/share text. On iOS Safari/PWA, Clipboard API is often denied —
 * prefer execCommand, then the native share sheet.
 */
export async function copyTextToClipboard(text: string): Promise<CopyTextResult> {
  const value = text.trim();
  if (!value || typeof window === "undefined") return "failed";

  const apple = isAppleTouchDevice();

  // iOS: never lead with Clipboard API (NotAllowedError after async / in PWA).
  if (apple) {
    if (copyViaExecCommand(value)) return "copied";
    if (await shareUrl(value)) return "shared";
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return "copied";
      }
    } catch {
      // ignore — caller shows selectable link
    }
    return "failed";
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return "copied";
    }
  } catch {
    // fall through
  }

  if (copyViaExecCommand(value)) return "copied";
  if (await shareUrl(value)) return "shared";
  return "failed";
}

export function isClipboardPermissionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message || "";
  return (
    error.name === "NotAllowedError" ||
    /not allowed by the user agent/i.test(message) ||
    /clipboard/i.test(message)
  );
}
