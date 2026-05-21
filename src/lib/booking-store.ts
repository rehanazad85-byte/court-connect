// Tiny in-memory store for the demo booking flow.
// Replace with Cloud + Supabase when wiring real persistence.

type BookingState = {
  venueId: string;
  date: string; // "Sat, 24 May"
  time: string; // "13:00"
  durationHrs: number;
  players: number;
  courtIds: number[];
};

let state: BookingState = {
  venueId: "padel-club",
  date: "Sat, 24 May",
  time: "13:00",
  durationHrs: 2,
  players: 2,
  courtIds: [1, 2],
};

const listeners = new Set<() => void>();

export const bookingStore = {
  get: () => state,
  set: (patch: Partial<BookingState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

import { useSyncExternalStore } from "react";
export function useBooking() {
  return useSyncExternalStore(
    (cb) => bookingStore.subscribe(cb),
    () => bookingStore.get(),
    () => bookingStore.get(),
  );
}
