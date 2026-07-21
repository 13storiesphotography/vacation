"use client";

import { useEffect, useState } from "react";
import {
  categoryLabels,
  categoryTone,
  collaborators,
  dataModel,
  days,
  productPillars,
  spots,
  vacation,
  type Spot,
  type SpotCategory,
} from "@/data/concept";

const prototypeTabs = [
  { id: "urlaub", label: "Urlaub", short: "Urlaub" },
  { id: "spots", label: "Spots", short: "Spots" },
  { id: "karte", label: "Karte", short: "Karte" },
  { id: "plan", label: "Plan", short: "Plan" },
  { id: "team", label: "Team", short: "Team" },
] as const;

type TabId = (typeof prototypeTabs)[number]["id"];

const filterOptions: Array<"alle" | SpotCategory> = [
  "alle",
  "stellplatz",
  "sehenswuerdigkeit",
  "ort",
  "freizeit",
  "versorgung",
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T12:00:00`));
}

function SpotMeta({ spot }: { spot: Spot }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {spot.overnightCost && (
        <span className="rounded-full bg-[var(--pine-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--pine)]">
          {spot.overnightCost}
          {spot.priceHint ? ` · ${spot.priceHint}` : ""}
        </span>
      )}
      {spot.tags.map((tag) => (
        <span
          key={tag}
          className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-[var(--ink-soft)]"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function SwedenMap({
  activeId,
  onSelect,
  filtered,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  filtered: Spot[];
}) {
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[18px] bg-[linear-gradient(160deg,#9eb8b0,#6f8f9a_45%,#3f6b74)]">
      <svg viewBox="0 0 320 400" className="absolute inset-0 h-full w-full opacity-90">
        <path
          d="M168 28c18 8 34 28 38 52 6 34-8 54-4 84 4 28 22 42 18 68-4 28-24 40-30 66-4 18 4 34-8 48-14 16-36 14-54 4-20-10-28-30-34-52-8-30-4-54 4-78 10-28 8-48 2-72-6-24 4-48 28-62 16-10 28-12 40-8z"
          fill="rgba(247,248,248,0.9)"
          stroke="rgba(17,24,39,0.12)"
          strokeWidth="2"
        />
        <path
          d="M120 120c20-8 42 0 48 18 8 22-6 34-4 52 2 16 14 24 8 40-8 20-28 18-44 8-18-12-24-34-20-54 4-16 2-28 12-64z"
          fill="rgba(31,77,61,0.22)"
        />
      </svg>

      {filtered.map((spot) => {
        const x = ((spot.lng - 11.5) / (19 - 11.5)) * 70 + 15;
        const y = ((63.5 - spot.lat) / (63.5 - 55.2)) * 78 + 10;
        const active = activeId === spot.id;
        return (
          <button
            key={spot.id}
            type="button"
            onClick={() => onSelect(spot.id)}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-white transition-transform ${
              active ? "scale-125 animate-pin" : "hover:scale-110"
            }`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: active ? 16 : 12,
              height: active ? 16 : 12,
              background: categoryTone[spot.category],
            }}
            title={spot.name}
            aria-label={spot.name}
          />
        );
      })}
    </div>
  );
}

function AppChrome({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="phone-status text-[var(--ink)]">
        <span>9:41</span>
        <span className="opacity-70">5G ▮▮▮</span>
      </div>
      <div className="px-5 pb-3 pt-10">
        {subtitle && <p className="text-[13px] font-semibold text-[var(--fjord)]">{subtitle}</p>}
        <h2 className="display mt-1 text-[28px] leading-tight tracking-[-0.04em]">{title}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-3">{children}</div>
    </div>
  );
}

