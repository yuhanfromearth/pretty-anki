import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import {
  TemplateStoreSchema,
  compileLayoutToAnki,
  extractLayoutFromCardTemplate,
  seedLayout,
  type CreateTemplate,
  type FieldOp,
  type Layout,
  type Role,
  type TemplateDefaultSample,
  type TemplateDetail,
  type TemplateDoc,
  type TemplateSampleList,
  type TemplateStore,
  type TemplateSummaryList,
  type UpdateLayout,
} from '@nts/shared';
import { AnkiConnectService } from '../anki/anki-connect.service.js';

const STORE_DIR = join(homedir(), '.pretty-anki');
const STORE_FILE = join(STORE_DIR, 'templates.json');

/** Max search matches returned to the builder preview picker. */
const SAMPLE_LIMIT = 25;

/** Owns the app-native Template layout store (`~/.pretty-anki/templates.json`,
 *  whole-file read/write like SettingsService) and joins it with live note-type
 *  data from AnkiConnect. The field list always comes from Anki; this service
 *  owns only what Anki can't store: layout, custom CSS, and the sample choice. */
@Injectable()
export class TemplatesService {
  constructor(private readonly anki: AnkiConnectService) {}

  private async readStore(): Promise<TemplateStore> {
    try {
      const raw = await readFile(STORE_FILE, 'utf-8');
      const parsed = TemplateStoreSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : {};
    } catch {
      return {};
    }
  }

