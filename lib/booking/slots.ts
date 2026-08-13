const BUSINESS_HOURS = { startHour: 9, endHour: 18 }; // 9am–6pm
const SLOT_LENGTH_MINUTES = 60;
const DAYS_AHEAD = 7;

export interface Slot {
  iso: string; // e.g. "2026-07-28T10:00:00.000Z" — always UTC on the wire
  label: string; // human display, e.g. "Tue 28 Jul, 10:00 AM"
}

/**
 * Builds the full grid of bookable hourly slots for the next N days
 * (Mon–Sat, business hours only), then removes any slot that overlaps
 * an already-scheduled appointment. This is what keeps the booking
 * agent honest — it is only ever shown slots that are actually free.
 */
export function generateAvailableSlots(
  bookedIsoTimes: string[],
  daysAhead: number = DAYS_AHEAD
): Slot[] {
  const booked = new Set(bookedIsoTimes.map((t) => new Date(t).toISOString()));
  const slots: Slot[] = [];
  const now = new Date();

  for (let d = 0; d < daysAhead; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);

    // Skip Sundays (day 0) — adjust here if the business has different hours.
    if (day.getDay() === 0) continue;

    for (let hour = BUSINESS_HOURS.startHour; hour < BUSINESS_HOURS.endHour; hour++) {
      const slotDate = new Date(day);
      slotDate.setHours(hour, 0, 0, 0);

      // Skip slots already in the past today.
      if (slotDate.getTime() <= now.getTime()) continue;

      const iso = slotDate.toISOString();
      if (booked.has(iso)) continue;

      slots.push({
        iso,
        label: slotDate.toLocaleString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      });
    }
  }

  return slots;
}

export const SLOT_LENGTH_MS = SLOT_LENGTH_MINUTES * 60 * 1000;
