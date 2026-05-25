import { z } from 'zod';

export const ReviewCardSchema = z.object({
  cardId: z.number(),
  question: z.string(),
  answer: z.string(),
  deckName: z.string(),
  buttons: z.array(z.number().int().min(1).max(4)),
  nextReviews: z.array(z.string()),
});

export const AnswerCardSchema = z.object({
  ease: z.number().int().min(1).max(4),
});

export const RescheduleCardSchema = z.object({
  cardId: z.number(),
  days: z.number().int().min(1),
});

export const ReviewSessionSchema = z.object({
  remaining: z.number(),
});

export type ReviewCard = z.infer<typeof ReviewCardSchema>;
export type AnswerCard = z.infer<typeof AnswerCardSchema>;
export type RescheduleCard = z.infer<typeof RescheduleCardSchema>;
export type ReviewSession = z.infer<typeof ReviewSessionSchema>;
