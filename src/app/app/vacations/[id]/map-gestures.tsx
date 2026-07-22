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
 * - greedy (expanded / desktop): mouse or one finger pans the map
 *
 * On desktop (fine pointer), cooperative still allows mouse-drag panning;
 * only the scroll wheel stays off so the page can scroll over the map.
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
    // Keep wheel zoom off in cooperative so page scroll stays primary on trackpads.
    map.scrollWheelZoom.disable();

    // Desktop: allow click-drag pan without expanding the map.
    if (desktop) {
      map.dragging.enable();
      return () => {
        container.classList.remove("map-gestures-cooperative");
        map.dragging.enable();
        map.scrollWheelZoom.enable();
      };
    }

    map.dragging.disable();

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
