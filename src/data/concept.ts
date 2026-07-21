export type SpotCategory =
  | "stellplatz"
  | "sehenswuerdigkeit"
  | "ort"
  | "freizeit"
  | "versorgung";

export type OvernightCost = "frei" | "kostenpflichtig" | null;

export type Spot = {
  id: string;
  name: string;
  category: SpotCategory;
  description: string;
  lat: number;
  lng: number;
  mapsUrl: string;
  infoUrl?: string;
  overnightCost?: OvernightCost;
  priceHint?: string;
  tags: string[];
};

export type DayPlan = {
  date: string;
  title: string;
  overnightSpotId?: string;
  spotIds: string[];
  notes?: string;
};

export type Collaborator = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  status: "active" | "invited";
  mfa: boolean;
};

export const categoryLabels: Record<SpotCategory, string> = {
  stellplatz: "Stellplatz",
  sehenswuerdigkeit: "Sehenswürdigkeit",
  ort: "Ort",
  freizeit: "Freizeit",
  versorgung: "Versorgung",
};

export const categoryTone: Record<SpotCategory, string> = {
  stellplatz: "#2f6f5e",
  sehenswuerdigkeit: "#b56a3c",
  ort: "#1f5f78",
  freizeit: "#6a7a2f",
  versorgung: "#6b5a3c",
};

export const vacation = {
  title: "Schweden Van Trip",
  subtitle: "Wohnmobil · Mittsommer-Route",
  type: "Wohnmobil / Van",
  region: "Schweden · Süd nach Nord",
  startDate: "2026-07-10",
  endDate: "2026-07-24",
  description:
    "Zwei Wochen mit dem Van von Skåne bis zur Höga Kusten: Stellplätze sammeln, Tage planen, gemeinsam entscheiden.",
};

export const collaborators: Collaborator[] = [
  {
    id: "u1",
    name: "Florian",
    email: "florian@tutzinger-knolls.de",
    role: "admin",
    status: "active",
    mfa: true,
  },
  {
    id: "u2",
    name: "Partner:in",
    email: "partner@example.com",
    role: "member",
    status: "invited",
    mfa: false,
  },
];

export const spots: Spot[] = [
  {
    id: "s1",
    name: "Stellplatz Söderåsen",
    category: "stellplatz",
    description: "Ruhiger Waldrand-Platz nahe dem Nationalpark, ideal für den ersten Stopp.",
    lat: 56.02,
    lng: 13.22,
    mapsUrl: "https://maps.google.com/?q=56.02,13.22",
    infoUrl: "https://park4night.com/en/place/example-soderasen",
    overnightCost: "frei",
    tags: ["Wald", "Nacht", "ruhig"],
  },
  {
    id: "s2",
    name: "Kivik · Apfelküste",
    category: "ort",
    description: "Kleine Küstenstadt mit Märkten und guten Cafés zum Ankommen.",
    lat: 55.68,
    lng: 14.23,
    mapsUrl: "https://maps.google.com/?q=55.68,14.23",
    tags: ["Küste", "Stadt"],
  },
  {
    id: "s3",
    name: "Camping Öland Bridge",
    category: "stellplatz",
    description: "Kostenpflichtiger Stellplatz mit Strom und Sanitär vor der Inselroute.",
    lat: 56.66,
    lng: 16.42,
    mapsUrl: "https://maps.google.com/?q=56.66,16.42",
    infoUrl: "https://www.camping.se/example-oland",
    overnightCost: "kostenpflichtig",
    priceHint: "ab 280 SEK",
    tags: ["Strom", "Dusche"],
  },
  {
    id: "s4",
    name: "Kalmar Schloss",
    category: "sehenswuerdigkeit",
    description: "Renaissance-Schloss am Wasser — kurzer Stadtstopp vor Öland.",
    lat: 56.66,
    lng: 16.35,
    mapsUrl: "https://maps.google.com/?q=56.66,16.35",
    infoUrl: "https://kalmarslott.se",
    tags: ["Kultur", "Foto"],
  },
  {
    id: "s5",
    name: "Kayak im Schärengarten",
    category: "freizeit",
    description: "Halbtages-Tour zwischen den Inseln, Verleih vor Ort buchbar.",
    lat: 57.66,
    lng: 11.85,
    mapsUrl: "https://maps.google.com/?q=57.66,11.85",
    infoUrl: "https://example-kayak-sweden.se",
    tags: ["Wasser", "Aktiv"],
  },
  {
    id: "s6",
    name: "Stellplatz Tiveden",
    category: "stellplatz",
    description: "Wilder Wald-Spot, kostenlos aber ohne Service — nur Übernachtung.",
    lat: 58.72,
    lng: 14.61,
    mapsUrl: "https://maps.google.com/?q=58.72,14.61",
    infoUrl: "https://park4night.com/en/place/example-tiveden",
    overnightCost: "frei",
    tags: ["Natur", "Nacht"],
  },
  {
    id: "s7",
    name: "Höga Kusten Aussicht",
    category: "sehenswuerdigkeit",
    description: "Klassiker der Route: Weitblick über die Küste und die Brücke.",
    lat: 62.98,
    lng: 18.32,
    mapsUrl: "https://maps.google.com/?q=62.98,18.32",
    tags: ["Aussicht", "Highlight"],
  },
  {
    id: "s8",
    name: "ICA Maxi Örebro",
    category: "versorgung",
    description: "Großer Einkauf vor der längeren Etappe nach Norden.",
    lat: 59.27,
    lng: 15.21,
    mapsUrl: "https://maps.google.com/?q=59.27,15.21",
    tags: ["Einkauf"],
  },
];

