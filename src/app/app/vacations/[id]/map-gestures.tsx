"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

/** True when the device has a mouse/trackpad (desktop or hybrid). */
export function hasFinePointer(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(any-pointer: fine)").matches;
}

/**
 * Google Maps gestureHandling for embedded maps:
 * - touch: cooperative (one finger scrolls the page; two fingers pan)
 * - desktop / expanded / fullscreen: greedy (mouse or one finger pans)
 *
 * Prefer this over "auto" — on iOS Safari/PWA "auto" often falls back to
 * greedy and the map steals one-finger scroll again.
 */
export function googleGestureHandling(
  opts: { expanded?: boolean; fullscreen?: boolean } = {},
): "cooperative" | "greedy" {
  if (opts.expanded || opts.fullscreen) return "greedy";
  return hasFinePointer() ? "greedy" : "cooperative";
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
      container.style.touchAction = "";
      return;
    }

    container.classList.add("map-gestures-cooperative");

    // Desktop: pan + wheel zoom without expanding. Page scroll still works
    // outside the map; over the map the wheel zooms intentionally.
    if (desktop) {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      container.style.touchAction = "";
      return () => {
        container.classList.remove("map-gestures-cooperative");
        container.style.touchAction = "";
        map.dragging.enable();
        map.scrollWheelZoom.enable();
      };
    }

    map.dragging.disable();
    map.scrollWheelZoom.disable();
    // Let the page take vertical one-finger scroll on iOS Safari.
    container.style.touchAction = "pan-y";

    let activeTouches = 0;

    const syncDragging = () => {
      if (activeTouches >= 2) {
        map.dragging.enable();
        container.style.touchAction = "none";
      } else {
        map.dragging.disable();
        container.style.touchAction = "pan-y";
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
      container.style.touchAction = "";
      map.dragging.enable();
      map.scrollWheelZoom.enable();
    };
  }, [map, mode]);

  return null;
}
