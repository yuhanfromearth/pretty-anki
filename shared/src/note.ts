import { z } from 'zod';

/** A note's fields, keyed by field name in template order. Values are HTML. */
export const NoteFieldsSchema = z.record(z.string(), z.string());

export const NoteSchema = z.object({
  noteId: z.number(),
  modelName: z.string(),
  tags: z.array(z.string()),
  fields: NoteFieldsSchema,
  /** Creation time, epoch milliseconds. */
  created: z.number(),
  /** Last modification time, epoch milliseconds. */
  modified: z.number(),
});

export const NoteListSchema = z.object({
  notes: z.array(NoteSchema),
  /** True when the result was capped; more notes match than were returned. */
  truncated: z.boolean(),
});

export const AddNoteSchema = z.object({
  deckName: z.string().min(1),
  modelName: z.string().min(1),
  fields: NoteFieldsSchema,
  tags: z.array(z.string()).optional(),
});

export const AddNoteResultSchema = z.object({
  noteId: z.number(),
});

export const UpdateNoteFieldsSchema = z.object({
  fields: NoteFieldsSchema,
});

export const NoteModelSchema = z.object({
  name: z.string(),
  fields: z.array(z.string()),
});

export const NoteModelListSchema = z.object({
  models: z.array(NoteModelSchema),
});

export type NoteFields = z.infer<typeof NoteFieldsSchema>;
export type Note = z.infer<typeof NoteSchema>;
export type NoteList = z.infer<typeof NoteListSchema>;
export type AddNote = z.infer<typeof AddNoteSchema>;
export type AddNoteResult = z.infer<typeof AddNoteResultSchema>;
export type UpdateNoteFields = z.infer<typeof UpdateNoteFieldsSchema>;
export type NoteModel = z.infer<typeof NoteModelSchema>;
export type NoteModelList = z.infer<typeof NoteModelListSchema>;
