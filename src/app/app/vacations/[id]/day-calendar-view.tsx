"use client";

import { useMemo } from "react";
import {
  calendarHourRange,
  clockFromMinutes,
  timelineToCalendarBlocks,
  type DayCalendarBlock,
  type DayTimelineEntry,
} from "@/lib/day-timeline";

const HOUR_PX = 56;

function formatBlockClock(startMin: number, endMin: number): string {
  return `${clockFromMinutes(startMin)} – ${clockFromMinutes(endMin)}`;
}

function DayCalendarBlockCard({
  block,
  rangeStartMin,
  onSelect,
}: {
  block: DayCalendarBlock;
  rangeStartMin: number;
  onSelect?: (spotId: string) => void;
}) {
  const top = ((block.startMin - rangeStartMin) / 60) * HOUR_PX;
  const height = Math.max(
    28,
    ((block.endMin - block.startMin) / 60) * HOUR_PX - 3,
  );
  const clickable = Boolean(block.spotId && onSelect && block.kind === "aufenthalt");

  return (
    <button
      type="button"
      className="day-cal-block"
      data-kind={block.kind}
      data-role={block.role ?? undefined}
      style={{ top, height }}
      disabled={!clickable}
      onClick={() => {
        if (block.spotId && onSelect) onSelect(block.spotId);
      }}
    >
      <span className="day-cal-block-accent" aria-hidden />
      <span className="day-cal-block-body">
        <span className="day-cal-block-time">
          {formatBlockClock(block.startMin, block.endMin)}
        </span>
        <span className="day-cal-block-label">{block.label}</span>
        {block.detail ? (
          <span className="day-cal-block-detail">{block.detail}</span>
        ) : null}
      </span>
    </button>
  );
}

export function DayCalendarView({
  timeline,
  hasDepartAt,
  onSelectSpot,
}: {
  timeline: DayTimelineEntry[];
  hasDepartAt: boolean;
  onSelectSpot?: (spotId: string) => void;
}) {
  const blocks = useMemo(() => timelineToCalendarBlocks(timeline), [timeline]);
  const { startHour, endHour } = useMemo(
    () => calendarHourRange(blocks),
    [blocks],
  );
  const hours = useMemo(() => {
    const list: number[] = [];
    for (let hour = startHour; hour <= endHour; hour += 1) list.push(hour);
    return list;
  }, [startHour, endHour]);

  const rangeStartMin = startHour * 60;
  const canvasHeight = Math.max(1, endHour - startHour) * HOUR_PX;

  if (!hasDepartAt) {
    return (
      <div className="day-cal day-cal-empty mx-3 mb-3">
        <p className="text-[13px] font-semibold text-[var(--ink)]">Tageskalender</p>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-soft)]">
          Setze oben eine Abfahrt — dann erscheinen Fahrten und Aufenthalte als
          Zeitblöcke wie in einem Kalender.
        </p>
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="day-cal day-cal-empty mx-3 mb-3">
        <p className="text-[13px] font-semibold text-[var(--ink)]">Tageskalender</p>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-soft)]">
          Noch keine Stops oder Übernachtung für diesen Tag.
        </p>
      </div>
    );
  }

  return (
    <div className="day-cal mx-3 mb-3">
      <div className="day-cal-legend">
        <span data-kind="fahrt">Fahrt</span>
        <span data-kind="aufenthalt">Aufenthalt</span>
      </div>
      <div className="day-cal-scroll">
        <div className="day-cal-canvas" style={{ height: canvasHeight }}>
          <div className="day-cal-hours" aria-hidden>
            {hours.map((hour) => (
              <div
                key={hour}
                className="day-cal-hour"
                style={{ height: HOUR_PX }}
              >
                <span className="day-cal-hour-label">
                  {`${String(hour % 24).padStart(2, "0")}:00`}
                </span>
                <span className="day-cal-hour-line" />
              </div>
            ))}
          </div>
          <div className="day-cal-blocks">
            {blocks.map((block) => (
              <DayCalendarBlockCard
                key={block.id}
                block={block}
                rangeStartMin={rangeStartMin}
                onSelect={onSelectSpot}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
