/**
 * Calculate the estimated end date for a scheduled service based on total hours.
 *
 * Business rules:
 * - Business hours: 08:00–17:00 (8h work per day)
 * - Weekends (Saturday/Sunday) are non-working days
 * - Partial first/last days are handled proportionally
 *
 * @param startDateTime - The start date/time of the service
 * @param totalHours - Total hours of work needed
 * @returns The calculated end date/time
 */
export function calculateEndDate(startDateTime: Date, totalHours: number): Date {
  if (!totalHours || totalHours <= 0) {
    return new Date(startDateTime);
  }

  const BUSINESS_DAY_HOURS = 8;
  const DAY_START_HOUR = 8;
  const DAY_END_HOUR = 17;

  // Create a mutable copy of the start date
  const current = new Date(startDateTime);
  let hoursRemaining = totalHours;

  while (hoursRemaining > 0) {
    const dayOfWeek = current.getDay(); // 0=Sun, 6=Sat

    // Skip weekends
    if (dayOfWeek === 0) {
      // Sunday → go to Monday 08:00
      current.setDate(current.getDate() + 1);
      current.setHours(DAY_START_HOUR, 0, 0, 0);
      continue;
    }
    if (dayOfWeek === 6) {
      // Saturday → go to Monday 08:00
      current.setDate(current.getDate() + (7 - dayOfWeek + 1));
      current.setHours(DAY_START_HOUR, 0, 0, 0);
      continue;
    }

    // Calculate available hours for this day
    const dayStart = new Date(current);
    const dayEnd = new Date(current);
    dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);

    // If current time is before 08:00, start from 08:00
    if (current.getHours() < DAY_START_HOUR) {
      dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
    }

    const availableMs = dayEnd.getTime() - dayStart.getTime();
    const availableHours = availableMs / (1000 * 60 * 60);

    if (availableHours <= 0) {
      // Move to next day 08:00
      const nextDay = new Date(current);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(DAY_START_HOUR, 0, 0, 0);
      current.setTime(nextDay.getTime());
      continue;
    }

    if (hoursRemaining <= availableHours) {
      // Finish within this day
      const endMs = current.getTime() + hoursRemaining * 60 * 60 * 1000;
      return new Date(endMs);
    }

    // Subtract available hours and move to next day
    hoursRemaining -= availableHours;
    const nextDay = new Date(current);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(DAY_START_HOUR, 0, 0, 0);
    current.setTime(nextDay.getTime());
  }

  return new Date(current);
}
