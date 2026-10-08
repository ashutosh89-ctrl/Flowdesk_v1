/**
 * Tests: Recurring Rules (Pure Business Rules)
 *
 * Exhaustive verification of scheduling calculations, month-end clamping,
 * leap years, year boundaries, ends_on, and period keys.
 */

import assert from 'assert';
import test, { describe } from 'node:test';
import {
  computeNextRunAt,
  generatePeriodKey,
  getDaysInMonth,
  isLeapYear,
  projectUpcomingOccurrences,
  formatIsoDateOnly,
} from '../src/shared/rules/recurring-rules';

describe('Pure Recurring Rules Suite', () => {
  test('Leap year identification', () => {
    assert.strictEqual(isLeapYear(2024), true);
    assert.strictEqual(isLeapYear(2026), false);
    assert.strictEqual(isLeapYear(2000), true);
    assert.strictEqual(isLeapYear(1900), false);
    assert.strictEqual(isLeapYear(2028), true);
  });

  test('Days in month calculation across leap and non-leap years', () => {
    assert.strictEqual(getDaysInMonth(2026, 1), 31); // Jan
    assert.strictEqual(getDaysInMonth(2026, 2), 28); // Feb (non-leap)
    assert.strictEqual(getDaysInMonth(2028, 2), 29); // Feb (leap)
    assert.strictEqual(getDaysInMonth(2026, 4), 30); // Apr
    assert.strictEqual(getDaysInMonth(2026, 12), 31); // Dec
  });

  test('Month-end clamping: Jan 31 anchor rolls cleanly through Feb 28, Mar 31, Apr 30', () => {
    const schedule = {
      frequency: 'monthly' as const,
      anchorDate: '2026-01-31T00:00:00.000Z',
      dayOfMonth: 31,
    };

    // Step 1: After Jan 31, next is Feb 28 (clamped from 31)
    const runFeb = computeNextRunAt(schedule, '2026-01-31T00:00:00.000Z');
    assert.ok(runFeb);
    assert.strictEqual(formatIsoDateOnly(runFeb), '2026-02-28');
    assert.strictEqual(generatePeriodKey(schedule, runFeb), '2026-02-28');

    // Step 2: After Feb 28, next is Mar 31 (reverts to original anchor day 31!)
    const runMar = computeNextRunAt(schedule, runFeb);
    assert.ok(runMar);
    assert.strictEqual(formatIsoDateOnly(runMar), '2026-03-31');

    // Step 3: After Mar 31, next is Apr 30 (clamped from 31)
    const runApr = computeNextRunAt(schedule, runMar);
    assert.ok(runApr);
    assert.strictEqual(formatIsoDateOnly(runApr), '2026-04-30');

    // Step 4: After Apr 30, next is May 31
    const runMay = computeNextRunAt(schedule, runApr);
    assert.ok(runMay);
    assert.strictEqual(formatIsoDateOnly(runMay), '2026-05-31');
  });

  test('Leap year Feb 29 handling: 2028-02-29 anchor clamps to Feb 28 in 2029', () => {
    const leapSchedule = {
      frequency: 'yearly' as const,
      anchorDate: '2028-02-29T00:00:00.000Z',
      dayOfMonth: 29,
    };

    const nextYearRun = computeNextRunAt(leapSchedule, '2028-02-29T00:00:00.000Z');
    assert.ok(nextYearRun);
    assert.strictEqual(formatIsoDateOnly(nextYearRun), '2029-02-28');
  });

  test('Weekly recurrence across year boundary', () => {
    const weeklySchedule = {
      frequency: 'weekly' as const,
      anchorDate: '2026-12-28T00:00:00.000Z',
    };

    const nextWeek = computeNextRunAt(weeklySchedule, '2026-12-28T00:00:00.000Z');
    assert.ok(nextWeek);
    assert.strictEqual(formatIsoDateOnly(nextWeek), '2027-01-04');
  });

  test('Quarterly recurrence with month-end preservation', () => {
    const quarterlySchedule = {
      frequency: 'quarterly' as const,
      anchorDate: '2026-01-31T00:00:00.000Z',
      dayOfMonth: 31,
    };

    // Jan 31 + 3 months -> April 30 (clamped)
    const q1 = computeNextRunAt(quarterlySchedule, '2026-01-31T00:00:00.000Z');
    assert.ok(q1);
    assert.strictEqual(formatIsoDateOnly(q1), '2026-04-30');

    // April 30 + 3 months -> July 31
    const q2 = computeNextRunAt(quarterlySchedule, q1);
    assert.ok(q2);
    assert.strictEqual(formatIsoDateOnly(q2), '2026-07-31');
  });

  test('Custom interval days recurrence', () => {
    const customSchedule = {
      frequency: 'custom' as const,
      intervalDays: 10,
      anchorDate: '2026-05-01T00:00:00.000Z',
    };

    const next = computeNextRunAt(customSchedule, '2026-05-01T00:00:00.000Z');
    assert.ok(next);
    assert.strictEqual(formatIsoDateOnly(next), '2026-05-11');
  });

  test('Boundary: endsOn stops schedule progression', () => {
    const schedule = {
      frequency: 'monthly' as const,
      anchorDate: '2026-01-01T00:00:00.000Z',
      endsOn: '2026-02-15T00:00:00.000Z',
    };

    const run1 = computeNextRunAt(schedule, '2026-01-01T00:00:00.000Z');
    assert.ok(run1);
    assert.strictEqual(formatIsoDateOnly(run1), '2026-02-01');

    // Run 2 would be March 1, which exceeds endsOn Feb 15
    const run2 = computeNextRunAt(schedule, run1);
    assert.strictEqual(run2, null);
  });

  test('Boundary: maxOccurrences stops schedule progression', () => {
    const schedule = {
      frequency: 'weekly' as const,
      anchorDate: '2026-01-01T00:00:00.000Z',
      maxOccurrences: 2,
      occurrencesCount: 2,
    };

    const run = computeNextRunAt(schedule, '2026-01-01T00:00:00.000Z');
    assert.strictEqual(run, null);
  });

  test('Upcoming occurrences projection utility', () => {
    const schedule = {
      frequency: 'monthly' as const,
      anchorDate: '2026-01-15T00:00:00.000Z',
      dayOfMonth: 15,
    };

    const projections = projectUpcomingOccurrences(schedule, 3, '2026-01-15T00:00:00.000Z');
    assert.strictEqual(projections.length, 3);
    assert.strictEqual(formatIsoDateOnly(projections[0].runAt), '2026-02-15');
    assert.strictEqual(formatIsoDateOnly(projections[1].runAt), '2026-03-15');
    assert.strictEqual(formatIsoDateOnly(projections[2].runAt), '2026-04-15');
    assert.strictEqual(projections[0].periodKey, '2026-02-15');
  });
});
