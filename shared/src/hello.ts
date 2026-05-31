import { z } from 'zod';

export const HelloSchema = z.object({
  message: z.string(),
});

export type Hello = z.infer<typeof HelloSchema>;
