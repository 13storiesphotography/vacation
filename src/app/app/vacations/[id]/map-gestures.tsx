"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

/**
 * Mobile-friendly map gestures:
 * - cooperative: one finger scrolls the page; two fingers pan the map
 * - greedy (expanded): one finger pans the map normally
 */
export function LeafletGestureMode({
  mode,
}: {
  mode: "cooperative" | "greedy";
}) {
  const map = useMap();

  useEffect(() => {
    // Recalculate tiles after expand/collapse resize.
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [map, mode]);

  useEffect(() => {
    const container = map.getContainer();
    const isCooperative = mode === "cooperative";

    if (!isCooperative) {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      container.classList.remove("map-gestures-cooperative");
      return;
    }

    container.classList.add("map-gestures-cooperative");
    map.dragging.disable();
    // Keep wheel zoom off in cooperative so page scroll stays primary on trackpads.
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
