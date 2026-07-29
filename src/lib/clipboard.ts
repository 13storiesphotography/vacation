function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function copyViaExecCommand(value: string): boolean {
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.top = "10px";
  field.style.left = "10px";
  field.style.width = "1px";
  field.style.height = "1px";
  field.style.opacity = "0.01";
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
    const data: ShareData = { url: value, title: "Einladung" };
    if (typeof navigator.canShare === "function" && !navigator.canShare(data)) {
      return false;
    }
    await navigator.share(data);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return true;
    return false;
  }
}

/** Last-resort iOS path — prompt text is selectable/copyable. */
function promptCopy(value: string): boolean {
  try {
    const result = window.prompt("Link markieren und kopieren:", value);
    // null = cancel; any string (incl. empty edit) means the sheet was shown
    return result !== null;
  } catch {
    return false;
  }
}

export type CopyTextResult = "copied" | "shared" | "prompted" | "failed";

/**
 * Share/copy invite links. On iOS/PWA Clipboard API is unreliable —
 * lead with the native share sheet, then execCommand, then prompt().
 * Never throws NotAllowedError to callers.
 */
export async function copyTextToClipboard(text: string): Promise<CopyTextResult> {
  const value = text.trim();
  if (!value || typeof window === "undefined") return "failed";

  try {
    if (isAppleTouchDevice()) {
      // Share first while the tap gesture is still valid.
      if (await shareUrl(value)) return "shared";
      if (copyViaExecCommand(value)) return "copied";
      if (promptCopy(value)) return "prompted";
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
    if (promptCopy(value)) return "prompted";
    return "failed";
  } catch {
    try {
      if (promptCopy(value)) return "prompted";
    } catch {
      // ignore
    }
    return "failed";
  }
}

export function isClipboardPermissionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message || "";
  return (
    error.name === "NotAllowedError" ||
    /not allowed by the user agent/i.test(message) ||
    /clipboard|permission/i.test(message)
  );
}

export function friendlyClipboardError(error: unknown): string {
  if (isClipboardPermissionError(error)) {
    return "Link bereit — bitte markieren und kopieren.";
  }
  return error instanceof Error ? error.message : "Link konnte nicht geteilt werden.";
}
