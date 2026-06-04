import { useSyncExternalStore } from "react";

export type BookingState = {
  venueId: string | null;
  venueName: string | null;
  venueImage: string | null;
  dateISO: string | null;
  dateLabel: string | null;
  time: string | null;
  /** Exact UTC ISO datetime for the slot start — authoritative for overnight venues.
   *  Always set by the venue page from the server-returned slot.startsAtISO. */
  startsAtISO: string | null;
  durationMin: number;
  players: number;
  resourceIds: string[];
  resourceLabels: string[];
  pricePerCourtPence: number | null;
  searchActivity: string | null;
  searchCity: string | null;
};

const STORAGE_KEY = "knox_booking_draft";

const initial: BookingState = {
  venueId: null,
  venueName: null,
  venueImage: null,
  dateISO: null,
  dateLabel: null,
  time: null,
  startsAtISO: null,
  durationMin: 60,
  players: 2,
  resourceIds: [],
  resourceLabels: [],
  pricePerCourtPence: null,
  searchActivity: null,
  searchCity: null,
};

function loadFromStorage(): BookingState {
  if (typeof window === "undefined") return { ...initial };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...initial };
    return { ...initial, ...JSON.parse(raw) };
  } catch {
    return { ...initial };
  }
}

function saveToStorage(s: BookingState) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

function clearStorage() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

let state: BookingState = loadFromStorage();
const listeners = new Set<() => void>();

export const bookingStore = {
  get: () => state,
  set: (patch: Partial<BookingState>) => {
    state = { ...state, ...patch };
    saveToStorage(state);
    listeners.forEach((l) => l());
  },
  reset: () => {
    state = { ...initial };
    clearStorage();
    listeners.forEach((l) => l());
  },
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useBooking() {
  return useSyncExternalStore(
    (cb) => bookingStore.subscribe(cb),
    () => bookingStore.get(),
    () => ({ ...initial }),
  );
}
