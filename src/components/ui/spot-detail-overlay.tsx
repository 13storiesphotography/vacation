"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Maps-style place card: partial bottom sheet (not fullscreen, not an action menu).
 * Always portaled to body so fixed positioning works.
 */
export function SpotPlaceCard({
  open,
  onClose,
  children,
  footer,
  editing = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  editing?: boolean;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!open || !mounted) return null;

  return createPortal(
    <div className="spot-place-root" role="presentation">
      <button
        type="button"
        className="spot-place-backdrop"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div
        className="spot-place-card glass-picker-surface"
        data-editing={editing ? "true" : undefined}
        role="dialog"
        aria-modal="true"
      >
        <div className="spot-place-handle" aria-hidden />
        <div className="spot-place-scroll">{children}</div>
        {footer ? <div className="spot-place-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
