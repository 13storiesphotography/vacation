/** Detect Next.js deploy skew: client still calls an old Server Action id. */
export function isStaleServerActionError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const haystack = message.toLowerCase();
  return (
    haystack.includes("was not found on the server") ||
    haystack.includes("failed to find server action") ||
    haystack.includes("failed-to-find-server-action")
  );
}

/** Hard reload — soft reset() is not enough after a new deploy. */
export function reloadForStaleDeployment() {
  if (typeof window === "undefined") return;
  window.location.reload();
}
