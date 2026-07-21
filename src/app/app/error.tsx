"use client";

import { useEffect } from "react";
import {
  isStaleServerActionError,
  reloadForStaleDeployment,
} from "@/lib/stale-action";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const stale = isStaleServerActionError(error);

  useEffect(() => {
    if (!stale) return;
    const handle = window.setTimeout(() => reloadForStaleDeployment(), 250);
    return () => window.clearTimeout(handle);
  }, [stale]);

  return (
    <main className="shell flex min-h-[60vh] items-center justify-center px-5 py-12">
      <div className="max-w-md text-center">
        <p className="text-[15px] font-semibold">Etwas ist schiefgelaufen</p>
        <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
          {stale
            ? "Die App wurde aktualisiert. Seite wird neu geladen…"
            : error.message || "Bitte Seite neu laden oder später nochmal versuchen."}
        </p>
        <button
          type="button"
          onClick={() => (stale ? reloadForStaleDeployment() : reset())}
          className="cta mt-6"
        >
          {stale ? "Neu laden" : "Erneut versuchen"}
        </button>
      </div>
    </main>
  );
}
