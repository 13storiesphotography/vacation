"use client";

import { useEffect, useState } from "react";
import {
  estimateDriveMinutesBetween,
  estimateRoadKmBetween,
  formatRouteDuration,
  formatRouteKm,
} from "@/lib/day-route";
import type { LatLng } from "@/lib/geo";

type Status = "idle" | "loading" | "ready" | "denied" | "unsupported";

export function LiveEtaChip({
  target,
  targetName,
}: {
  target: LatLng;
  targetName: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
  }, []);

  function locate() {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const here = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const km = estimateRoadKmBetween(here, target);
        const minutes = estimateDriveMinutesBetween(here, target);
        setLabel(
          `Von hier ca. ${formatRouteKm(km)} · ~${formatRouteDuration(minutes)} bis ${targetName}`,
        );
        setStatus("ready");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 },
    );
  }

  if (status === "unsupported") return null;

  if (status === "ready" && label) {
    return (
      <p className="rounded-[12px] bg-[var(--pine-soft)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--pine)]">
        {label}
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className="text-[12px] text-[var(--ink-faint)]">
        Standort nicht verfügbar — Anfahrt weiter über den Plan.
      </p>
    );
  }

  return (
    <button
      type="button"
      className="glass-chip !py-1 !text-[11px]"
      disabled={status === "loading"}
      onClick={locate}
    >
      {status === "loading" ? "Standort…" : "Fahrzeit von hier"}
    </button>
  );
}
