export type DayWeather = {
  date: string;
  code: number;
  label: string;
  icon: "sun" | "cloud" | "rain" | "snow" | "storm" | "fog";
  tempMax: number;
  tempMin: number;
  precipProb: number | null;
};

const WMO: Record<number, { label: string; icon: DayWeather["icon"] }> = {
  0: { label: "Klar", icon: "sun" },
  1: { label: "Überwiegend klar", icon: "sun" },
  2: { label: "Teilweise bewölkt", icon: "cloud" },
  3: { label: "Bedeckt", icon: "cloud" },
  45: { label: "Nebel", icon: "fog" },
  48: { label: "Reifnebel", icon: "fog" },
  51: { label: "Leichter Niesel", icon: "rain" },
  53: { label: "Nieselregen", icon: "rain" },
  55: { label: "Starker Niesel", icon: "rain" },
  61: { label: "Leichter Regen", icon: "rain" },
  63: { label: "Regen", icon: "rain" },
  65: { label: "Starker Regen", icon: "rain" },
  66: { label: "Gefrierender Regen", icon: "rain" },
  67: { label: "Gefrierender Regen", icon: "rain" },
  71: { label: "Leichter Schnee", icon: "snow" },
  73: { label: "Schnee", icon: "snow" },
  75: { label: "Starker Schnee", icon: "snow" },
  77: { label: "Schneegriesel", icon: "snow" },
  80: { label: "Regenschauer", icon: "rain" },
  81: { label: "Regenschauer", icon: "rain" },
  82: { label: "Starke Schauer", icon: "rain" },
  85: { label: "Schneeschauer", icon: "snow" },
  86: { label: "Schneeschauer", icon: "snow" },
  95: { label: "Gewitter", icon: "storm" },
  96: { label: "Gewitter mit Hagel", icon: "storm" },
  99: { label: "Gewitter mit Hagel", icon: "storm" },
};

function describeCode(code: number): { label: string; icon: DayWeather["icon"] } {
  return WMO[code] ?? { label: "Wetter", icon: "cloud" };
}

type ForecastJson = {
  daily?: {
    time?: string[];
    weathercode?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: Array<number | null>;
  };
};

/**
 * Open-Meteo daily forecast (no API key). Returns a map keyed by YYYY-MM-DD.
 * Only dates within the provider forecast window are filled.
 */
export async function fetchDailyWeather(input: {
  lat: number;
  lng: number;
  startDate: string;
  endDate: string;
}): Promise<Map<string, DayWeather>> {
  const result = new Map<string, DayWeather>();
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", input.lat.toFixed(4));
  url.searchParams.set("longitude", input.lng.toFixed(4));
  url.searchParams.set(
    "daily",
    "weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
  );
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("start_date", input.startDate);
  url.searchParams.set("end_date", input.endDate);

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 3600 },
    });
    if (!response.ok) return result;
    const json = (await response.json()) as ForecastJson;
    const times = json.daily?.time ?? [];
    for (let i = 0; i < times.length; i += 1) {
      const date = times[i];
      const code = json.daily?.weathercode?.[i] ?? 2;
      const meta = describeCode(code);
      const tempMax = json.daily?.temperature_2m_max?.[i];
      const tempMin = json.daily?.temperature_2m_min?.[i];
      if (typeof tempMax !== "number" || typeof tempMin !== "number") continue;
      const precip = json.daily?.precipitation_probability_max?.[i];
      result.set(date, {
        date,
        code,
        label: meta.label,
        icon: meta.icon,
        tempMax: Math.round(tempMax),
        tempMin: Math.round(tempMin),
        precipProb: typeof precip === "number" ? precip : null,
      });
    }
  } catch {
    // Weather is optional — dashboard still works without it.
  }
  return result;
}
