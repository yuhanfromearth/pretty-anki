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
  seedLayout,
  type CreateTemplate,
  type FieldOp,
  type Layout,
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
    const [fields, isCloze, noteCount, store] = await Promise.all([
      this.anki.getModelFields(name),
      this.anki.isClozeModel(name),
      this.anki.countNotesForModel(modelId),
      this.readStore(),
    ]);

    const doc = store[String(modelId)];
    return {
      modelId,
      name,
      fields,
      isCloze,
      layout: doc?.layout ?? seedLayout(fields),
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
      layout: seedLayout(input.fields),
      sampleNoteId: null,
    };
    const store = await this.readStore();
    store[String(modelId)] = doc;
    await this.writeStore(store);
    return this.detail(modelId);
  }

  /** Ensure a stored doc exists for a model, seeding from current fields if not,
   *  so layout edits made alongside field edits have somewhere to persist. */
  private async materialize(
    modelId: number,
    name: string,
    fields: string[],
    store: TemplateStore,
  ): Promise<TemplateDoc> {
    const existing = store[String(modelId)];
    if (existing) return existing;
    return { modelId, name, layout: seedLayout(fields), sampleNoteId: null };
  }

  /** Apply a field mutation to the Anki note type, then keep the layout
   *  consistent: rename rewrites `block.field` references atomically; remove
   *  cascades to drop orphaned blocks. */
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

    const store = await this.readStore();
    const fieldsBefore = await this.anki.getModelFields(name);
    const doc = await this.materialize(modelId, name, fieldsBefore, store);
    let layout: Layout = doc.layout;

    switch (op.op) {
      case 'add':
        await this.anki.addModelField(name, op.name);
        break;
      case 'rename':
        await this.anki.renameModelField(name, op.from, op.to);
        layout = remapField(layout, op.from, op.to);
        break;
      case 'remove':
        await this.anki.removeModelField(name, op.name);
        layout = dropField(layout, op.name);
        break;
      case 'reposition':
        await this.anki.repositionModelField(name, op.name, op.index);
        break;
    }

    store[String(modelId)] = { ...doc, name, layout };
    await this.writeStore(store);
    return this.detail(modelId);
  }

  /** Persist layout / custom CSS / sample after edits in the builder. */
  async updateLayout(
    modelId: number,
    input: UpdateLayout,
  ): Promise<TemplateDetail> {
    const name = await this.nameForId(modelId);
    const store = await this.readStore();
    store[String(modelId)] = {
      modelId,
      name,
      layout: input.layout,
      css: input.css,
      sampleNoteId: input.sampleNoteId,
    };
    await this.writeStore(store);
    return this.detail(modelId);
  }

  /** Drop the app-native layout, reverting the type to fallback rendering.
   *  The Anki note type itself is untouched (AnkiConnect can't delete it). */
  async resetLayout(modelId: number): Promise<TemplateDetail> {
    const store = await this.readStore();
    delete store[String(modelId)];
    await this.writeStore(store);
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
