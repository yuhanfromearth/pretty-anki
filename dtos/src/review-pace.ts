import { z } from 'zod';

export const ReviewPaceSchema = z.object({
  medianMs: z.number(),
  totalDue: z.number(),
});

export type ReviewPace = z.infer<typeof ReviewPaceSchema>;
