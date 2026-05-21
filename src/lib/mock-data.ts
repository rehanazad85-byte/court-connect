import venuePadel1 from "@/assets/venue-padel-1.jpg";
import venuePadel2 from "@/assets/venue-padel-2.jpg";
import venuePadel3 from "@/assets/venue-padel-3.jpg";
import activityPadel from "@/assets/activity-padel.jpg";
import activitySnooker from "@/assets/activity-snooker.jpg";
import activityPool from "@/assets/activity-pool.jpg";
import activityDarts from "@/assets/activity-darts.jpg";

export const activities = [
  { id: "padel", name: "Padel Tennis", tagline: "Book Courts", image: activityPadel },
  { id: "snooker", name: "Snooker", tagline: "Book Tables", image: activitySnooker },
  { id: "pool", name: "Pool", tagline: "Book Tables", image: activityPool },
  { id: "darts", name: "Darts", tagline: "Book Lanes", image: activityDarts },
];

export type Venue = {
  id: string;
  name: string;
  activity: string;
  type: "Indoor" | "Outdoor";
  courts: number;
  distance: string;
  rating: number;
  priceLow: number;
  priceHigh: number;
  image: string;
};

export const venues: Venue[] = [
  { id: "padel-club", name: "The Padel Club", activity: "padel", type: "Indoor", courts: 6, distance: "2.1 miles away", rating: 4.8, priceLow: 28, priceHigh: 40, image: venuePadel1 },
  { id: "urban-padel", name: "Urban Padel", activity: "padel", type: "Outdoor", courts: 4, distance: "3.4 miles away", rating: 4.7, priceLow: 24, priceHigh: 36, image: venuePadel2 },
  { id: "smash-padel", name: "Smash Padel Manchester", activity: "padel", type: "Indoor", courts: 5, distance: "4.0 miles away", rating: 4.6, priceLow: 26, priceHigh: 38, image: venuePadel3 },
];

export const getVenue = (id: string) => venues.find((v) => v.id === id) ?? venues[0];

export const timeSlots = [
  "07:00","08:00","09:00","10:00",
  "11:00","12:00","13:00","14:00",
  "15:00","16:00","17:00","18:00",
  "19:00","20:00","21:00","22:00",
];

// Some slots unavailable for realism
export const unavailableSlots = new Set(["19:00","20:00","21:00","22:00"]);

export const dateOptions = [
  { dow: "Thu", day: "22", mon: "May" },
  { dow: "Fri", day: "23", mon: "May" },
  { dow: "Sat", day: "24", mon: "May" },
  { dow: "Sun", day: "25", mon: "May" },
  { dow: "Mon", day: "26", mon: "May" },
];

export const courts = [
  { id: 1, name: "Court 1", type: "Indoor", price: 32, available: true },
  { id: 2, name: "Court 2", type: "Indoor", price: 32, available: true },
  { id: 3, name: "Court 3", type: "Indoor", price: 32, available: true },
  { id: 4, name: "Court 4", type: "Indoor", price: 32, available: true },
  { id: 5, name: "Court 5", type: "Indoor", price: 32, available: true },
  { id: 6, name: "Court 6", type: "Indoor", price: 32, available: true },
];