export default function ConceptPage() {
  const [tab, setTab] = useState<TabId>("urlaub");
  const [filter, setFilter] = useState<(typeof filterOptions)[number]>("alle");
  const [activeSpotId, setActiveSpotId] = useState<string>(spots[0].id);
  const [inviteStep, setInviteStep] = useState(0);
  const [selectedDay, setSelectedDay] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredSpots =
    filter === "alle" ? spots : spots.filter((spot) => spot.category === filter);
  const activeSpot =
    filteredSpots.find((spot) => spot.id === activeSpotId) ?? filteredSpots[0] ?? spots[0];
  const day = days[selectedDay];
  const overnight = spots.find((spot) => spot.id === day.overnightSpotId);

  const inviteSteps = [
    {
      title: "Einladung senden",
      text: "Als Admin teilst du den Urlaub per E-Mail. Der Link gilt nur für diesen Trip.",
    },
    {
      title: "Passwort oder Apple",
      text: "Die eingeladene Person aktiviert das Konto per Passwort oder Apple Sign-In.",
    },
    {
      title: "MFA einrichten",
      text: "TOTP mit Authenticator-App ist Pflicht, bevor der gemeinsame Plan sichtbar wird.",
    },
    {
      title: "Gemeinsam planen",
      text: "Beide sehen Spots, Karte und Tagesplan live. Admin bleibt Owner.",
    },
  ];

  return (
    <main className="shell">
      <header className="blur-nav sticky top-0 z-20">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5 md:px-8">
          <a href="#top" className="display text-[17px] text-[var(--pine)]">
            Vacation Planer
          </a>
          <nav className="hidden items-center gap-6 text-[13px] font-semibold text-[var(--ink-soft)] md:flex">
            <a href="#konzept" className="hover:text-[var(--ink)]">
              Konzept
            </a>
            <a href="#prototype" className="hover:text-[var(--ink)]">
              Demo
            </a>
            <a href="#modell" className="hover:text-[var(--ink)]">
              Datenmodell
            </a>
          </nav>
          <a href="#prototype" className="cta !px-4 !py-2 text-[13px]">
            Demo öffnen
          </a>
        </div>
      </header>

      <section
        id="top"
        className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-10 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:py-16"
      >
        <div className={`max-w-xl ${mounted ? "animate-rise" : "opacity-0"}`}>
          <h1 className="display text-5xl leading-[0.95] text-[var(--ink)] md:text-6xl">
            Vacation
            <br />
            Planer
          </h1>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-[var(--ink-soft)]">
            Spots sammeln, auf der Karte ordnen und Tag für Tag die Route bauen — klar,
            ruhig und gemeinsam abgesichert mit MFA.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#prototype" className="cta">
              Live-Konzept ansehen
            </a>
            <a href="#konzept" className="cta cta-secondary">
              Aufbau verstehen
            </a>
          </div>
        </div>

        <div
          className={`relative flex justify-center ${mounted ? "animate-rise" : "opacity-0"}`}
          style={{ animationDelay: "100ms" }}
        >
          <div className="hero-visual absolute inset-x-6 inset-y-8 animate-float opacity-90 md:inset-x-10" />
          <div className="phone relative z-[1] my-4">
            <div className="phone-screen">
              <div className="phone-notch" />
              <AppChrome title={vacation.title} subtitle="Dein Trip">
                <div className="ios-group">
                  <div className="ios-row">
                    <div>
                      <p className="text-[15px] font-semibold">{vacation.type}</p>
                      <p className="text-[13px] text-[var(--ink-soft)]">10.–24. Juli 2026</p>
                    </div>
                  </div>
                  <div className="ios-row">
                    <div>
                      <p className="text-[15px] font-semibold">8 Spots gesammelt</p>
                      <p className="text-[13px] text-[var(--ink-soft)]">Süd → Höga Kusten</p>
                    </div>
                    <span className="ios-chevron" />
                  </div>
                  <div className="ios-row">
                    <div>
                      <p className="text-[15px] font-semibold">2 Personen</p>
                      <p className="text-[13px] text-[var(--ink-soft)]">1 Einladung offen</p>
                    </div>
                    <span className="ios-chevron" />
                  </div>
                </div>
                <p className="mt-4 px-1 text-[13px] leading-relaxed text-[var(--ink-soft)]">
                  {vacation.description}
                </p>
              </AppChrome>
            </div>
          </div>
        </div>
      </section>

      <section id="konzept" className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
        <p className="section-label">Produktidee</p>
        <h2 className="display mt-2 max-w-2xl text-3xl md:text-4xl">
          Ein Urlaub. Eine Sammlung. Ein Plan.
        </h2>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-[var(--ink-soft)]">
          Zuerst sammeln, dann entscheiden. Spots bleiben unabhängig vom Tagesplan — bis ihr sie
          einem Tag zuweist.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {productPillars.map((pillar, index) => (
            <article key={pillar.title} className="ios-group p-5">
              <p className="text-[13px] font-semibold text-[var(--fjord)]">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="display mt-2 text-xl">{pillar.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-soft)]">{pillar.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="prototype" className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="section-label">Live-Demo</p>
            <h2 className="display mt-2 text-3xl md:text-4xl">So soll sich die App anfühlen</h2>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--ink-soft)]">
              iOS-nahe Navigation, gruppierte Listen und klare Aktionen — mit euren Farben und dem
              Schweden-Van-Beispiel.
            </p>
          </div>
          <div className="segmented w-full max-w-md">
            {prototypeTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                data-active={tab === item.id}
                onClick={() => setTab(item.id)}
              >
                {item.short}
              </button>
            ))}
          </div>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[390px_1fr]">
          <div className="mx-auto w-full max-w-[390px]">
            <div className="phone">
              <div className="phone-screen flex flex-col">
                <div className="phone-notch" />
                <div className="min-h-0 flex-1">
                  {tab === "urlaub" && (
                    <AppChrome title="Schweden Van Trip" subtitle="Urlaub">
                      <div className="ios-group">
                        {[
                          ["Titel", vacation.title],
                          ["Zeitraum", "10.07. – 24.07.2026"],
                          ["Art", vacation.type],
                          ["Region", vacation.region],
                        ].map(([label, value]) => (
                          <div key={label} className="ios-row !items-start">
                            <div className="w-full">
                              <p className="text-[13px] text-[var(--ink-soft)]">{label}</p>
                              <p className="mt-0.5 text-[15px] font-semibold">{value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="ios-group mt-4 p-4">
                        <p className="text-[13px] font-semibold text-[var(--ink-soft)]">Notiz</p>
                        <p className="mt-1 text-[15px] leading-relaxed">{vacation.description}</p>
                      </div>
                    </AppChrome>
                  )}

                  {tab === "spots" && (
                    <AppChrome title="Spots" subtitle="Sammlung">
                      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                        {filterOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setFilter(option);
                              const next =
                                option === "alle"
                                  ? spots[0]
                                  : spots.find((spot) => spot.category === option);
                              if (next) setActiveSpotId(next.id);
                            }}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                              filter === option
                                ? "bg-[var(--fjord)] text-white"
                                : "bg-black/5 text-[var(--ink-soft)]"
                            }`}
                          >
                            {option === "alle" ? "Alle" : categoryLabels[option]}
                          </button>
                        ))}
                      </div>
                      <div className="ios-group">
                        {filteredSpots.map((spot) => (
                          <button
                            key={spot.id}
                            type="button"
                            className="ios-row ios-chevron"
                            data-active={activeSpot?.id === spot.id}
                            onClick={() => setActiveSpotId(spot.id)}
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: categoryTone[spot.category] }}
                            />
                            <div>
                              <p className="text-[15px] font-semibold">{spot.name}</p>
                              <p className="text-[12px] text-[var(--ink-soft)]">
                                {categoryLabels[spot.category]}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </AppChrome>
                  )}

                  {tab === "karte" && (
                    <AppChrome title="Karte" subtitle="Übersicht">
                      <SwedenMap
                        activeId={activeSpot?.id ?? null}
                        filtered={filteredSpots}
                        onSelect={setActiveSpotId}
                      />
                      {activeSpot && (
                        <div className="ios-group mt-3 p-4">
                          <p
                            className="text-[12px] font-semibold uppercase tracking-wide"
                            style={{ color: categoryTone[activeSpot.category] }}
                          >
                            {categoryLabels[activeSpot.category]}
                          </p>
                          <p className="mt-1 text-[16px] font-semibold">{activeSpot.name}</p>
                          <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                            {activeSpot.description}
                          </p>
                        </div>
                      )}
                    </AppChrome>
                  )}

                  {tab === "plan" && (
                    <AppChrome title="Tagesplan" subtitle="Route">
                      <div className="ios-group mb-3">
                        {days.map((item, index) => (
                          <button
                            key={item.date}
                            type="button"
                            className="ios-row ios-chevron"
                            data-active={selectedDay === index}
                            onClick={() => setSelectedDay(index)}
                          >
                            <div>
                              <p className="text-[12px] font-semibold text-[var(--ink-soft)]">
                                {formatDate(item.date)}
                              </p>
                              <p className="text-[15px] font-semibold">{item.title}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="ios-group p-4">
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--fjord)]">
                          Übernachtung
                        </p>
                        {overnight ? (
                          <p className="mt-1 text-[15px] font-semibold">
                            {overnight.name}
                            <span className="ml-2 text-[13px] font-medium text-[var(--ink-soft)]">
                              {overnight.overnightCost}
                            </span>
                          </p>
                        ) : (
                          <p className="mt-1 text-[14px] text-[var(--sun)]">Noch offen</p>
                        )}
                        <div className="mt-4 border-t border-[var(--separator)] pt-3">
                          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--fjord)]">
                            Stops
                          </p>
                          <ol className="mt-2 space-y-2">
                            {day.spotIds.map((id, index) => {
                              const spot = spots.find((entry) => entry.id === id);
                              if (!spot) return null;
                              return (
                                <li key={id} className="flex items-center gap-3">
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--fjord-soft)] text-[12px] font-bold text-[var(--fjord)]">
                                    {index + 1}
                                  </span>
                                  <span className="text-[14px] font-semibold">{spot.name}</span>
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      </div>
                    </AppChrome>
                  )}

                  {tab === "team" && (
                    <AppChrome title="Team & MFA" subtitle="Zugang">
                      <div className="ios-group">
                        {collaborators.map((person) => (
                          <div key={person.id} className="ios-row !items-start">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--pine-soft)] text-[13px] font-bold text-[var(--pine)]">
                              {person.name.slice(0, 1)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px] font-semibold">{person.name}</p>
                              <p className="truncate text-[12px] text-[var(--ink-soft)]">
                                {person.email}
                              </p>
                              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                                {person.role} · {person.status === "active" ? "aktiv" : "eingeladen"} ·
                                MFA {person.mfa ? "an" : "offen"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="ios-group mt-3 p-4">
                        <p className="text-[12px] font-semibold text-[var(--ink-soft)]">
                          Schritt {inviteStep + 1} / {inviteSteps.length}
                        </p>
                        <p className="mt-1 text-[16px] font-semibold">{inviteSteps[inviteStep].title}</p>
                        <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-soft)]">
                          {inviteSteps[inviteStep].text}
                        </p>
                        <div className="mt-4 flex gap-1.5">
                          {inviteSteps.map((step, index) => (
                            <button
                              key={step.title}
                              type="button"
                              onClick={() => setInviteStep(index)}
                              className={`h-1 flex-1 rounded-full ${
                                index <= inviteStep ? "bg-[var(--fjord)]" : "bg-black/10"
                              }`}
                              aria-label={step.title}
                            />
                          ))}
                        </div>
                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            className="cta cta-secondary flex-1 !py-2.5 text-[13px]"
                            onClick={() => setInviteStep((value) => Math.max(0, value - 1))}
                            disabled={inviteStep === 0}
                          >
                            Zurück
                          </button>
                          <button
                            type="button"
                            className="cta flex-1 !py-2.5 text-[13px]"
                            onClick={() =>
                              setInviteStep((value) => Math.min(inviteSteps.length - 1, value + 1))
                            }
                          >
                            Weiter
                          </button>
                        </div>
                      </div>
                    </AppChrome>
                  )}
                </div>

                <div className="tabbar">
                  {prototypeTabs.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      data-active={tab === item.id}
                      onClick={() => setTab(item.id)}
                    >
                      <span className="tab-icon" />
                      {item.short}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="ios-group p-6 md:p-8">
            {tab === "urlaub" && (
              <>
                <p className="section-label">Urlaub</p>
                <h3 className="display mt-2 text-2xl md:text-3xl">Der gemeinsame Container</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-soft)]">
                  Zeitraum, Typ und Notizen hängen am Urlaub. Van-Profile schalten Extras frei —
                  etwa Übernachtung pro Tag.
                </p>
              </>
            )}
            {tab === "spots" && activeSpot && (
              <>
                <p className="section-label">{categoryLabels[activeSpot.category]}</p>
                <h3 className="display mt-2 text-2xl md:text-3xl">{activeSpot.name}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-soft)]">
                  {activeSpot.description}
                </p>
                <SpotMeta spot={activeSpot} />
                <div className="mt-6 flex flex-wrap gap-3">
                  <a href={activeSpot.mapsUrl} target="_blank" rel="noreferrer" className="cta">
                    Google Maps
                  </a>
                  {activeSpot.infoUrl && (
                    <a
                      href={activeSpot.infoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="cta cta-secondary"
                    >
                      Buchung / Info
                    </a>
                  )}
                </div>
              </>
            )}
            {tab === "karte" && (
              <>
                <p className="section-label">Karte</p>
                <h3 className="display mt-2 text-2xl md:text-3xl">Alle Spots auf einen Blick</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-soft)]">
                  Später echte Karte (Mapbox/Google). Im Konzept zeigt die Schweden-Silhouette Filter
                  und Auswahl.
                </p>
              </>
            )}
            {tab === "plan" && (
              <>
                <p className="section-label">Tagesplan</p>
                <h3 className="display mt-2 text-2xl md:text-3xl">{day.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-soft)]">{day.notes}</p>
                <p className="mt-4 text-[14px] text-[var(--ink-soft)]">
                  Spots werden referenziert, nicht kopiert — Änderungen in der Sammlung bleiben
                  überall aktuell.
                </p>
              </>
            )}
            {tab === "team" && (
              <>
                <p className="section-label">Zusammenarbeit</p>
                <h3 className="display mt-2 text-2xl md:text-3xl">Einladen, absichern, teilen</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-soft)]">
                  Apple-klare Schritte: Invite → Passwort/Apple → MFA. Danach derselbe Urlaub für alle
                  Mitglieder.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <section id="modell" className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
        <p className="section-label">Supabase</p>
        <h2 className="display mt-2 text-3xl md:text-4xl">Datenmodell für den Start</h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--ink-soft)]">
          Schlank, aber von Tag eins mit Rollen und Row Level Security.
        </p>

        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {dataModel.map((item) => (
            <article key={item.entity} className="ios-group p-5">
              <h3 className="display text-xl">{item.entity}</h3>
              <p className="mt-1 text-[14px] text-[var(--ink-soft)]">{item.note}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {item.fields.map((field) => (
                  <li
                    key={field}
                    className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-soft)]"
                  >
                    {field}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="ios-group mt-6 p-6">
          <h3 className="display text-xl">Auth-Flow</h3>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-[var(--ink-soft)]">
            Supabase Auth mit E-Mail, Invite-Link und TOTP-MFA. RLS stellt sicher, dass nur
            Mitglieder des jeweiligen Urlaubs Daten sehen und ändern.
          </p>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-6xl px-5 pb-12 pt-2 md:px-8">
        <div className="border-t border-[var(--separator)] pt-6 text-[13px] text-[var(--ink-soft)]">
          Vacation Planer · iOS-inspiriertes Konzept · nächster Schritt: echtes Schema + Auth
        </div>
      </footer>
    </main>
  );
}
