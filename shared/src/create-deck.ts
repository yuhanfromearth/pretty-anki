import { z } from 'zod';

export const CreateDeckSchema = z.object({
  name: z.string().min(1).max(200),
});

export type CreateDeck = z.infer<typeof CreateDeckSchema>;
