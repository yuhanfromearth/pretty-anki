import { z } from 'zod';

export const ReviewPaceSchema = z.object({
  medianMs: z.number(),
  totalDue: z.number(),
});

export type ReviewPace = z.infer<typeof ReviewPaceSchema>;

/** Ignore answer durations at or above this — a multi-minute gap means the user
 *  stepped away, not a real answer, and would skew the median. */
const MAX_ANSWER_MS = 120000;
/** Only the most recent answers shape the pace estimate, so an old habit doesn't
 *  drag the current median. */
const PACE_SAMPLE = 100;
/** Shown before any answer has been recorded. */
const DEFAULT_MEDIAN_MS = 8000;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Estimate the user's answer pace from raw per-review durations (ms) and the
 *  current outstanding due count. Pure so the filtering/median can be tested
 *  without AnkiConnect: drops implausible durations, keeps the most recent
 *  PACE_SAMPLE, and falls back to a default when there's no history yet. */
export function computeReviewPace(
  durationsMs: readonly number[],
  totalDue: number
): ReviewPace {
  const valid = durationsMs.filter((t) => t > 0 && t < MAX_ANSWER_MS);
  const medianMs =
    valid.length > 0 ? median(valid.slice(-PACE_SAMPLE)) : DEFAULT_MEDIAN_MS;
  return { medianMs, totalDue };
}
