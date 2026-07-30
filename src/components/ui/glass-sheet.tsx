"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function GlassSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  labelledBy,
}: {
  open: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  labelledBy?: string;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="glass-sheet-root" role="presentation">
      <button
        type="button"
        className="glass-sheet-backdrop"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div
        className="glass-sheet-panel glass-picker-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? (title ? "glass-sheet-title" : undefined)}
      >
        <div className="glass-sheet-handle" aria-hidden />
        {(title || subtitle) && (
          <header className="glass-sheet-header">
            {title ? (
              <h2 id={labelledBy ?? "glass-sheet-title"} className="glass-sheet-title">
                {title}
              </h2>
            ) : null}
            {subtitle ? <p className="glass-sheet-subtitle">{subtitle}</p> : null}
          </header>
        )}
        <div className="glass-sheet-body">{children}</div>
        {footer ? <div className="glass-sheet-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
