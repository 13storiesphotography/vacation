export type SpotCategory =
  | "stellplatz"
  | "unterkunft"
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
  rating?: number;
  archived?: boolean;
};

export type DayPlan = {
  date: string;
  title: string;
  overnightSpotId?: string;
  spotIds: string[];
  notes?: string;
  departAt?: string;
  etaHint?: string;
};

export type CollaboratorRole = "admin" | "editor" | "viewer";

export type Collaborator = {
  id: string;
  name: string;
  email: string;
  role: CollaboratorRole;
  status: "active" | "invited";
};

export const categoryLabels: Record<SpotCategory, string> = {
  stellplatz: "Stellplatz",
  unterkunft: "Unterkunft",
  sehenswuerdigkeit: "Sehenswürdigkeit",
  ort: "Ort",
  freizeit: "Freizeit",
  versorgung: "Versorgung",
};

export const categoryTone: Record<SpotCategory, string> = {
  stellplatz: "#2f6f5e",
  unterkunft: "#3d5a80",
  sehenswuerdigkeit: "#b56a3c",
  ort: "#1f5f78",
  freizeit: "#6a7a2f",
  versorgung: "#6b5a3c",
};

export const roleLabels: Record<CollaboratorRole, string> = {
  admin: "Admin",
  editor: "Bearbeiter",
  viewer: "Betrachter",
};

export const vacation = {
  title: "Schweden Van Trip",
  subtitle: "Wohnmobil · Mittsommer-Route",
  type: "Wohnmobil / Van",
  region: "Schweden · Süd nach Nord",
  startDate: "2026-07-10",
  endDate: "2026-07-24",
  homeLabel: "Zuhause",
  homeHint: "Anreise & Rückfahrt in Sprit und Route",
  budgetHint: "Budget 2.500 € · ca. 1.420 km inkl. Heimweg",
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
  },
  {
    id: "u2",
    name: "Partner:in",
    email: "partner@example.com",
    role: "editor",
    status: "invited",
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
    rating: 4.5,
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
    rating: 4,
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
    rating: 3.5,
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
    rating: 5,
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
    rating: 4,
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
    rating: 5,
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
  {
    id: "s9",
    name: "AirBnB Malmö Hafen",
    category: "unterkunft",
    description: "Optionale Soft-Night vor dem Van-Start — Archiv-Beispiel.",
    lat: 55.61,
    lng: 12.99,
    mapsUrl: "https://maps.google.com/?q=55.61,12.99",
    infoUrl: "https://www.airbnb.com/example",
    overnightCost: "kostenpflichtig",
    priceHint: "ab 95 €",
    tags: ["Stadt", "Anreise"],
    archived: true,
  },
];

export const days: DayPlan[] = [
  {
    date: "2026-07-10",
    title: "Anreise Skåne",
    overnightSpotId: "s1",
    spotIds: ["s2"],
    notes: "Fähre / Ankunft, entspannt einrollen.",
    departAt: "08:30",
    etaHint: "ca. 2,1 Std · inkl. Anreise von Zuhause",
  },
  {
    date: "2026-07-11",
    title: "Richtung Öland",
    overnightSpotId: "s3",
    spotIds: ["s4", "s8"],
    notes: "Schloss + Einkauf, dann Stellplatz mit Strom.",
    departAt: "09:00",
    etaHint: "ca. 3,4 Std · Google-Routenzeit",
  },
  {
    date: "2026-07-12",
    title: "Westküste & Wasser",
    overnightSpotId: "s6",
    spotIds: ["s5"],
    notes: "Kayak am Morgen, danach Waldnacht in Tiveden.",
    departAt: "10:15",
    etaHint: "ca. 4,0 Std",
  },
  {
    date: "2026-07-13",
    title: "Etappe Höga Kusten",
    overnightSpotId: undefined,
    spotIds: ["s7"],
    notes: "Übernachtung noch offen — Spot aus der Sammlung wählen.",
    departAt: "08:00",
    etaHint: "lange Etappe · Stauhinweis möglich",
  },
];

export const costPreview = {
  fuelEstimate: "Sprit ca. 248 € · 1.420 km",
  overnight: "Übernachtungen 4 Nächte · 2 ohne Preis",
  openItems: "ECOFLOW Delta 3 Plus · offen",
};

export const productPillars = [
  {
    title: "Urlaub anlegen",
    text: "Zeitraum, Typ und Startadresse festlegen. Der Urlaub ist der Container für Spots, Plan, Kosten und Team.",
  },
  {
    title: "Spots sammeln",
    text: "Links rein, Details ergänzen, bewerten und archivieren. Auf der Karte antippen und direkt bearbeiten.",
  },
  {
    title: "Tage & Route planen",
    text: "Stops und Übernachtungen setzen — mit Abfahrt, Fahrzeiten und Routenübersicht inkl. Anreise von Zuhause.",
  },
  {
    title: "Kosten im Blick",
    text: "Budget, Sprit-Schätzung und Positionen. Anreise/Rückfahrt fließen über die Heimatadresse ein.",
  },
  {
    title: "Team & Rechte",
    text: "Per Link einladen, Rolle wählen (Betrachter / Bearbeiter / Admin). MFA mit Grace-Zeit, nicht als harte Sperre vor dem Plan.",
  },
];

export const dataModel = [
  {
    entity: "Vacation",
    fields: ["title", "dates", "type", "home_*", "budget", "fuel"],
    note: "Root-Objekt inkl. Startadresse für Sprit und Route.",
  },
  {
    entity: "Membership",
    fields: ["role: viewer|editor|admin|custom", "permissions", "invite"],
    note: "Feingranulare Rechte und Einladungen.",
  },
  {
    entity: "Spot",
    fields: ["category", "geo", "maps/info_url", "ratings", "is_relevant", "stay"],
    note: "Sammlung unabhängig vom Tagesplan; Archiv möglich.",
  },
  {
    entity: "DayPlan",
    fields: ["date", "stops", "overnight", "depart_at", "dwell"],
    note: "Plant Spots auf Tage — Basis für ETAs und Route.",
  },
  {
    entity: "CostItem",
    fields: ["category", "amount", "status", "notes"],
    note: "Budget, Anschaffungen, Sprit-Übernahme.",
  },
];
