import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { categoryLabels, type SpotCategory } from "@/lib/spots";
import {
  vacationTypeLabel,
  type DashboardPayload,
  type DashboardPlace,
  type FeaturedDashboard,
  type VacationSummary,
} from "@/lib/dashboard";
import type { DayWeather } from "@/lib/weather";

function WeatherGlyph({ icon }: { icon: DayWeather["icon"] }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    className: "h-5 w-5",
    "aria-hidden": true as const,
  };
  if (icon === "sun") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (icon === "rain" || icon === "storm") {
    return (
      <svg {...common}>
        <path
          d="M7.5 16a4.5 4.5 0 1 1 1.2-8.8A6 6 0 0 1 20 10.5 3.5 3.5 0 0 1 18 17H8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M9 18.5 8 21M12.5 18.5 11.5 21M16 18.5 15 21"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (icon === "snow") {
    return (
      <svg {...common}>
        <path
          d="M12 4v16M5.5 8.5 18.5 15.5M18.5 8.5 5.5 15.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (icon === "fog") {
    return (
      <svg {...common}>
        <path
          d="M4 10h16M3 14h18M5 18h14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path
        d="M7.5 17a4.5 4.5 0 1 1 1.2-8.8A6 6 0 0 1 20 11.5 3.5 3.5 0 0 1 18 18H8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlaceThumb({ place }: { place: DashboardPlace }) {
  if (place.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={place.imageUrl}
        alt=""
        className="h-14 w-14 shrink-0 rounded-[14px] object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-[var(--fjord-soft)] text-[var(--fjord)]">
      <CategoryIcon category={place.category as SpotCategory} size={22} />
    </span>
  );
}

function formatDayLong(date: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00Z`));
}

function statusLine(featured: FeaturedDashboard): string {
  if (featured.phase === "upcoming") {
    if (featured.daysUntilStart <= 0) return "Start heute";
    if (featured.daysUntilStart === 1) return "Start morgen";
    return `Start in ${featured.daysUntilStart} Tagen`;
  }
  if (featured.phase === "active") {
    if (featured.dayIndex != null) {
      return `Tag ${featured.dayIndex} von ${featured.totalDays}`;
    }
    return "Unterwegs";
  }
  if (featured.daysSinceEnd <= 1) return "Gerade zurück";
  return `Vor ${featured.daysSinceEnd} Tagen zu Ende`;
}

function googleMapsDirectionsUrl(coords: { lat: number; lng: number }): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", `${coords.lat},${coords.lng}`);
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}

function StatusStrip({
  featured,
  onOpenTab,
}: {
  featured: FeaturedDashboard;
  onOpenTab?: (tab: "plan" | "karte" | "spots") => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-0.5">
      <p className="text-[14px] text-[var(--ink-soft)]">
        <span className="font-semibold text-[var(--ink)]">{statusLine(featured)}</span>
        {featured.vacation.region ? ` · ${featured.vacation.region}` : ""}
      </p>
      {onOpenTab ? (
        <button
          type="button"
          className="glass-chip shrink-0"
          onClick={() => onOpenTab("plan")}
        >
          Plan
        </button>
      ) : (
        <Link
          href={`/app/vacations/${featured.vacation.id}?tab=plan`}
          className="glass-chip shrink-0"
        >
          Plan
        </Link>
      )}
    </div>
  );
}

function NextUpCard({
  featured,
  onOpenTab,
}: {
  featured: FeaturedDashboard;
  onOpenTab?: (tab: "plan" | "karte" | "spots") => void;
}) {
  const lead = featured.places[0] ?? featured.overnight;

  if (!lead && !featured.focusDate) {
    return (
      <section className="ios-group animate-rise p-5">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--fjord)]">
          Als Nächstes
        </p>
        <p className="mt-2 text-[15px] font-semibold">Noch nichts eingeplant</p>
        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
          Im Plan die ersten Stops legen — dann steht hier der nächste Halt.
        </p>
        {onOpenTab ? (
          <button
            type="button"
            className="cta mt-4 inline-flex"
            onClick={() => onOpenTab("plan")}
          >
            Zum Plan
          </button>
        ) : (
          <Link
            href={`/app/vacations/${featured.vacation.id}?tab=plan`}
            className="cta mt-4 inline-flex"
          >
            Zum Plan
          </Link>
        )}
      </section>
    );
  }

  const dayHeading = featured.isFocusToday
    ? "Heute"
    : featured.focusDate
      ? formatDayLong(featured.focusDate)
      : "Als Nächstes";

  const mapsUrl = lead?.coords ? googleMapsDirectionsUrl(lead.coords) : null;

  return (
    <section className="ios-group animate-rise overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--fjord)]">
          Als Nächstes
        </p>
        <p className="mt-1 text-[15px] font-semibold text-[var(--ink)]">{dayHeading}</p>
        {featured.focusTitle ? (
          <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">{featured.focusTitle}</p>
        ) : null}
      </div>

      {featured.weather ? (
        <div className="mx-4 mb-3 flex items-center gap-3 rounded-[16px] bg-[var(--fjord-soft)] px-3 py-2.5 text-[var(--fjord)]">
          <WeatherGlyph icon={featured.weather.icon} />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">
              {featured.weather.label}
              {" · "}
              {featured.weather.tempMax}° / {featured.weather.tempMin}°
            </p>
            <p className="text-[12px] text-[var(--ink-soft)]">
              Wetter
              {featured.weather.precipProb != null
                ? ` · ${featured.weather.precipProb}% Regen`
                : ""}
            </p>
          </div>
        </div>
      ) : featured.weatherNote ? (
        <p className="mx-4 mb-3 text-[12px] text-[var(--ink-faint)]">{featured.weatherNote}</p>
      ) : null}

      {lead ? (
        <div className="flex items-start gap-3 px-4 pb-4">
          <PlaceThumb place={lead} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold">{lead.name}</p>
            <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
              {categoryLabels[lead.category as SpotCategory]}
              {lead.role === "overnight" ? " · Übernachtung" : ""}
            </p>
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--separator)] bg-[var(--fjord-soft)] px-3 py-1.5 text-[12px] font-semibold text-[var(--fjord)] transition hover:bg-[var(--fjord)] hover:text-white"
              >
                In Google Maps öffnen
                <span aria-hidden="true">↗</span>
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function OtherVacations({ vacations }: { vacations: VacationSummary[] }) {
  if (vacations.length === 0) return null;
  return (
    <section className="animate-rise">
      <p className="mb-2 px-0.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
        Weitere Urlaube
      </p>
      <div className="ios-group">
        {vacations.map((vacation) => (
          <Link
            key={vacation.id}
            href={`/app/vacations/${vacation.id}?tab=urlaub`}
            className="ios-row ios-chevron"
          >
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{vacation.title}</p>
              <p className="text-[13px] text-[var(--ink-soft)]">
                {vacation.start_date} – {vacation.end_date}
                {vacation.region
                  ? ` · ${vacation.region}`
                  : ` · ${vacationTypeLabel(vacation.type)}`}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Lean dashboard for the Urlaub tab: status, next stop, no nagging stats. */
export function VacationTripDashboard({
  featured,
  onOpenTab,
  className = "space-y-4",
}: {
  featured: FeaturedDashboard;
  onOpenTab?: (tab: "plan" | "karte" | "spots") => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <StatusStrip featured={featured} onOpenTab={onOpenTab} />
      <NextUpCard featured={featured} onOpenTab={onOpenTab} />
    </div>
  );
}

export function ReiseDashboard({ payload }: { payload: DashboardPayload }) {
  const { featured, others } = payload;

  if (!featured) {
    return (
      <div className="ios-group mt-6 p-5">
        <p className="text-[15px] font-semibold">Noch keine Urlaube</p>
        <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
          Lege den nächsten Trip an — das Dashboard findest du danach im Tab Urlaub.
        </p>
        <Link href="/app/vacations/new" className="cta mt-4 inline-flex">
          Ersten Urlaub anlegen
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <VacationTripDashboard featured={featured} />
      <OtherVacations vacations={others} />
    </div>
  );
}
