import { z } from 'zod';

export const DeckStatsItemSchema = z.object({
  name: z.string(),
  newCount: z.number(),
  learnCount: z.number(),
  reviewCount: z.number(),
  totalCards: z.number(),
  matureCards: z.number(),
  nextReviewVocab: z.string().nullable(),
});

export const DeckStatsSchema = z.object({
  decks: z.array(DeckStatsItemSchema),
});

export type DeckStatsItem = z.infer<typeof DeckStatsItemSchema>;
export type DeckStats = z.infer<typeof DeckStatsSchema>;