export const days: DayPlan[] = [
  {
    date: "2026-07-10",
    title: "Anreise Skåne",
    overnightSpotId: "s1",
    spotIds: ["s2"],
    notes: "Fähre / Ankunft, entspannt einrollen.",
  },
  {
    date: "2026-07-11",
    title: "Richtung Öland",
    overnightSpotId: "s3",
    spotIds: ["s4", "s8"],
    notes: "Schloss + Einkauf, dann Stellplatz mit Strom.",
  },
  {
    date: "2026-07-12",
    title: "Westküste & Wasser",
    overnightSpotId: "s6",
    spotIds: ["s5"],
    notes: "Kayak am Morgen, danach Waldnacht in Tiveden.",
  },
  {
    date: "2026-07-13",
    title: "Etappe Höga Kusten",
    overnightSpotId: undefined,
    spotIds: ["s7"],
    notes: "Übernachtung noch offen — Spot aus der Sammlung wählen.",
  },
];

export const productPillars = [
  {
    title: "Urlaub anlegen",
    text: "Zeitraum, Typ (z. B. Van) und gemeinsame Infos festlegen. Ein Urlaub ist der Container für Spots, Tage und Team.",
  },
  {
    title: "Spots sammeln",
    text: "Stellplätze, Orte, Aktivitäten und Versorgungspunkte sammeln — mit Karte, Maps-Link und Buchungs-/Info-Link.",
  },
  {
    title: "Tage planen",
    text: "Jeden Reisetag mit Stops befüllen. Bei Van-Urlauben gehört zu jedem Tag optional ein Übernachtungsplatz (frei oder kostenpflichtig).",
  },
  {
    title: "Zusammenarbeiten",
    text: "Admin lädt mit, Gäste setzen Passwort und MFA. Danach planen beide im selben Urlaub.",
  },
];

export const dataModel = [
  {
    entity: "Vacation",
    fields: ["title", "dates", "type", "notes", "cover"],
    note: "Root-Objekt. Alles andere hängt daran.",
  },
  {
    entity: "Membership",
    fields: ["user", "role: admin|member", "invite status"],
    note: "Steuert Zugriff und Einladungen.",
  },
  {
    entity: "Spot",
    fields: [
      "category",
      "geo",
      "maps_url",
      "info_url",
      "overnight_cost",
      "tags",
    ],
    note: "Sammlung unabhängig vom Tagesplan.",
  },
  {
    entity: "DayPlan",
    fields: ["date", "ordered spots", "overnight_spot", "notes"],
    note: "Plant Spots auf konkrete Tage.",
  },
];
