import { z } from 'zod';

export const StreakDaySchema = z.object({
  date: z.string(),
  count: z.number(),
});

export const StreakSchema = z.object({
  days: z.number(),
  history: z.array(StreakDaySchema),
});

export type StreakDay = z.infer<typeof StreakDaySchema>;

export type Streak = z.infer<typeof StreakSchema>;
