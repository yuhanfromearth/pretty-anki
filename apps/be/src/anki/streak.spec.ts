import { describe, it, expect } from 'vitest';
import { computeStreak } from '@nts/shared';

// A fixed reference "today" (a Thursday) keeps the date math deterministic.
const NOW = new Date('2026-06-11T12:00:00Z');

describe('computeStreak', () => {
  it('counts a run of consecutive reviewed days through today', () => {
    const reviewed: [string, number][] = [
      ['2026-06-11', 5],
      ['2026-06-10', 3],
      ['2026-06-09', 8],
    ];
    const { days, reviewedToday } = computeStreak(reviewed, NOW);
    expect(reviewedToday).toBe(true);
    expect(days).toBe(3);
  });

  it("holds yesterday's streak when today has no reviews yet", () => {
    const reviewed: [string, number][] = [
      ['2026-06-10', 3],
      ['2026-06-09', 8],
    ];
    const { days, reviewedToday } = computeStreak(reviewed, NOW);
    expect(reviewedToday).toBe(false);
    // Frozen at the standing streak through yesterday until today is reviewed.
    expect(days).toBe(2);
  });

  it('breaks the streak on the first gap', () => {
    const reviewed: [string, number][] = [
      ['2026-06-11', 1],
      // 2026-06-10 missing
      ['2026-06-09', 9],
    ];
    expect(computeStreak(reviewed, NOW).days).toBe(1);
  });

  it('returns zero streak when nothing has been reviewed', () => {
    const { days, reviewedToday } = computeStreak([], NOW);
    expect(days).toBe(0);
    expect(reviewedToday).toBe(false);
  });

  it('produces a Monday-aligned heat map ending today with filled gaps', () => {
    const reviewed: [string, number][] = [['2026-06-11', 7]];
    const { history } = computeStreak(reviewed, NOW);
    // 25 full weeks back to the aligned Monday, plus Mon–Thu of the current
    // week through today (NOW is a Thursday): 25*7 + 4 = 179.
    expect(history.length).toBe(25 * 7 + 4);
    // Aligned to a Monday.
    expect(new Date(history[0].date + 'T00:00:00Z').getUTCDay()).toBe(1);
    // Ends on today.
    expect(history.at(-1)?.date).toBe('2026-06-11');
    // Days with no reviews are filled with 0; the reviewed day carries through.
    expect(history.find((h) => h.date === '2026-06-11')?.count).toBe(7);
    expect(history.find((h) => h.date === '2026-06-10')?.count).toBe(0);
  });
});
