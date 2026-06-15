import { z } from 'zod';

export const StreakDaySchema = z.object({
  date: z.string(),
  count: z.number(),
});

export const StreakSchema = z.object({
  days: z.number(),
  reviewedToday: z.boolean(),
  history: z.array(StreakDaySchema),
});

export type StreakDay = z.infer<typeof StreakDaySchema>;

export type Streak = z.infer<typeof StreakSchema>;

/** Weeks of daily history kept for the heat map (~6 months). */
const HEATMAP_WEEKS = 26;

/** Derive the streak count, today's status and the heat-map history from Anki's
 *  per-day review counts (`getNumCardsReviewedByDay` tuples: `[YYYY-MM-DD, n]`).
 *  Pure so the date arithmetic is testable without AnkiConnect; `now` is the
 *  reference "today" and is injected for deterministic tests. */
export function computeStreak(
  reviewedByDay: readonly [string, number][],
  now: Date
): Streak {
  const countByDate = new Map(
    reviewedByDay.map(([date, count]) => [date, count])
  );

  const todayStr = now.toISOString().slice(0, 10);
  const reviewedToday = (countByDate.get(todayStr) ?? 0) > 0;

  // Count the run of consecutive reviewed days ending at the last reviewed day.
  // When today hasn't been reviewed yet, start from yesterday so `days` holds
  // the standing streak through yesterday — the frozen value the UI shows until
  // the first review of today bumps it to `days + 1`.
  let days = 0;
  for (let i = reviewedToday ? 0 : 1; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const count = countByDate.get(dateStr) ?? 0;
    if (count === 0) break;
    days++;
  }

  // Dense daily history for the heat map: last HEATMAP_WEEKS Monday-aligned
  // weeks through today, filling days with no reviews as 0. Uses UTC dates to
  // stay consistent with the streak loop above (known UTC/local-day caveat).
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const mondayOffset = (today.getUTCDay() + 6) % 7; // 0 = Monday
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - mondayOffset - (HEATMAP_WEEKS - 1) * 7);

  const history: StreakDay[] = [];
  for (
    const d = new Date(start);
    d <= today;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const dateStr = d.toISOString().slice(0, 10);
    history.push({ date: dateStr, count: countByDate.get(dateStr) ?? 0 });
  }

  return { days, reviewedToday, history };
}
