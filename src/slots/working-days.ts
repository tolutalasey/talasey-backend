const londonDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayInLondon(now: Date): string {
  return londonDate.format(now);
}

function weekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function nextDay(date: string): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function isWorkingDay(date: string): boolean {
  const day = weekday(date);
  return day !== 0 && day !== 6;
}

export function addWorkingDays(date: string, days: number): string {
  let current = date;
  let added = 0;
  while (added < days || !isWorkingDay(current)) {
    current = nextDay(current);
    if (isWorkingDay(current)) added += 1;
  }
  return current;
}

export function workingDaysFrom(first: string, count: number): string[] {
  const dates: string[] = [];
  let current = first;
  while (dates.length < count) {
    if (isWorkingDay(current)) dates.push(current);
    current = nextDay(current);
  }
  return dates;
}
