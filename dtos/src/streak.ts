import { z } from 'zod';

export const StreakSchema = z.object({
  days: z.number(),
});

export type Streak = z.infer<typeof StreakSchema>;
