"use client";

export const vacationTabs = [
  { id: "sammeln", label: "Sammeln", short: "Sammeln" },
  { id: "planen", label: "Planen", short: "Planen" },
  { id: "team", label: "Team", short: "Team" },
  { id: "mehr", label: "Mehr", short: "Mehr" },
] as const;

export type VacationTabId = (typeof vacationTabs)[number]["id"];

/** Map legacy ?tab= values from old 6-tab IA onto the new 4 tabs. */
export function normalizeVacationTab(value: string | null | undefined): VacationTabId {
  if (value === "sammeln" || value === "spots" || value === "karte") return "sammeln";
  if (value === "planen" || value === "plan") return "planen";
  if (value === "team") return "team";
  if (value === "mehr" || value === "urlaub" || value === "kosten") return "mehr";
  return "sammeln";
}

function TabGlyph({ id }: { id: VacationTabId }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 22 22",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (id) {
    case "sammeln":
      return (
        <svg {...common}>
          <path d="M11 18.2s-5.2-4.1-5.2-8.1A5.2 5.2 0 0 1 11 4.9a5.2 5.2 0 0 1 5.2 5.2c0 4-5.2 8.1-5.2 8.1Z" />
          <circle cx="11" cy="10" r="1.7" />
        </svg>
      );
    case "planen":
      return (
        <svg {...common}>
          <rect x="4.2" y="3.8" width="13.6" height="14.4" rx="2.2" />
          <path d="M7.2 2.8v2.4M14.8 2.8v2.4M4.2 8.4h13.6" />
          <path d="M7.5 12h3.2M7.5 15h7" />
        </svg>
      );
    case "team":
      return (
        <svg {...common}>
          <circle cx="8.2" cy="8" r="2.4" />
          <circle cx="14.6" cy="8.6" r="2" />
          <path d="M3.8 17.2c.4-2.6 2.2-3.9 4.4-3.9s4 1.3 4.4 3.9" />
          <path d="M12.2 17.2c.2-1.7 1.2-2.8 2.8-2.8 1.4 0 2.4.8 2.8 2.2" />
        </svg>
      );
    case "mehr":
      return (
        <svg {...common}>
          <circle cx="5.5" cy="11" r="1.35" fill="currentColor" stroke="none" />
          <circle cx="11" cy="11" r="1.35" fill="currentColor" stroke="none" />
          <circle cx="16.5" cy="11" r="1.35" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

export function VacationTabBar({
  active,
  onChange,
}: {
  active: VacationTabId;
  onChange: (id: VacationTabId) => void;
}) {
  const activeIndex = Math.max(
    0,
    vacationTabs.findIndex((tab) => tab.id === active),
  );

  return (
    <nav className="app-tabbar" aria-label="Urlaub-Navigation">
      <div className="liquid-tabbar-shell">
        {/* Index-based thumb: no measure lag, moves immediately with the tab. */}
        <div className="liquid-tabbar-track" aria-hidden>
          <div
            className="liquid-tabbar-slider"
            style={{
              transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
            }}
          />
        </div>
        {vacationTabs.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className="liquid-tabbar-item"
              data-active={isActive}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onChange(item.id)}
            >
              <span className="tab-glyph">
                <TabGlyph id={item.id} />
              </span>
              <span className="liquid-tabbar-label">{item.short}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
