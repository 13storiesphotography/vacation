"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

function parseIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12));
}

function addMonths(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1, 12));
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function formatDisplay(iso: string): string {
  const date = parseIso(iso);
  if (!date) return "";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function monthTitle(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function todayIso(): string {
  const now = new Date();
  const local = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12),
  );
  return toIso(local);
}

function buildGrid(month: Date): Array<Date | null> {
  const first = startOfMonth(month);
  // Mon=0 … Sun=6
  const weekday = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < weekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(
      new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), day, 12)),
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function clampIso(iso: string, min?: string, max?: string): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

export function GlassDateField({
  name,
  value,
  defaultValue = "",
  onChange,
  min,
  max,
  required,
  disabled,
  className = "mt-1.5",
}: {
  name?: string;
  /** Controlled ISO date YYYY-MM-DD. */
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const selected = isControlled ? value : internal;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const parsed = parseIso(selected || defaultValue || todayIso());
    return startOfMonth(parsed ?? new Date());
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  useEffect(() => {
    const parsed = parseIso(selected);
    if (parsed) setMonth(startOfMonth(parsed));
  }, [selected]);

  const cells = useMemo(() => buildGrid(month), [month]);
  const selectedDate = parseIso(selected);
  const today = parseIso(todayIso());

  function commit(next: string) {
    const clamped = next ? clampIso(next, min, max) : "";
    if (!isControlled) setInternal(clamped);
    onChange?.(clamped);
    setOpen(false);
  }

  function isDisabled(date: Date): boolean {
    const iso = toIso(date);
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  }

  return (
    <div ref={rootRef} className={`glass-date ${className}`}>
      {name ? (
        <input type="hidden" name={name} value={selected} required={required} />
      ) : null}
      <button
        type="button"
        className="glass-field glass-date-trigger w-full px-3 py-3 text-left"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
      >
        <span className={selected ? "text-[var(--ink)]" : "text-[var(--ink-faint)]"}>
          {selected ? formatDisplay(selected) : "Datum wählen"}
        </span>
      </button>

      {open ? (
        <div id={listId} className="glass-date-popover" role="dialog" aria-label="Datum wählen">
          <div className="glass-date-header">
            <button
              type="button"
              className="glass-date-nav"
              aria-label="Vorheriger Monat"
              onClick={() => setMonth((current) => addMonths(current, -1))}
            >
              ‹
            </button>
            <p className="glass-date-month">{monthTitle(month)}</p>
            <button
              type="button"
              className="glass-date-nav"
              aria-label="Nächster Monat"
              onClick={() => setMonth((current) => addMonths(current, 1))}
            >
              ›
            </button>
          </div>

          <div className="glass-date-weekdays">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="glass-date-grid">
            {cells.map((date, index) => {
              if (!date) {
                return <span key={`empty-${index}`} className="glass-date-empty" />;
              }
              const iso = toIso(date);
              const selectedDay = selectedDate ? sameDay(date, selectedDate) : false;
              const isToday = today ? sameDay(date, today) : false;
              const dayDisabled = isDisabled(date);
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={dayDisabled}
                  className="glass-date-day"
                  data-selected={selectedDay}
                  data-today={isToday && !selectedDay}
                  onClick={() => commit(iso)}
                >
                  {date.getUTCDate()}
                </button>
              );
            })}
          </div>

          <div className="glass-date-footer">
            <button
              type="button"
              className="glass-chip !py-1 !text-[11px]"
              onClick={() => commit("")}
            >
              Löschen
            </button>
            <button
              type="button"
              className="glass-chip !py-1 !text-[11px]"
              data-active="true"
              onClick={() => {
                const iso = clampIso(todayIso(), min, max);
                const parsed = parseIso(iso);
                if (parsed) setMonth(startOfMonth(parsed));
                commit(iso);
              }}
            >
              Heute
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
