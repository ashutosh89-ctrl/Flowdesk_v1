/**
 * Pure Business Rules: Recurring Invoices
 *
 * ZERO I/O: Pure deterministic date calculations, occurrence projection,
 * month-end clamping, and period key generation.
 * Shared directly across server jobs, route handlers, and UI preview components.
 */

export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
export type RecurringStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface RecurringScheduleRuleInput {
  frequency: RecurringFrequency;
  intervalDays?: number | null;
  anchorDate: string | Date;
  dayOfMonth?: number | null;
  timezone?: string;
  endsOn?: string | Date | null;
  maxOccurrences?: number | null;
  occurrencesCount?: number;
}

/**
 * Returns the number of days in a given year and month (1-indexed month: 1=Jan, 12=Dec).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Checks whether a given year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Normalizes an input to a UTC Date object.
 */
function toUtcDate(input: string | Date): Date {
  if (input instanceof Date) {
    return new Date(input.getTime());
  }
  const parsed = new Date(input);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date string: ${input}`);
  }
  return parsed;
}

/**
 * Generates an ISO date string 'YYYY-MM-DD' in UTC.
 */
export function formatIsoDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Generates an idempotent recurrence period key for an occurrence.
 * Format: 'YYYY-MM-DD' representing the scheduled billing anchor date.
 */
export function generatePeriodKey(
  schedule: { frequency: RecurringFrequency; dayOfMonth?: number | null },
  occurrenceDate: Date | string
): string {
  const d = toUtcDate(occurrenceDate);
  return formatIsoDateOnly(d);
}

/**
 * Computes the next scheduled run timestamp after a given reference date ('from').
 *
 * Invariants:
 * 1. Preserves original anchor day-of-month across months of varying length.
 *    (e.g., Day 31 -> Jan 31 -> Feb 28/29 -> Mar 31 -> Apr 30 -> May 31).
 * 2. Properly handles leap years for Feb 29 (clamped to Feb 28 in non-leap years).
 * 3. Supports weekly (+7 days), monthly (+1 month), quarterly (+3 months),
 *    yearly (+1 year), and custom (+intervalDays).
 * 4. Respects endsOn boundary: if nextRun > endsOn, returns null.
 * 5. Respects maxOccurrences boundary: if occurrencesCount >= maxOccurrences, returns null.
 * 6. Always advances strictly into the future relative to 'from'.
 */
export function computeNextRunAt(
  schedule: RecurringScheduleRuleInput,
  from: Date | string = new Date()
): Date | null {
  // 1. Quota / Occurrence limit check
  const count = schedule.occurrencesCount ?? 0;
  if (schedule.maxOccurrences !== null && schedule.maxOccurrences !== undefined && schedule.maxOccurrences > 0) {
    if (count >= schedule.maxOccurrences) {
      return null;
    }
  }

  const anchor = toUtcDate(schedule.anchorDate);
  const fromDate = toUtcDate(from);

  // If fromDate is prior to anchorDate, the first occurrence is anchorDate
  if (anchor.getTime() > fromDate.getTime()) {
    // Check endsOn boundary
    if (schedule.endsOn) {
      const ends = toUtcDate(schedule.endsOn);
      if (anchor.getTime() > ends.getTime()) return null;
    }
    return anchor;
  }

  // Determine anchor day of month (1-31)
  const anchorDay = schedule.dayOfMonth && schedule.dayOfMonth >= 1 && schedule.dayOfMonth <= 31
    ? schedule.dayOfMonth
    : anchor.getUTCDate();

  const anchorHours = anchor.getUTCHours();
  const anchorMinutes = anchor.getUTCMinutes();
  const anchorSeconds = anchor.getUTCSeconds();

  let nextCandidate: Date;

  switch (schedule.frequency) {
    case 'weekly': {
      // Advance by 7 days until > fromDate
      const diffMs = fromDate.getTime() - anchor.getTime();
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const weeksPassed = Math.floor(diffMs / weekMs);
      const nextWeekCount = weeksPassed + 1;
      nextCandidate = new Date(anchor.getTime() + nextWeekCount * weekMs);
      while (nextCandidate.getTime() <= fromDate.getTime()) {
        nextCandidate = new Date(nextCandidate.getTime() + weekMs);
      }
      break;
    }

    case 'custom': {
      const interval = Math.max(1, schedule.intervalDays || 1);
      const dayMs = 24 * 60 * 60 * 1000;
      const stepMs = interval * dayMs;
      const diffMs = fromDate.getTime() - anchor.getTime();
      const stepsPassed = Math.floor(diffMs / stepMs);
      nextCandidate = new Date(anchor.getTime() + (stepsPassed + 1) * stepMs);
      while (nextCandidate.getTime() <= fromDate.getTime()) {
        nextCandidate = new Date(nextCandidate.getTime() + stepMs);
      }
      break;
    }

    case 'monthly':
    case 'quarterly':
    case 'yearly': {
      const monthStep = schedule.frequency === 'monthly' ? 1 : schedule.frequency === 'quarterly' ? 3 : 12;

      // Start from fromDate year and month
      let targetYear = fromDate.getUTCFullYear();
      let targetMonth = fromDate.getUTCMonth(); // 0-indexed

      // Create candidate for current targetMonth
      const maxDaysThisMonth = getDaysInMonth(targetYear, targetMonth + 1);
      const clampedDay = Math.min(anchorDay, maxDaysThisMonth);
      let cand = new Date(Date.UTC(targetYear, targetMonth, clampedDay, anchorHours, anchorMinutes, anchorSeconds));

      // If cand is still <= fromDate, advance by monthStep
      if (cand.getTime() <= fromDate.getTime()) {
        targetMonth += monthStep;
        while (targetMonth >= 12) {
          targetYear += 1;
          targetMonth -= 12;
        }
        const maxDaysNext = getDaysInMonth(targetYear, targetMonth + 1);
        const clampedDayNext = Math.min(anchorDay, maxDaysNext);
        cand = new Date(Date.UTC(targetYear, targetMonth, clampedDayNext, anchorHours, anchorMinutes, anchorSeconds));
      }

      nextCandidate = cand;
      break;
    }

    default:
      throw new Error(`Unsupported recurring frequency: ${(schedule as any).frequency}`);
  }

  // 4. Validate endsOn boundary
  if (schedule.endsOn) {
    const ends = toUtcDate(schedule.endsOn);
    // Align ends to end of that calendar day (23:59:59.999 UTC)
    const endOfDay = new Date(Date.UTC(
      ends.getUTCFullYear(),
      ends.getUTCMonth(),
      ends.getUTCDate(),
      23, 59, 59, 999
    ));
    if (nextCandidate.getTime() > endOfDay.getTime()) {
      return null;
    }
  }

  return nextCandidate;
}

/**
 * Projects the upcoming N occurrences for a schedule starting from a reference date.
 * Useful for UI schedule preview modal and validation testing.
 */
export function projectUpcomingOccurrences(
  schedule: RecurringScheduleRuleInput,
  count: number = 3,
  from: Date | string = new Date()
): { runAt: Date; periodKey: string }[] {
  const results: { runAt: Date; periodKey: string }[] = [];
  let currentRef = from;
  let simulatedCount = schedule.occurrencesCount ?? 0;

  for (let i = 0; i < count; i++) {
    const simulatedSchedule = {
      ...schedule,
      occurrencesCount: simulatedCount,
    };
    const next = computeNextRunAt(simulatedSchedule, currentRef);
    if (!next) break;

    results.push({
      runAt: next,
      periodKey: generatePeriodKey(schedule, next),
    });

    currentRef = next;
    simulatedCount++;
  }

  return results;
}
