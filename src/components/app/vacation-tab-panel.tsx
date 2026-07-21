"use client";

import type { ReactNode } from "react";
import type { VacationTabId } from "@/components/app/vacation-tabbar";

/**
 * Keep-alive panel: hide instead of unmounting so filters / selected day /
 * map viewport survive tab switches. Parent mounts only after first visit.
 */
export function VacationTabPanel({
  id,
  active,
  children,
}: {
  id: VacationTabId;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={`vacation-tab-${id}`}
      role="tabpanel"
      hidden={!active}
      aria-hidden={!active}
      inert={!active ? true : undefined}
    >
      {children}
    </section>
  );
}
