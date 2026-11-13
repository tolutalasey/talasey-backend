import { describe, expect, it } from 'vitest';
import { addWorkingDays, isWorkingDay, todayInLondon, workingDaysFrom } from './working-days.js';

describe('working days', () => {
  it('uses the London date, not UTC', () => {
    expect(todayInLondon(new Date('2026-06-30T23:30:00Z'))).toBe('2026-07-01');
    expect(todayInLondon(new Date('2026-12-31T23:30:00Z'))).toBe('2026-12-31');
  });

  it('knows weekends', () => {
    expect(isWorkingDay('2026-11-13')).toBe(true);
    expect(isWorkingDay('2026-11-14')).toBe(false);
    expect(isWorkingDay('2026-11-15')).toBe(false);
  });

  it('adds working days across a weekend', () => {
    expect(addWorkingDays('2026-11-12', 2)).toBe('2026-11-16');
    expect(addWorkingDays('2026-11-14', 0)).toBe('2026-11-16');
    expect(addWorkingDays('2026-11-13', 1)).toBe('2026-11-16');
  });

  it('lists the next working days', () => {
    expect(workingDaysFrom('2026-11-13', 3)).toEqual(['2026-11-13', '2026-11-16', '2026-11-17']);
  });
});
