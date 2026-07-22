import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { categoryLabels, type SpotCategory } from "@/lib/spots";
import { formatRouteDuration, formatRouteKm } from "@/lib/day-route";
import {
  vacationTypeLabel,
  type DashboardLeg,
  type DashboardPayload,
  type DashboardPlace,
  type FeaturedDashboard,
  type VacationSummary,
} from "@/lib/dashboard";
import type { DayWeather } from "@/lib/weather";
import { LiveEtaChip } from "./live-eta-chip";

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

function ProgressRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(1, value));
  const size = 64;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.95)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
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

function LegMeta({ leg, label }: { leg: DashboardLeg; label: string }) {
  const approx = leg.source !== "google";
  return (
    <p className="text-[12px] text-[var(--ink-soft)]">
      <span className="font-semibold text-[var(--fjord)]">{label}</span>
      {" · "}
      {leg.fromName} → {leg.toName}
      {" · "}
      {approx ? "ca. " : ""}
      {leg.kmLabel} · {approx ? "~" : ""}
      {leg.durationLabel}
      <span className="text-[var(--ink-faint)]">
        {" · "}
        {leg.source === "google" ? "Google-Routenzeit" : "Schätzung"}
      </span>
    </p>
  );
}

function FeaturedHero({
  featured,
  onOpenTab,
}: {
  featured: FeaturedDashboard;
  onOpenTab?: (tab: "plan" | "karte" | "spots") => void;
}) {
  const vibe =
    featured.phase === "upcoming"
      ? "dashboard-hero dashboard-hero--upcoming"
      : featured.phase === "active"
        ? "dashboard-hero dashboard-hero--active"
        : "dashboard-hero dashboard-hero--past";

  const planHref = `/app/vacations/${featured.vacation.id}?tab=plan`;
  const karteHref = `/app/vacations/${featured.vacation.id}?tab=karte`;
  const spotsHref = `/app/vacations/${featured.vacation.id}?tab=spots`;

  return (
    <section className={`${vibe} animate-rise`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">
            {featured.phase === "upcoming"
              ? "Vorfreude"
              : featured.phase === "active"
                ? "Unterwegs"
                : "Rückblick"}
          </p>
          <h2 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.04em] text-white">
            {featured.heroTitle}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-white/80">
            {featured.heroSubtitle}
          </p>
        </div>
        <ProgressRing value={featured.progress} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="dashboard-pill">
          {featured.daysWithStops}/{featured.totalDays} Tage geplant
        </span>
        <span className="dashboard-pill">
          {featured.plannedRelevantCount}/{featured.relevantSpotCount} Spots
        </span>
        {featured.focusLabel ? (
          <span className="dashboard-pill">Fokus {featured.focusLabel}</span>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {onOpenTab ? (
          <>
            <button
              type="button"
              className="cta !bg-white !text-[var(--fjord)]"
              onClick={() => onOpenTab("plan")}
            >
              Plan öffnen
            </button>
            <button
              type="button"
              className="cta cta-secondary !border-white/35 !bg-white/10 !text-white"
              onClick={() => onOpenTab("karte")}
            >
              Karte
            </button>
            <button
              type="button"
              className="cta cta-secondary !border-white/35 !bg-white/10 !text-white"
              onClick={() => onOpenTab("spots")}
            >
              Spots
            </button>
          </>
        ) : (
          <>
            <Link href={planHref} className="cta !bg-white !text-[var(--fjord)]">
              Plan öffnen
            </Link>
            <Link
              href={karteHref}
              className="cta cta-secondary !border-white/35 !bg-white/10 !text-white"
            >
              Karte
            </Link>
            <Link
              href={spotsHref}
              className="cta cta-secondary !border-white/35 !bg-white/10 !text-white"
            >
              Spots
            </Link>
          </>
        )}
      </div>
    </section>
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
          Sammle Spots und lege die ersten Tage — dann erscheint hier dein nächster Halt.
        </p>
        {onOpenTab ? (
          <button
            type="button"
            className="cta mt-4 inline-flex"
            onClick={() => onOpenTab("plan")}
          >
            Jetzt planen
          </button>
        ) : (
          <Link
            href={`/app/vacations/${featured.vacation.id}?tab=plan`}
            className="cta mt-4 inline-flex"
          >
            Jetzt planen
          </Link>
        )}
      </section>
    );
  }

  const rest = featured.places.filter((place) => place.spotId !== lead?.spotId).slice(0, 3);

  return (
    <section className="ios-group animate-rise overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--fjord)]">
          Als Nächstes
        </p>
        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
          {featured.focusTitle ? `${featured.focusTitle} · ` : ""}
          {featured.focusLabel}
          {featured.phase === "upcoming" ? " · erster geplanter Tag" : ""}
          {featured.phase === "active"
            ? featured.isFocusToday
              ? " · heute"
              : " · nächster befüllter Tag"
            : ""}
        </p>
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
              Wetter am Ort
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
        <div className="flex items-start gap-3 px-4 pb-3">
          <PlaceThumb place={lead} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold">{lead.name}</p>
            <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
              {categoryLabels[lead.category as SpotCategory]}
              {lead.role === "overnight" ? " · Übernachtung" : " · nächster Stop"}
              {lead.tags.length
                ? ` · ${lead.tags.slice(0, 2).join(", ")}`
                : ""}
            </p>
            {featured.arrivalLeg ? (
              <div className="mt-2">
                <LegMeta leg={featured.arrivalLeg} label="Anfahrt" />
              </div>
            ) : featured.nextLeg ? (
              <div className="mt-2">
                <LegMeta leg={featured.nextLeg} label="Erste Etappe" />
              </div>
            ) : null}
            {lead.coords ? (
              <div className="mt-2">
                <LiveEtaChip
                  target={lead.coords}
                  targetName={lead.name}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {rest.length > 0 ? (
        <ul className="divide-y divide-[var(--separator)] border-t border-[var(--separator)]">
          {rest.map((place) => (
            <li key={`${place.spotId}-${place.order}`} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--fjord-soft)] text-[12px] font-bold text-[var(--fjord)]">
                {place.order}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{place.name}</p>
                <p className="text-[11px] text-[var(--ink-faint)]">
                  {categoryLabels[place.category as SpotCategory]}
                  {place.role === "overnight" ? " · Übernachtung" : ""}
                </p>
              </div>
              <CategoryIcon category={place.category as SpotCategory} size={16} />
            </li>
          ))}
        </ul>
      ) : null}

      {featured.route && featured.route.legs.length > 0 ? (
        <div className="border-t border-[var(--separator)] px-4 py-3 text-[12px] text-[var(--ink-soft)]">
          Tagestour {featured.route.source === "google" ? "" : "ca. "}
          {formatRouteKm(featured.route.totalKm)} ·{" "}
          {featured.route.source === "google" ? "" : "~"}
          {formatRouteDuration(featured.route.totalMinutes)} Fahrzeit
          {" · "}
          {featured.route.source === "google"
            ? "Google-Routenzeit"
            : "Schätzung"}
        </div>
      ) : null}
    </section>
  );
}

function AlertsCard({
  featured,
  onOpenTab,
}: {
  featured: FeaturedDashboard;
  onOpenTab?: (tab: "plan" | "karte" | "spots") => void;
}) {
  if (featured.alerts.length === 0) return null;
  return (
    <section className="glass-callout animate-rise px-4 py-3">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--sun)]">
        Noch offen
      </p>
      <ul className="mt-2 space-y-1.5">
        {featured.alerts.map((alert) => (
          <li key={alert} className="text-[13px] leading-snug text-[var(--ink-soft)]">
            {alert}
          </li>
        ))}
      </ul>
      {onOpenTab ? (
        <button
          type="button"
          className="mt-3 inline-block text-[13px] font-semibold text-[var(--fjord)] underline"
          onClick={() => onOpenTab("plan")}
        >
          Im Plan nachziehen
        </button>
      ) : (
        <Link
          href={`/app/vacations/${featured.vacation.id}?tab=plan`}
          className="mt-3 inline-block text-[13px] font-semibold text-[var(--fjord)] underline"
        >
          Im Plan nachziehen
        </Link>
      )}
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
            href={`/app/vacations/${vacation.id}`}
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

/** Dashboard cards for one vacation (Urlaub tab). */
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
      <FeaturedHero featured={featured} onOpenTab={onOpenTab} />
      <NextUpCard featured={featured} onOpenTab={onOpenTab} />
      <AlertsCard featured={featured} onOpenTab={onOpenTab} />
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
