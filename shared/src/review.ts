import { z } from 'zod';
import { NoteFieldsSchema } from './note.js';

export const ReviewCardSchema = z.object({
  cardId: z.number(),
  noteId: z.number(),
  // Card-template index within the note. A single note can spawn several cards
  // (a "reversed" note type pairs ord 0 forward with ord 1 reverse); the review
  // screen swaps the front/back layout stacks for the reverse direction so the
  // app-native Template renders the right side as the question.
  ord: z.number().int().min(0),
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

export const UndoReviewSchema = z.object({
  // The card currently shown in the reviewer. The server steps Anki's undo
  // stack back, then reloads the reviewer until the displayed card differs from
  // this id, so it returns only once Anki surfaces the re-queued previous card.
  cardId: z.number(),
  // How many Anki undo steps the last action took (a plain answer is 1, a
  // reschedule is an answer plus a setDueDate = 2).
  steps: z.number().int().min(1).max(4),
  // The deck under review. Undo re-queues the previous card but does not move
  // the reviewer off the current one, so the server must reload the deck's
  // review (guiDeckReview) to surface it.
  deckName: z.string(),
});

export type ReviewCard = z.infer<typeof ReviewCardSchema>;
export type AnswerCard = z.infer<typeof AnswerCardSchema>;
export type RescheduleCard = z.infer<typeof RescheduleCardSchema>;
export type ReviewSession = z.infer<typeof ReviewSessionSchema>;
export type UndoReview = z.infer<typeof UndoReviewSchema>;
