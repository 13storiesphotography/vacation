/** Copy text with Clipboard API, falling back when iOS drops user activation. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = text.trim();
  if (!value || typeof window === "undefined") return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Common on iOS after await: gesture is gone → permission error.
  }

  try {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.setAttribute("aria-hidden", "true");
    field.style.position = "fixed";
    field.style.top = "0";
    field.style.left = "0";
    field.style.width = "1px";
    field.style.height = "1px";
    field.style.padding = "0";
    field.style.border = "0";
    field.style.opacity = "0";
    field.style.pointerEvents = "none";
    document.body.appendChild(field);

    const selection = document.getSelection();
    const previousRange =
      selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    field.focus({ preventScroll: true });
    field.select();
    field.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");

    document.body.removeChild(field);
    if (selection) {
      selection.removeAllRanges();
      if (previousRange) selection.addRange(previousRange);
    }
    if (ok) return true;
  } catch {
    // fall through
  }

  try {
    if (typeof navigator.share === "function" && /^https?:\/\//i.test(value)) {
      await navigator.share({ url: value, title: "Einladung" });
      return true;
    }
  } catch {
    // User cancelled share or unsupported.
  }

  return false;
}
