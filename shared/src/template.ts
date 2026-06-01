import { z } from 'zod';

/** A Template is the unified concept of an Anki note type: it owns both the
 *  fields (which live in Anki and are edited via AnkiConnect) and the app-native
 *  layout describing how those fields are placed and styled. There is no
 *  separate "model" vs "card template" — one Template is one note type. */

/** Language-neutral semantic roles. Each role is a curated style bundle (font,
 *  size, weight, colour) resolved in `template-render.ts`; the role expresses
 *  hierarchy/meaning, not a script. Correct glyph rendering for any script
 *  (CJK, Cyrillic, …) comes from the font *stack*, not from the role. */
export const RoleSchema = z.enum([
  'heading', // primary term — display serif, large
  'subheading', // secondary term / reading — display serif, medium
  'annotation', // pronunciation/transliteration (pinyin, IPA, romaji) — mono, muted
  'body', // definitions, explanations — sans
  'example', // sentences, quotes — italic
  'audio', // play chip rendered from `[sound:...]` markers
  'image', // <img> rendered from a media field
]);
export type Role = z.infer<typeof RoleSchema>;

/** One placed field. `role` selects the curated style; when `raw` is set it
 *  overrides the role styling with author HTML/CSS (sanitised at render time,
 *  with a single `{{value}}` placeholder substituted for the field's value). */
export const BlockSchema = z.object({
  id: z.string(),
  field: z.string(),
  role: RoleSchema,
  raw: z.string().optional(),
});
export type Block = z.infer<typeof BlockSchema>;

/** Placement: two ordered, top-to-bottom block stacks. Visual grouping is a
 *  property of roles, not a nesting model. */
export const LayoutSchema = z.object({
  front: z.array(BlockSchema),
  back: z.array(BlockSchema),
});
export type Layout = z.infer<typeof LayoutSchema>;

/** The app-native document for one note type. The field list itself lives in
 *  Anki; this captures only what Anki can't: layout, optional custom CSS, and
 *  the preview sample selection. Keyed in the store by stable `modelId` so an
 *  Anki rename doesn't orphan it. `name` is cached for display and refreshed on
 *  reconcile. */
export const TemplateDocSchema = z.object({
  modelId: z.number(),
  name: z.string(),
  layout: LayoutSchema,
  /** Custom CSS applied to the whole card (sanitised). */
  css: z.string().optional(),
  /** Note used to populate the live preview; null falls back to placeholders. */
  sampleNoteId: z.number().nullable(),
});
export type TemplateDoc = z.infer<typeof TemplateDocSchema>;

/** On-disk shape of `~/.pretty-anki/templates.json`: modelId (stringified) → doc. */
export const TemplateStoreSchema = z.record(z.string(), TemplateDocSchema);
export type TemplateStore = z.infer<typeof TemplateStoreSchema>;

/** A Template as surfaced to the UI list: the live Anki note type joined with
 *  its stored layout (if any). `customized` is false for note types that have
 *  never been opened in the builder — those render via the `stripHtml` fallback. */
export const TemplateSummarySchema = z.object({
  modelId: z.number(),
  name: z.string(),
  fields: z.array(z.string()),
  customized: z.boolean(),
  /** True for Anki's Cloze types, which stay on fallback rendering only. */
  isCloze: z.boolean(),
});
export type TemplateSummary = z.infer<typeof TemplateSummarySchema>;

export const TemplateSummaryListSchema = z.object({
  templates: z.array(TemplateSummarySchema),
  /** Stored docs whose modelId no longer exists in Anki (renamed/deleted type). */
  orphans: z.array(z.object({ modelId: z.number(), name: z.string() })),
});
export type TemplateSummaryList = z.infer<typeof TemplateSummaryListSchema>;

/** Full Template detail for the builder: live fields + the (possibly seeded) doc. */
export const TemplateDetailSchema = z.object({
  modelId: z.number(),
  name: z.string(),
  fields: z.array(z.string()),
  isCloze: z.boolean(),
  layout: LayoutSchema,
  css: z.string().optional(),
  sampleNoteId: z.number().nullable(),
});
export type TemplateDetail = z.infer<typeof TemplateDetailSchema>;

/** Create a new note type (Anki `createModel`) and seed its layout. */
export const CreateTemplateSchema = z.object({
  name: z.string().min(1),
  fields: z.array(z.string().min(1)).min(1),
});
export type CreateTemplate = z.infer<typeof CreateTemplateSchema>;

/** Field mutations on an existing note type. `remove` is destructive (drops the
 *  field's data on every note) so it requires explicit `confirm: true`; the
 *  controller additionally cascades to delete orphaned blocks. `rename` must be
 *  applied atomically with rewriting matching `block.field` references. */
export const FieldOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add'), name: z.string().min(1) }),
  z.object({
    op: z.literal('rename'),
    from: z.string().min(1),
    to: z.string().min(1),
  }),
  z.object({
    op: z.literal('remove'),
    name: z.string().min(1),
    confirm: z.literal(true),
  }),
  z.object({
    op: z.literal('reposition'),
    name: z.string().min(1),
    index: z.number().int().min(0),
  }),
]);
export type FieldOp = z.infer<typeof FieldOpSchema>;

/** Persist the layout/css/sample after edits in the builder. */
export const UpdateLayoutSchema = z.object({
  layout: LayoutSchema,
  css: z.string().optional(),
  sampleNoteId: z.number().nullable(),
});
export type UpdateLayout = z.infer<typeof UpdateLayoutSchema>;
