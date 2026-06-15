import { describe, it, expect } from 'vitest';
import { computeReviewPace } from '@nts/shared';

describe('computeReviewPace', () => {
  it('falls back to the default median when there is no history', () => {
    expect(computeReviewPace([], 4)).toEqual({ medianMs: 8000, totalDue: 4 });
  });

  it('takes the median of valid durations', () => {
    // sorted: [2000, 4000, 6000] -> middle 4000
    expect(computeReviewPace([6000, 2000, 4000], 0).medianMs).toBe(4000);
  });

  it('averages the two middle values for an even count', () => {
    expect(computeReviewPace([2000, 4000, 6000, 8000], 0).medianMs).toBe(5000);
  });

  it('drops non-positive and away-from-keyboard durations before the median', () => {
    // 0 and 120000+ are excluded, leaving [3000, 5000] -> 4000.
    expect(computeReviewPace([0, 3000, 5000, 120000, 500000], 0).medianMs).toBe(
      4000,
    );
  });

  it('falls back to the default when every duration is filtered out', () => {
    expect(computeReviewPace([0, 120000], 9).medianMs).toBe(8000);
  });

  it('considers only the most recent 100 valid durations', () => {
    // 100 fast answers followed by one slow one: the slow tail shifts the median.
    const fast = Array.from({ length: 100 }, () => 1000);
    const withRecentSlow = [...fast, 9000];
    // Most recent 100 = ninety-nine 1000s + one 9000 -> median still 1000.
    expect(computeReviewPace(withRecentSlow, 0).medianMs).toBe(1000);
  });

  it('passes the outstanding due count through unchanged', () => {
    expect(computeReviewPace([3000], 42).totalDue).toBe(42);
  });
});
