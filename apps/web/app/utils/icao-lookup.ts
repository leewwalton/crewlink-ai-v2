export type IcaoAirportItem = {
  id: string;
  metadata?: {
    code?: string;
    name?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};

export type IcaoAircraftItem = {
  id: string;
  metadata?: {
    code?: string;
    manufacturer?: string;
    model?: string;
    engineCount?: string;
    engineType?: string;
    type?: string;
  };
};

export const ICAO_AIRPORTS_PATH = "/assets/icao-airports.json";
export const ICAO_AIRCRAFT_PATH = "/assets/icao-aircraft.json";

export function getAirportSuggestions(
  airports: IcaoAirportItem[],
  query: string,
): IcaoAirportItem[] {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return [];
  return airports
    .filter(
      (item) =>
        (item.metadata?.code ?? "").toLowerCase().includes(q) ||
        (item.metadata?.name ?? "").toLowerCase().includes(q) ||
        (item.metadata?.city ?? "").toLowerCase().includes(q) ||
        (item.metadata?.country ?? "").toLowerCase().includes(q),
    )
    .slice(0, 15);
}

export function getAircraftSuggestions(
  aircraft: IcaoAircraftItem[],
  query: string,
): IcaoAircraftItem[] {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return [];
  return aircraft
    .filter(
      (item) =>
        (item.metadata?.code ?? "").toLowerCase().includes(q) ||
        (item.metadata?.manufacturer ?? "").toLowerCase().includes(q) ||
        (item.metadata?.model ?? "").toLowerCase().includes(q),
    )
    .slice(0, 15);
}

export function airportLabel(item: IcaoAirportItem): string {
  return [item.metadata?.name, item.metadata?.city, item.metadata?.country]
    .filter(Boolean)
    .join(", ");
}

export function aircraftLabel(item: IcaoAircraftItem): string {
  return [item.metadata?.manufacturer, item.metadata?.model].filter(Boolean).join(" ");
}

export function airportCode(item: IcaoAirportItem): string {
  return item.metadata?.code ?? item.id;
}

export function aircraftCode(item: IcaoAircraftItem): string {
  return item.metadata?.code ?? item.id;
}
