"use client";

export const vacationTabs = [
  { id: "urlaub", label: "Urlaub", short: "Urlaub" },
  { id: "spots", label: "Spots", short: "Spots" },
  { id: "karte", label: "Karte", short: "Karte" },
  { id: "plan", label: "Plan", short: "Plan" },
  { id: "team", label: "Team", short: "Team" },
] as const;

export type VacationTabId = (typeof vacationTabs)[number]["id"];

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
    case "urlaub":
      return (
        <svg {...common}>
          <path d="M4 17.5V8.2L11 4l7 4.2v9.3" />
          <path d="M8.2 17.5v-4.2h5.6v4.2" />
        </svg>
      );
    case "spots":
      return (
        <svg {...common}>
          <path d="M11 18.2s-5.2-4.1-5.2-8.1A5.2 5.2 0 0 1 11 4.9a5.2 5.2 0 0 1 5.2 5.2c0 4-5.2 8.1-5.2 8.1Z" />
          <circle cx="11" cy="10" r="1.7" />
        </svg>
      );
    case "karte":
      return (
        <svg {...common}>
          <path d="M3.5 6.2 8.2 4.5l5.6 1.7 4.7-1.7v11.6l-4.7 1.7-5.6-1.7-4.7 1.7V6.2Z" />
          <path d="M8.2 4.5v11.6M13.8 6.2v11.6" />
        </svg>
      );
    case "plan":
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
  }
}

export function VacationTabBar({
  active,
  onChange,
}: {
  active: VacationTabId;
  onChange: (id: VacationTabId) => void;
}) {
  return (
    <nav className="app-tabbar tabbar" aria-label="Urlaub-Navigation">
      {vacationTabs.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            data-active={isActive}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onChange(item.id)}
          >
            <span className="tab-glyph">
              <TabGlyph id={item.id} />
            </span>
            {item.short}
          </button>
        );
      })}
    </nav>
  );
}
