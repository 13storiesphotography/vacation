"use client";

import { useEffect, useId, useRef, useState } from "react";
import { normalizeClockTime } from "@/lib/day-timeline";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const ITEM_H = 40;
const PAD_H = 80;

function parseParts(
  value: string | null | undefined,
  minuteStep: 1 | 5,
): { hour: string; minute: string } {
  const normalized = normalizeClockTime(value) ?? "09:00";
  const [hour, rawMinute] = normalized.split(":");
  if (minuteStep === 1) {
    return { hour, minute: rawMinute };
  }
  const snapped = String(Math.round(Number(rawMinute) / 5) * 5).padStart(2, "0");
  const safeMinute = snapped === "60" ? "00" : snapped;
  return { hour, minute: MINUTES.includes(safeMinute) ? safeMinute : "00" };
}

function nowClock(): string {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(Math.round(now.getMinutes() / 5) * 5).padStart(2, "0");
  return normalizeClockTime(`${hour}:${minute === "60" ? "00" : minute}`) ?? "09:00";
}

function WheelColumn({
  values,
  value,
  ariaLabel,
  onChange,
}: {
  values: string[];
  value: string;
  ariaLabel: string;
  onChange: (next: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const suppressScroll = useRef(false);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const index = Math.max(0, values.indexOf(value));
    suppressScroll.current = true;
    scroller.scrollTop = index * ITEM_H;
    const timer = window.setTimeout(() => {
      suppressScroll.current = false;
    }, 80);
    return () => window.clearTimeout(timer);
  }, [value, values]);

  return (
    <div
      ref={scrollerRef}
      className="glass-time-wheel"
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={0}
      onScroll={() => {
        const scroller = scrollerRef.current;
        if (!scroller || suppressScroll.current) return;
        const index = Math.round(scroller.scrollTop / ITEM_H);
        const next = values[Math.max(0, Math.min(values.length - 1, index))];
        if (next && next !== value) onChange(next);
      }}
    >
      <div className="glass-time-wheel-pad" aria-hidden />
      {values.map((entry) => (
        <button
          key={entry}
          type="button"
          role="option"
          aria-selected={entry === value}
          className="glass-time-wheel-option"
          data-active={entry === value}
          onClick={() => {
            onChange(entry);
            const scroller = scrollerRef.current;
            if (!scroller) return;
            const index = values.indexOf(entry);
            scroller.scrollTo({ top: index * ITEM_H, behavior: "smooth" });
          }}
        >
          {entry}
        </button>
      ))}
      <div className="glass-time-wheel-pad" aria-hidden style={{ height: PAD_H }} />
    </div>
  );
}

export function GlassTimeField({
  name,
  value,
  defaultValue = "",
  onChange,
  required,
  disabled,
  className = "mt-1.5",
  minuteStep = 5,
}: {
  name?: string;
  /** Controlled clock time HH:MM. */
  value?: string;
  defaultValue?: string;
  onChange?: (clock: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  minuteStep?: 1 | 5;
}) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const selected = isControlled ? value : internal;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() =>
    parseParts(selected || defaultValue || nowClock(), minuteStep),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const minutes =
    minuteStep === 1
      ? Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))
      : MINUTES;

  useEffect(() => {
    if (!open) return;
    setDraft(parseParts(selected || nowClock(), minuteStep));
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, selected, minuteStep]);

  function commit(next: string) {
    const normalized = next ? normalizeClockTime(next) ?? "" : "";
    if (!isControlled) setInternal(normalized);
    onChange?.(normalized);
    setOpen(false);
  }

  const display = selected ? normalizeClockTime(selected) : "";

  return (
    <div ref={rootRef} className={`glass-time ${className}`}>
      {name ? (
        <input type="hidden" name={name} value={selected} required={required} />
      ) : null}
      <button
        type="button"
        className="glass-field glass-time-trigger w-full px-3 py-2 text-left text-[14px]"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
      >
        <span className={display ? "text-[var(--ink)]" : "text-[var(--ink-faint)]"}>
          {display || "Uhrzeit wählen"}
        </span>
      </button>

      {open ? (
        <div
          id={listId}
          className="glass-picker-surface glass-time-popover"
          role="dialog"
          aria-label="Uhrzeit wählen"
        >
          <div className="glass-time-wheels">
            <WheelColumn
              values={HOURS}
              value={draft.hour}
              ariaLabel="Stunde"
              onChange={(hour) => setDraft((current) => ({ ...current, hour }))}
            />
            <span className="glass-time-colon" aria-hidden>
              :
            </span>
            <WheelColumn
              values={minutes}
              value={
                minutes.includes(draft.minute)
                  ? draft.minute
                  : minutes[0] ?? "00"
              }
              ariaLabel="Minute"
              onChange={(minute) => setDraft((current) => ({ ...current, minute }))}
            />
          </div>

          <div className="glass-time-footer">
            <button
              type="button"
              className="glass-chip !py-1 !text-[11px]"
              onClick={() => commit("")}
            >
              Löschen
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className="glass-chip !py-1 !text-[11px]"
                onClick={() => {
                  const clock = nowClock();
                  setDraft(parseParts(clock, minuteStep));
                  commit(clock);
                }}
              >
                Jetzt
              </button>
              <button
                type="button"
                className="glass-chip !py-1 !text-[11px]"
                data-active="true"
                onClick={() => commit(`${draft.hour}:${draft.minute}`)}
              >
                Fertig
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
