import { calculateEndDate } from './date.helper';

describe('calculateEndDate', () => {
  it('should return same date when totalHours is 0', () => {
    const start = new Date('2026-01-12T08:00:00Z');
    const result = calculateEndDate(start, 0);
    expect(result.getTime()).toBe(start.getTime());
  });

  it('should return same date when totalHours is negative', () => {
    const start = new Date('2026-01-12T08:00:00Z');
    const result = calculateEndDate(start, -5);
    expect(result.getTime()).toBe(start.getTime());
  });

  it('should calculate 16h from Monday 08:00 → Tuesday 17:00', () => {
    // Monday 2026-01-12 08:00 + 16h = Tuesday 2026-01-13 17:00
    const start = new Date('2026-01-12T08:00:00Z');
    const result = calculateEndDate(start, 16);
    const expected = new Date('2026-01-13T17:00:00Z');
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('should calculate 8h from Monday 08:00 → Monday 17:00', () => {
    const start = new Date('2026-01-12T08:00:00Z');
    const result = calculateEndDate(start, 8);
    const expected = new Date('2026-01-12T17:00:00Z');
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('should calculate 1h from Monday 08:00 → Monday 09:00', () => {
    const start = new Date('2026-01-12T08:00:00Z');
    const result = calculateEndDate(start, 1);
    const expected = new Date('2026-01-12T09:00:00Z');
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('should skip weekends: 8h from Friday 08:00 → Friday 17:00', () => {
    // Friday 2026-01-16 08:00 + 8h = Friday 2026-01-16 17:00
    const start = new Date('2026-01-16T08:00:00Z');
    const result = calculateEndDate(start, 8);
    const expected = new Date('2026-01-16T17:00:00Z');
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('should skip weekend: 16h from Friday 08:00 → Tuesday 17:00', () => {
    // Friday 8h + Monday 8h = 16h → Tuesday 17:00
    const start = new Date('2026-01-16T08:00:00Z');
    const result = calculateEndDate(start, 16);
    const expected = new Date('2026-01-20T17:00:00Z');
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('should skip weekend: 24h from Friday 08:00 → Wednesday 17:00', () => {
    // Friday 8h + Monday 8h + Tuesday 8h = 24h → Wednesday 17:00
    const start = new Date('2026-01-16T08:00:00Z');
    const result = calculateEndDate(start, 24);
    const expected = new Date('2026-01-21T17:00:00Z');
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('should handle partial last day: 10h from Monday 08:00 → Tuesday 19:00... wait, 10h = 8h Mon + 2h Tue = 10:00', () => {
    // Monday 8h + Tuesday 2h = Tuesday 10:00
    const start = new Date('2026-01-12T08:00:00Z');
    const result = calculateEndDate(start, 10);
    const expected = new Date('2026-01-13T10:00:00Z');
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('should handle start at 10:00 on Monday with 6h → 16:00', () => {
    // Start at 10:00, 6h available until 17:00
    const start = new Date('2026-01-12T10:00:00Z');
    const result = calculateEndDate(start, 6);
    const expected = new Date('2026-01-12T16:00:00Z');
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('should handle start at 14:00 on Monday with 10h → 8h remaining Mon + 2h Tue = 10:00', () => {
    // Start at 14:00, 3h available (14-17), then 8h Tue + 2h Wed = 10:00
    const start = new Date('2026-01-12T14:00:00Z');
    const result = calculateEndDate(start, 10);
    const expected = new Date('2026-01-14T10:00:00Z');
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('should handle large hours spanning multiple weeks: 40h from Monday → next Monday 17:00', () => {
    // Week 1: 8h Mon + 8h Tue + 8h Wed + 8h Thu + 8h Fri = 40h → Friday 17:00
    // Wait, 40h = 5 days × 8h = Friday 17:00
    const start = new Date('2026-01-12T08:00:00Z');
    const result = calculateEndDate(start, 40);
    const expected = new Date('2026-01-16T17:00:00Z');
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('should handle 48h from Monday → next Monday 17:00', () => {
    // 5 days week 1 (40h) + 8h Mon week 2 = Monday 17:00
    const start = new Date('2026-01-12T08:00:00Z');
    const result = calculateEndDate(start, 48);
    const expected = new Date('2026-01-19T17:00:00Z');
    expect(result.getTime()).toBe(expected.getTime());
  });
});
