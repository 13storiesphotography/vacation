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
  { id: "urlaub", label: "Urlaub" },
  { id: "spots", label: "Spots" },
  { id: "karte", label: "Karte" },
  { id: "plan", label: "Tagesplan" },
  { id: "team", label: "Team & MFA" },
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
    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ink-soft)]">
      {spot.overnightCost && (
        <span className="border border-[var(--line)] px-2 py-1">
          Übernachtung: {spot.overnightCost}
          {spot.priceHint ? ` · ${spot.priceHint}` : ""}
        </span>
      )}
      {spot.tags.map((tag) => (
        <span key={tag} className="border border-[var(--line)] px-2 py-1">
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
    <div className="relative aspect-[4/5] w-full overflow-hidden bg-[linear-gradient(160deg,#9eb8b0,#6f8f9a_45%,#3f6b74)]">
      <svg viewBox="0 0 320 400" className="absolute inset-0 h-full w-full opacity-90">
        <path
          d="M168 28c18 8 34 28 38 52 6 34-8 54-4 84 4 28 22 42 18 68-4 28-24 40-30 66-4 18 4 34-8 48-14 16-36 14-54 4-20-10-28-30-34-52-8-30-4-54 4-78 10-28 8-48 2-72-6-24 4-48 28-62 16-10 28-12 40-8z"
          fill="rgba(223,232,228,0.88)"
          stroke="rgba(20,35,31,0.18)"
          strokeWidth="2"
        />
        <path
          d="M120 120c20-8 42 0 48 18 8 22-6 34-4 52 2 16 14 24 8 40-8 20-28 18-44 8-18-12-24-34-20-54 4-16 2-28 12-64z"
          fill="rgba(95,125,74,0.25)"
        />
        <circle cx="210" cy="86" r="18" fill="rgba(255,255,255,0.18)" />
        <circle cx="240" cy="150" r="10" fill="rgba(255,255,255,0.12)" />
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
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white transition-transform ${
              active ? "scale-125 animate-pin" : "hover:scale-110"
            }`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: active ? 18 : 14,
              height: active ? 18 : 14,
              background: categoryTone[spot.category],
            }}
            title={spot.name}
            aria-label={spot.name}
          />
        );
      })}

      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 text-[11px] text-white/90">
        {Object.entries(categoryLabels).map(([key, label]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: categoryTone[key as SpotCategory] }}
            />
            {label}
          </span>
        ))}
      </div>
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
      title: "Admin lädt ein",
      text: "Du sendest eine E-Mail-Einladung für genau diesen Urlaub. Die Person bekommt einen einmaligen Link.",
    },
    {
      title: "Passwort vergeben",
      text: "Über den Link wird das Konto aktiviert. Passwort setzen, danach geht es weiter zur Absicherung.",
    },
    {
      title: "MFA einrichten",
      text: "TOTP mit Authenticator-App ist Pflicht. Erst danach ist der Zugang zum gemeinsamen Urlaub offen.",
    },
    {
      title: "Gemeinsam planen",
      text: "Beide sehen Spots, Karte und Tagesplan. Admin bleibt Owner, Members können Inhalte mitpflegen.",
    },
  ];

  return (
    <main className="shell">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <a href="#top" className="display text-xl tracking-tight text-[var(--pine)] md:text-2xl">
          Vacation Planer
        </a>
        <nav className="hidden items-center gap-6 text-sm text-[var(--ink-soft)] md:flex">
          <a href="#konzept" className="hover:text-[var(--ink)]">
            Konzept
          </a>
          <a href="#prototype" className="hover:text-[var(--ink)]">
            Live-Demo
          </a>
          <a href="#modell" className="hover:text-[var(--ink)]">
            Datenmodell
          </a>
        </nav>
        <a
          href="#prototype"
          className="bg-[var(--pine)] px-4 py-2 text-sm text-[#f3f7f4] transition hover:bg-[var(--fjord)]"
        >
          Demo öffnen
        </a>
      </header>

      <section id="top" className="relative mx-auto grid min-h-[88vh] w-full max-w-6xl items-center gap-10 px-5 py-10 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:py-14">
        <div className={`max-w-xl ${mounted ? "animate-rise" : "opacity-0"}`}>
          <h1 className="display text-5xl leading-[0.92] text-[var(--ink)] md:text-7xl">
            Vacation
            <br />
            Planer
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-[var(--ink-soft)]">
            Spots sammeln, auf der Karte sortieren und Tag für Tag die Route bauen —
            gemeinsam, mit Einladung und MFA.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#prototype"
              className="bg-[var(--fjord)] px-5 py-3 text-[#eef5f4] transition hover:bg-[var(--pine)]"
            >
              Live-Konzept ansehen
            </a>
            <a
              href="#konzept"
              className="border border-[var(--ink)]/20 px-5 py-3 text-[var(--ink)] transition hover:border-[var(--ink)]/50"
            >
              Aufbau verstehen
            </a>
          </div>
        </div>

        <div
          className={`relative min-h-[460px] overflow-hidden md:min-h-[520px] ${mounted ? "animate-rise" : "opacity-0"}`}
          style={{ animationDelay: "120ms" }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(145deg,#6f9084_0%,#3f6d78_48%,#234b3c_100%)]" />
          <div className="absolute inset-0 opacity-40 mix-blend-soft-light bg-[radial-gradient(circle_at_30%_20%,#fff7e8,transparent_40%),radial-gradient(circle_at_80%_70%,#9ad0c2,transparent_35%)]" />
          <div className="animate-drift absolute left-[12%] top-[18%] h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-[#eef5f4] md:p-8">
            <p className="text-sm uppercase tracking-[0.18em] text-white/70">Sample Trip</p>
            <h2 className="display mt-2 text-3xl md:text-4xl">{vacation.title}</h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/80">
              {vacation.startDate.slice(8)}.07. – {vacation.endDate.slice(8)}.07.2026 ·{" "}
              {vacation.type}
            </p>
          </div>
        </div>
      </section>

      <section id="konzept" className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <div className="max-w-2xl">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--fjord)]">Produktidee</p>
          <h2 className="display mt-3 text-4xl md:text-5xl">Ein Urlaub. Eine Sammlung. Ein Plan.</h2>
          <p className="mt-4 text-[var(--ink-soft)] leading-relaxed">
            Zuerst sammeln, dann entscheiden. Spots leben unabhängig vom Tagesplan — so bleibt die
            Inspiration lose, bis ihr sie auf konkrete Tage legt.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {productPillars.map((pillar, index) => (
            <article key={pillar.title} className="border-t border-[var(--line)] pt-5">
              <p className="text-sm text-[var(--fjord)]">0{index + 1}</p>
              <h3 className="display mt-2 text-2xl">{pillar.title}</h3>
              <p className="mt-3 text-[var(--ink-soft)] leading-relaxed">{pillar.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="prototype" className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--fjord)]">Live-Demo</p>
            <h2 className="display mt-3 text-4xl md:text-5xl">Klickbares Konzept</h2>
            <p className="mt-3 max-w-xl text-[var(--ink-soft)]">
              Interaktiver Durchlauf mit Beispieldaten für euren Schweden-Van-Urlaub. Noch ohne echte
              Backend-Anbindung — aber mit dem geplanten Flow.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {prototypeTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`px-3 py-2 text-sm transition ${
                  tab === item.id
                    ? "bg-[var(--ink)] text-[#eef3ef]"
                    : "border border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--ink)]/30"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="panel soft-shadow overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3 text-sm md:px-6">
            <div>
              <span className="display text-lg">{vacation.title}</span>
              <span className="ml-3 hidden text-[var(--ink-soft)] sm:inline">
                {vacation.subtitle}
              </span>
            </div>
            <span className="text-[var(--ink-soft)]">Konzept-UI</span>
          </div>

          <div className="p-4 md:p-6">
            {tab === "urlaub" && (
              <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <p className="text-sm uppercase tracking-[0.16em] text-[var(--fjord)]">
                    Urlaub anlegen
                  </p>
                  <h3 className="display mt-2 text-3xl">Schweden als gemeinsamer Container</h3>
                  <dl className="mt-8 space-y-4">
                    {[
                      ["Titel", vacation.title],
                      ["Zeitraum", "10.07.2026 – 24.07.2026"],
                      ["Art", vacation.type],
                      ["Region", vacation.region],
                    ].map(([label, value]) => (
                      <div key={label} className="grid grid-cols-[140px_1fr] gap-3 border-b border-[var(--line)] pb-3">
                        <dt className="text-sm text-[var(--ink-soft)]">{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-6 max-w-xl leading-relaxed text-[var(--ink-soft)]">
                    {vacation.description}
                  </p>
                </div>
                <div className="border border-[var(--line)] bg-white/50 p-5">
                  <p className="text-sm text-[var(--ink-soft)]">Was später speicherbar ist</p>
                  <ul className="mt-4 space-y-3 text-sm leading-relaxed">
                    <li>Typ-Profil steuert Extras — bei Van z. B. Übernachtungsplatz pro Tag.</li>
                    <li>Notizen, Packlisten und geteilte Links hängen am Urlaub, nicht an einzelnen Spots.</li>
                    <li>Mitglieder sehen denselben Stand; Admin verwaltet Einladungen.</li>
                  </ul>
                </div>
              </div>
            )}

            {tab === "spots" && (
              <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <div>
                  <div className="mb-4 flex flex-wrap gap-2">
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
                        className={`px-3 py-1.5 text-xs uppercase tracking-wide ${
                          filter === option
                            ? "bg-[var(--pine)] text-white"
                            : "border border-[var(--line)] text-[var(--ink-soft)]"
                        }`}
                      >
                        {option === "alle" ? "Alle" : categoryLabels[option]}
                      </button>
                    ))}
                  </div>
                  <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                    {filteredSpots.map((spot) => (
                      <button
                        key={spot.id}
                        type="button"
                        onClick={() => setActiveSpotId(spot.id)}
                        className={`w-full border px-4 py-3 text-left transition ${
                          activeSpot?.id === spot.id
                            ? "border-[var(--fjord)] bg-white"
                            : "border-[var(--line)] bg-white/40 hover:bg-white/70"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{spot.name}</span>
                          <span
                            className="text-[11px] uppercase tracking-wide"
                            style={{ color: categoryTone[spot.category] }}
                          >
                            {categoryLabels[spot.category]}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {activeSpot && (
                  <article className="border border-[var(--line)] bg-white/60 p-5 md:p-6">
                    <p
                      className="text-xs uppercase tracking-[0.18em]"
                      style={{ color: categoryTone[activeSpot.category] }}
                    >
                      {categoryLabels[activeSpot.category]}
                    </p>
                    <h3 className="display mt-2 text-3xl">{activeSpot.name}</h3>
                    <p className="mt-4 leading-relaxed text-[var(--ink-soft)]">
                      {activeSpot.description}
                    </p>
                    <SpotMeta spot={activeSpot} />
                    <div className="mt-6 flex flex-wrap gap-3">
                      <a
                        href={activeSpot.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-[var(--fjord)] px-4 py-2 text-sm text-white"
                      >
                        Google Maps
                      </a>
                      {activeSpot.infoUrl && (
                        <a
                          href={activeSpot.infoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="border border-[var(--ink)]/20 px-4 py-2 text-sm"
                        >
                          Buchung / Info
                        </a>
                      )}
                    </div>
                  </article>
                )}
              </div>
            )}

            {tab === "karte" && (
              <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <SwedenMap
                  activeId={activeSpot?.id ?? null}
                  filtered={filteredSpots}
                  onSelect={setActiveSpotId}
                />
                <div>
                  <p className="text-sm uppercase tracking-[0.16em] text-[var(--fjord)]">
                    Kartensicht
                  </p>
                  <h3 className="display mt-2 text-3xl">Alle Spots auf einen Blick</h3>
                  <p className="mt-3 text-[var(--ink-soft)] leading-relaxed">
                    Später mit echter Karte (Mapbox/Google). Im Konzept reicht die Schweden-Silhouette,
                    um Filter und Auswahl zu zeigen.
                  </p>
                  {activeSpot && (
                    <div className="mt-6 border border-[var(--line)] bg-white/60 p-5">
                      <h4 className="display text-2xl">{activeSpot.name}</h4>
                      <p className="mt-2 text-sm text-[var(--ink-soft)]">{activeSpot.description}</p>
                      <SpotMeta spot={activeSpot} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "plan" && (
              <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="space-y-2">
                  {days.map((item, index) => (
                    <button
                      key={item.date}
                      type="button"
                      onClick={() => setSelectedDay(index)}
                      className={`w-full border px-4 py-3 text-left ${
                        selectedDay === index
                          ? "border-[var(--pine)] bg-white"
                          : "border-[var(--line)] bg-white/40"
                      }`}
                    >
                      <div className="text-xs uppercase tracking-wide text-[var(--ink-soft)]">
                        {formatDate(item.date)}
                      </div>
                      <div className="mt-1 font-medium">{item.title}</div>
                    </button>
                  ))}
                </div>
                <div className="border border-[var(--line)] bg-white/60 p-5 md:p-6">
                  <p className="text-sm text-[var(--ink-soft)]">{formatDate(day.date)}</p>
                  <h3 className="display mt-1 text-3xl">{day.title}</h3>
                  <p className="mt-3 text-[var(--ink-soft)]">{day.notes}</p>

                  <div className="mt-6 border-t border-[var(--line)] pt-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--fjord)]">
                      Übernachtung
                    </p>
                    {overnight ? (
                      <div className="mt-2">
                        <p className="text-lg font-medium">{overnight.name}</p>
                        <p className="text-sm text-[var(--ink-soft)]">
                          {overnight.overnightCost}
                          {overnight.priceHint ? ` · ${overnight.priceHint}` : ""}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--sun)]">
                        Noch offen — aus der Spot-Sammlung zuweisen.
                      </p>
                    )}
                  </div>

                  <div className="mt-6 border-t border-[var(--line)] pt-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--fjord)]">
                      Tages-Stops
                    </p>
                    <ol className="mt-3 space-y-3">
                      {day.spotIds.map((id, index) => {
                        const spot = spots.find((entry) => entry.id === id);
                        if (!spot) return null;
                        return (
                          <li key={id} className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-6 w-6 items-center justify-center bg-[var(--pine)] text-xs text-white">
                              {index + 1}
                            </span>
                            <div>
                              <p className="font-medium">{spot.name}</p>
                              <p className="text-sm text-[var(--ink-soft)]">
                                {categoryLabels[spot.category]}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {tab === "team" && (
              <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
                <div>
                  <p className="text-sm uppercase tracking-[0.16em] text-[var(--fjord)]">
                    Zusammenarbeit
                  </p>
                  <h3 className="display mt-2 text-3xl">Einladen, absichern, gemeinsam planen</h3>
                  <div className="mt-6 space-y-3">
                    {collaborators.map((person) => (
                      <div
                        key={person.id}
                        className="flex items-center justify-between border border-[var(--line)] bg-white/50 px-4 py-3"
                      >
                        <div>
                          <p className="font-medium">{person.name}</p>
                          <p className="text-sm text-[var(--ink-soft)]">{person.email}</p>
                        </div>
                        <div className="text-right text-xs uppercase tracking-wide text-[var(--ink-soft)]">
                          <div>{person.role}</div>
                          <div className="mt-1">
                            {person.status === "active" ? "aktiv" : "eingeladen"} · MFA{" "}
                            {person.mfa ? "an" : "offen"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-[var(--line)] bg-white/60 p-5 md:p-6">
                  <p className="text-sm text-[var(--ink-soft)]">
                    Schritt {inviteStep + 1} / {inviteSteps.length}
                  </p>
                  <h4 className="display mt-2 text-2xl">{inviteSteps[inviteStep].title}</h4>
                  <p className="mt-3 leading-relaxed text-[var(--ink-soft)]">
                    {inviteSteps[inviteStep].text}
                  </p>
                  <div className="mt-6 flex gap-2">
                    {inviteSteps.map((step, index) => (
                      <button
                        key={step.title}
                        type="button"
                        onClick={() => setInviteStep(index)}
                        className={`h-2 flex-1 transition ${
                          index <= inviteStep ? "bg-[var(--fjord)]" : "bg-[var(--line)]"
                        }`}
                        aria-label={`Schritt zu ${step.title}`}
                      />
                    ))}
                  </div>
                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setInviteStep((value) => Math.max(0, value - 1))}
                      className="border border-[var(--line)] px-4 py-2 text-sm"
                      disabled={inviteStep === 0}
                    >
                      Zurück
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setInviteStep((value) => Math.min(inviteSteps.length - 1, value + 1))
                      }
                      className="bg-[var(--pine)] px-4 py-2 text-sm text-white"
                    >
                      {inviteStep === inviteSteps.length - 1 ? "Fertig" : "Weiter"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="modell" className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <div className="max-w-2xl">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--fjord)]">Supabase</p>
          <h2 className="display mt-3 text-4xl md:text-5xl">Datenmodell für den Start</h2>
          <p className="mt-4 text-[var(--ink-soft)] leading-relaxed">
            Schlank halten, aber von Tag eins mit Row Level Security und Rollen denken. Spots gehören
            zum Urlaub; Tagespläne referenzieren Spots statt sie zu kopieren.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {dataModel.map((item) => (
            <article key={item.entity} className="border border-[var(--line)] bg-white/45 p-5">
              <h3 className="display text-2xl">{item.entity}</h3>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">{item.note}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {item.fields.map((field) => (
                  <li key={field} className="border border-[var(--line)] px-2 py-1 text-xs">
                    {field}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-10 border-t border-[var(--line)] pt-8">
          <h3 className="display text-2xl">Auth-Flow</h3>
          <p className="mt-3 max-w-3xl leading-relaxed text-[var(--ink-soft)]">
            Supabase Auth mit E-Mail, Invite-Link und TOTP-MFA. Admin erstellt den Urlaub und lädt
            Members ein. Eingeladene vergeben Passwort, richten den zweiten Faktor ein und landen
            direkt im geteilten Urlaub. RLS sorgt dafür, dass nur Mitglieder des jeweiligen Urlaubs
            Daten sehen und ändern.
          </p>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-6xl px-5 pb-16 pt-4 md:px-8">
        <div className="border-t border-[var(--line)] pt-8 text-sm text-[var(--ink-soft)]">
          Konzept-Demo · Vacation Planer · nächster Schritt: echtes Schema + Auth in Supabase
        </div>
      </footer>
    </main>
  );
}
