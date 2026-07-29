"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

/** True when the device has a mouse/trackpad (desktop or hybrid). */
export function hasFinePointer(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(any-pointer: fine)").matches;
}

/**
 * Mobile-friendly map gestures:
 * - cooperative: one finger scrolls the page; two fingers pan the map
 * - greedy (expanded): mouse or one finger pans the map; wheel zooms
 *
 * On desktop (fine pointer), cooperative still allows mouse-drag panning
 * and scroll-wheel zoom. Touch devices keep two-finger pan / no wheel trap.
 */
export function LeafletGestureMode({
  mode,
  active = true,
}: {
  mode: "cooperative" | "greedy";
  active?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!active) return;
    // Recalculate tiles after expand/collapse or returning to the map tab.
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [map, mode, active]);

  useEffect(() => {
    const container = map.getContainer();
    const isCooperative = mode === "cooperative";
    const desktop = hasFinePointer();

    if (!isCooperative) {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      container.classList.remove("map-gestures-cooperative");
      return;
    }

    container.classList.add("map-gestures-cooperative");

    // Desktop: pan + wheel zoom without expanding. Page scroll still works
    // outside the map; over the map the wheel zooms intentionally.
    if (desktop) {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      return () => {
        container.classList.remove("map-gestures-cooperative");
        map.dragging.enable();
        map.scrollWheelZoom.enable();
      };
    }

    map.dragging.disable();
    map.scrollWheelZoom.disable();

    let activeTouches = 0;

    const syncDragging = () => {
      if (activeTouches >= 2) {
        map.dragging.enable();
      } else {
        map.dragging.disable();
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      activeTouches = event.touches.length;
      syncDragging();
    };

    const onTouchEnd = (event: TouchEvent) => {
      activeTouches = event.touches.length;
      syncDragging();
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchend", onTouchEnd, { passive: true });
    container.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
      container.classList.remove("map-gestures-cooperative");
      map.dragging.enable();
      map.scrollWheelZoom.enable();
    };
  }, [map, mode]);

  return null;
}
