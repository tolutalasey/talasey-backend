// Cached count of places taken per day in a zone. Cleared by anything that changes the count.
export const slotTakenKey = (zone: string) => `slot-taken:${zone}`;
