/**
 * Per-trip resources added from Resource Inventory (local persistence).
 */

const STORAGE_KEY = "tourwise_trip_resources_v1";

export type StoredBusResource = {
  id: string;
  operator: string;
  serviceNumber: string;
  route: string;
  departure: string;
  arrival: string;
  duration: string;
  stops: number;
  seats: number;
  price: number;
  coachClass: string;
  addedAt: string;
};

export type StoredHotelResource = {
  id: string;
  name: string;
  stars: number;
  address: string;
  pricePerNight: number;
  roomType: string;
  addedAt: string;
};

export type TripResourcesPayload = {
  buses: StoredBusResource[];
  hotels: StoredHotelResource[];
};

function loadAll(): Record<string, TripResourcesPayload> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, TripResourcesPayload>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, TripResourcesPayload>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getTripResources(tripId: number): TripResourcesPayload {
  const all = loadAll();
  const key = String(tripId);
  return all[key] ?? { buses: [], hotels: [] };
}

export function addBusesToTrip(tripId: number, buses: Omit<StoredBusResource, "id" | "addedAt">[]) {
  const all = loadAll();
  const key = String(tripId);
  const cur = all[key] ?? { buses: [], hotels: [] };
  const now = new Date().toISOString();
  const newBuses: StoredBusResource[] = buses.map((b, i) => ({
    ...b,
    id: `bus-${tripId}-${Date.now()}-${i}`,
    addedAt: now,
  }));
  all[key] = { ...cur, buses: [...cur.buses, ...newBuses] };
  saveAll(all);
}

export function addHotelsToTrip(tripId: number, hotels: Omit<StoredHotelResource, "id" | "addedAt">[]) {
  const all = loadAll();
  const key = String(tripId);
  const cur = all[key] ?? { buses: [], hotels: [] };
  const now = new Date().toISOString();
  const newHotels: StoredHotelResource[] = hotels.map((h, i) => ({
    ...h,
    id: `hotel-${tripId}-${Date.now()}-${i}`,
    addedAt: now,
  }));
  all[key] = { ...cur, hotels: [...cur.hotels, ...newHotels] };
  saveAll(all);
}

export function busPnr(bus: StoredBusResource): string {
  const seed = bus.id.replace(/\D/g, "").slice(-6) || "000000";
  return `BUS-TW-${seed.slice(0, 3)}-${seed.slice(3, 6)}`.toUpperCase();
}

export function hotelConfCode(hotel: StoredHotelResource): string {
  const seed = hotel.id.replace(/\D/g, "").slice(-6) || "000000";
  const prefix = hotel.name
    .slice(0, 3)
    .toUpperCase()
    .replace(/[^A-Z]/g, "X");
  return `HTL-${prefix}${seed.slice(0, 4)}`;
}

export function totalImportedSeats(resources: TripResourcesPayload): number {
  return resources.buses.reduce((s, b) => s + (b.seats || 0), 0);
}
