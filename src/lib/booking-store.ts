import { useSyncExternalStore } from "react";

export type BookingState = {
  venueId: string | null;
  venueName: string | null;
  venueImage: string | null;
  dateISO: string | null;           // "2026-05-23"
  dateLabel: string | null;         // "Sat, 23 May"
  time: string | null;              // "13:00"
  durationMin: number;
  players: number;
  resourceIds: string[];
  resourceLabels: string[];
  pricePerCourtPence: number | null;
  searchActivity: string | null;
  searchCity: string | null;
};

const initial: BookingState = {
  venueId: null,
  venueName: null,
  venueImage: null,
  dateISO: null,
  dateLabel: null,
  time: null,
  durationMin: 60,
  players: 2,
  resourceIds: [],
  resourceLabels: [],
  pricePerCourtPence: null,
  searchActivity: null,
  searchCity: null,
};

let state: BookingState = { ...initial };
const listeners = new Set<() => void>();

export const bookingStore = {
  get: () => state,
  set: (patch: Partial<BookingState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  reset: () => {
    state = { ...initial };
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
    () => bookingStore.get(),
  );
}