  private async writeStore(store: TemplateStore): Promise<void> {
    await mkdir(STORE_DIR, { recursive: true });
    await writeFile(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  }

  /** Compile each authored direction's layout into its matching Anki card
   *  template (joined by ord → name) and write them back into the collection,
   *  plus the shared model CSS, so the design persists in Anki and exports with
   *  the deck. Only ords the user has authored are published — unauthored card
   *  templates (e.g. a reversed card not yet edited here) are left untouched.
   *  Skips Cloze types and any direction with an empty front (Anki rejects a
   *  blank question). */
  private async publishToAnki(
    modelName: string,
    doc: TemplateDoc,
  ): Promise<void> {
    if (await this.anki.isClozeModel(modelName)) return;

    const names = await this.anki.getModelTemplateNames(modelName); // ord → name
    const templates: Record<string, { Front: string; Back: string }> = {};
    let css: string | undefined;

    for (const [ordStr, layout] of Object.entries(doc.cards)) {
      if (layout.front.length === 0) continue; // Anki rejects a blank question
      const name = names[Number(ordStr)];
      if (!name) continue; // ord no longer exists in Anki
      const compiled = compileLayoutToAnki(layout, doc.css, name);
      const [card] = compiled.cardTemplates;
      templates[name] = { Front: card.Front, Back: card.Back };
      css = compiled.css; // identical across ords (role CSS + custom)
    }

    if (Object.keys(templates).length > 0) {
      await this.anki.updateModelTemplates(modelName, templates);
    }
    if (css !== undefined) {
      await this.anki.updateModelStyling(modelName, css);
    }
  }

  /** List every note type as a Template, flagging which have a saved layout,
   *  and surface stored docs whose model id no longer exists in Anki. */
  async list(): Promise<TemplateSummaryList> {
    const [models, store] = await Promise.all([
      this.anki.getModelsWithIds(),
      this.readStore(),
    ]);
    const liveIds = new Set(models.map((m) => m.id));

    const templates = await Promise.all(
      models.map(async (m) => ({
        modelId: m.id,
        name: m.name,
        fields: await this.anki.getModelFields(m.name),
        customized: store[String(m.id)] !== undefined,
        isCloze: await this.anki.isClozeModel(m.name),
      })),
    );

    const orphans = Object.values(store)
      .filter((doc) => !liveIds.has(doc.modelId))
      .map((doc) => ({ modelId: doc.modelId, name: doc.name }));

    return { templates, orphans };
  }

  /** Resolve a model id to its live name, or 404. */
  private async nameForId(modelId: number): Promise<string> {
    const models = await this.anki.getModelsWithIds();
    const match = models.find((m) => m.id === modelId);
    if (!match) {
      throw new NotFoundException(`No note type with id ${modelId}`);
    }
    return match.name;
  }

  /** Build the builder-facing detail: live fields joined with the stored (or
   *  freshly seeded) layout. */
  async detail(modelId: number): Promise<TemplateDetail> {
    const name = await this.nameForId(modelId);
    const [fields, isCloze, noteCount, store, templates] = await Promise.all([
      this.anki.getModelFields(name),
      this.anki.isClozeModel(name),
      this.anki.countNotesForModel(modelId),
      this.readStore(),
      this.anki.getModelTemplates(name),
    ]);

    // One entry per Anki card template, in ord order (object key order). Each
    // direction uses its stored authored layout, or one seeded from the card
    // template's existing Anki HTML so an un-edited reversed card still shows
    // the right fields.
    const doc = store[String(modelId)];
    const roleHints = collectRoleHints(doc);
    const cards = Object.entries(templates).map(([tname, tpl], ord) => {
      const stored = doc?.cards[String(ord)];
      const layout =
        stored ??
        extractLayoutFromCardTemplate(tpl.Front, tpl.Back, fields, roleHints);
      return { ord, name: tname, layout, authored: stored !== undefined };
    });

    return {
      modelId,
      name,
      fields,
      isCloze,
      cards,
      css: doc?.css,
      sampleNoteId: doc?.sampleNoteId ?? null,
      noteCount,
    };
  }

  /** Create a new note type in Anki and persist its seeded layout. */
  async create(input: CreateTemplate): Promise<TemplateDetail> {
    const existing = await this.anki.getModelsWithIds();
    if (existing.some((m) => m.name === input.name)) {
      throw new ConflictException(`A note type named "${input.name}" exists.`);
    }

    const modelId = await this.anki.createModel(input.name, input.fields);
    const doc: TemplateDoc = {
      modelId,
      name: input.name,
      // createModel makes a single card template (ord 0); seed its layout.
      cards: { '0': seedLayout(input.fields) },
      sampleNoteId: null,
    };
    const store = await this.readStore();
    store[String(modelId)] = doc;
    await this.writeStore(store);
    await this.publishToAnki(input.name, doc);
    return this.detail(modelId);
  }

  /** Apply a field mutation to the Anki note type, then keep authored layouts
   *  consistent: rename rewrites `block.field` references across every stored
   *  direction; remove cascades to drop orphaned blocks. Unauthored types have
   *  no stored doc — their layouts re-seed from Anki on the next read, so
   *  there's nothing to rewrite (and we don't fabricate authored layouts). */
  async applyFieldOp(modelId: number, op: FieldOp): Promise<TemplateDetail> {
    const name = await this.nameForId(modelId);

    if (op.op === 'remove') {
      const fields = await this.anki.getModelFields(name);
      if (fields.length <= 1) {
        throw new BadRequestException(
          'A note type must keep at least one field.',
        );
      }
    }

    switch (op.op) {
      case 'add':
        await this.anki.addModelField(name, op.name);
        break;
      case 'rename':
        await this.anki.renameModelField(name, op.from, op.to);
        break;
      case 'remove':
        await this.anki.removeModelField(name, op.name);
        break;
      case 'reposition':
        await this.anki.repositionModelField(name, op.name, op.index);
        break;
    }

    const store = await this.readStore();
    const doc = store[String(modelId)];
    if (doc && (op.op === 'rename' || op.op === 'remove')) {
      const map: (l: Layout) => Layout =
        op.op === 'rename'
          ? (l) => remapField(l, op.from, op.to)
          : (l) => dropField(l, op.name);
      doc.cards = Object.fromEntries(
        Object.entries(doc.cards).map(([ord, l]) => [ord, map(l)]),
      );
      doc.name = name;
      store[String(modelId)] = doc;
      await this.writeStore(store);
      await this.publishToAnki(name, doc);
    }

    return this.detail(modelId);
  }

  /** Persist layout / custom CSS / sample after edits in the builder, and
   *  compile the layout into the note type's Anki card template + CSS so the
   *  design lands in the collection and exports with the deck. */
  async updateLayout(
    modelId: number,
    input: UpdateLayout,
  ): Promise<TemplateDetail> {
    const name = await this.nameForId(modelId);
    const store = await this.readStore();
    const existing = store[String(modelId)];
    // Author the given ord; css/sample are note-type-level (shared).
    const doc: TemplateDoc = {
      modelId,
      name,
      cards: { ...existing?.cards, [String(input.ord)]: input.layout },
      css: input.css,
      sampleNoteId: input.sampleNoteId,
    };
    store[String(modelId)] = doc;
    await this.writeStore(store);
    await this.publishToAnki(name, doc);
    return this.detail(modelId);
  }

  /** Un-author a single direction: drop its stored layout so it reverts to the
   *  Anki-seeded layout and the app stops publishing it. When no authored
   *  directions remain, the doc is removed entirely (the type reverts to
   *  fallback rendering). Like the previous reset, this doesn't rewrite Anki —
   *  the card template keeps whatever was last published. */
  async resetLayout(modelId: number, ord: number): Promise<TemplateDetail> {
    const store = await this.readStore();
    const doc = store[String(modelId)];
    if (doc) {
      delete doc.cards[String(ord)];
      if (Object.keys(doc.cards).length === 0) {
        delete store[String(modelId)];
      }
      await this.writeStore(store);
    }
    return this.detail(modelId);
  }

  /** Notes of a type matching a search term, for the preview picker. An empty
   *  term returns nothing — the default sample (below) drives the initial card. */
  async samples(modelId: number, search?: string): Promise<TemplateSampleList> {
    await this.nameForId(modelId); // 404 for unknown ids
    if (!search?.trim()) return { samples: [] };
    const notes = await this.anki.getNotesForModel(
      modelId,
      SAMPLE_LIMIT,
      search,
    );
    return { samples: notes };
  }

  /** Resolve the single default preview sample: the saved `sampleNoteId` if it
   *  still exists for this type, else the first note, else null (no notes). */
  async defaultSample(modelId: number): Promise<TemplateDefaultSample> {
    await this.nameForId(modelId); // 404 for unknown ids
    const store = await this.readStore();
    const savedId = store[String(modelId)]?.sampleNoteId ?? null;

    if (savedId != null) {
      const saved = await this.anki.getNoteForModel(modelId, savedId);
      if (saved) return { sample: saved };
    }

    const [first] = await this.anki.getNotesForModel(modelId, 1);
    return { sample: first ?? null };
  }
}

/** Field → role map gathered from every authored direction, so a field keeps a
 *  consistent role when another direction is seeded from its Anki template. */
function collectRoleHints(doc: TemplateDoc | undefined): Record<string, Role> {
  const hints: Record<string, Role> = {};
  if (!doc) return hints;
  for (const layout of Object.values(doc.cards)) {
    for (const block of [...layout.front, ...layout.back]) {
      hints[block.field] = block.role;
    }
  }
  return hints;
}

/** Rewrite every block referencing `from` to reference `to`. */
function remapField(layout: Layout, from: string, to: string): Layout {
  const map = (blocks: Layout['front']) =>
    blocks.map((b) => (b.field === from ? { ...b, field: to } : b));
  return { front: map(layout.front), back: map(layout.back) };
}

/** Remove every block referencing a deleted field. */
function dropField(layout: Layout, name: string): Layout {
  const filter = (blocks: Layout['front']) =>
    blocks.filter((b) => b.field !== name);
  return { front: filter(layout.front), back: filter(layout.back) };
}
