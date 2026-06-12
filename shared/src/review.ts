import { z } from 'zod';
import { NoteFieldsSchema } from './note.js';

export const ReviewCardSchema = z.object({
  cardId: z.number(),
  noteId: z.number(),
  // Note type, so the review screen can resolve the app-native Template layout
  // and render it exactly as the builder/manage previews do.
  modelName: z.string(),
  question: z.string(),
  answer: z.string(),
  deckName: z.string(),
  buttons: z.array(z.number().int().min(1).max(4)),
  nextReviews: z.array(z.string()),
  // Audio is split by side so a sound that lives only on the back never shows a
  // play button on the front. The back replays the front (answer = FrontSide +
  // back), so its list is a superset of the front's.
  questionAudio: z.array(z.string()),
  answerAudio: z.array(z.string()),
  // Raw note fields (name → HTML), driving the app-native Template renderer when
  // the note type has been customized in the builder. Empty for fallback types.
  fields: NoteFieldsSchema,
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
