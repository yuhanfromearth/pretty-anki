import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TemplateStore } from '@nts/shared';
import { TemplatesService } from './templates.service.js';
import type { AnkiConnectService } from '../anki/anki-connect.service.js';

// In-memory stand-in for ~/.pretty-anki/templates.json.
const state = vi.hoisted(() => ({ file: null as string | null }));

vi.mock('node:fs/promises', () => ({
  readFile: async () => {
    if (state.file === null) throw new Error('ENOENT');
    return state.file;
  },
  writeFile: async (_path: string, data: string) => {
    state.file = data;
  },
  mkdir: async () => undefined,
}));

function seedStore(store: TemplateStore) {
  state.file = JSON.stringify(store);
}

/** Minimal AnkiConnect double — only the methods the tested paths touch. */
function fakeAnki(over: Partial<AnkiConnectService> = {}): AnkiConnectService {
  return {
    getModelsWithIds: vi.fn(async () => [{ name: 'Basic', id: 42 }]),
    getModelFields: vi.fn(async () => ['Front', 'Back']),
    isClozeModel: vi.fn(async () => false),
    countNotesForModel: vi.fn(async () => 3),
    addModelField: vi.fn(async () => undefined),
    renameModelField: vi.fn(async () => undefined),
    removeModelField: vi.fn(async () => undefined),
    repositionModelField: vi.fn(async () => undefined),
    createModel: vi.fn(async () => 99),
    getNotesForModel: vi.fn(async () => []),
    getModelTemplateNames: vi.fn(async () => ['Card 1']),
    getModelTemplates: vi.fn(async () => ({
      'Card 1': { Front: '{{Front}}', Back: '{{FrontSide}}<hr>{{Back}}' },
    })),
    updateModelTemplates: vi.fn(async () => undefined),
    updateModelStyling: vi.fn(async () => undefined),
    ...over,
  } as unknown as AnkiConnectService;
}

const docWith = (front: string, back: string): TemplateStore => ({
  '42': {
    modelId: 42,
    name: 'Basic',
    cards: {
      '0': {
        front: [{ id: 'f', field: front, role: 'heading' }],
        back: [{ id: 'b', field: back, role: 'body' }],
      },
    },
    sampleNoteId: null,
  },
});

beforeEach(() => {
  state.file = null;
});

describe('TemplatesService.applyFieldOp', () => {
  it('rewrites block.field references atomically on rename', async () => {
    seedStore(docWith('Front', 'Back'));
    const anki = fakeAnki();
    const svc = new TemplatesService(anki);

    const detail = await svc.applyFieldOp(42, {
      op: 'rename',
      from: 'Front',
      to: 'Word',
    });

    expect(anki.renameModelField).toHaveBeenCalledWith(
      'Basic',
      'Front',
      'Word',
    );
    expect(detail.cards[0].layout.front[0].field).toBe('Word');
    // The renamed layout is compiled and pushed back into the Anki note type.
    expect(anki.updateModelTemplates).toHaveBeenCalledWith('Basic', {
      'Card 1': {
        Front: '{{#Word}}<div class="blk role-heading">{{Word}}</div>{{/Word}}',
        Back: '{{#Back}}<div class="blk role-body">{{Back}}</div>{{/Back}}',
      },
    });
    expect(anki.updateModelStyling).toHaveBeenCalled();
  });

  it('skips the Anki push for Cloze types', async () => {
    seedStore(docWith('Front', 'Back'));
    const anki = fakeAnki({ isClozeModel: vi.fn(async () => true) });
    const svc = new TemplatesService(anki);

    await svc.applyFieldOp(42, { op: 'rename', from: 'Front', to: 'Word' });

    expect(anki.updateModelTemplates).not.toHaveBeenCalled();
  });

  it('cascades to drop blocks for a removed field', async () => {
    seedStore(docWith('Front', 'Back'));
    const anki = fakeAnki();
    const svc = new TemplatesService(anki);

    const detail = await svc.applyFieldOp(42, {
      op: 'remove',
      name: 'Back',
      confirm: true,
    });

    expect(anki.removeModelField).toHaveBeenCalledWith('Basic', 'Back');
    expect(detail.cards[0].layout.back).toHaveLength(0);
  });

  it('refuses to remove the last field', async () => {
    seedStore(docWith('Front', 'Back'));
    const anki = fakeAnki({
      getModelFields: vi.fn(async () => ['Only']),
    });
    const svc = new TemplatesService(anki);

    await expect(
      svc.applyFieldOp(42, { op: 'remove', name: 'Only', confirm: true }),
    ).rejects.toThrow(/at least one field/);
    expect(anki.removeModelField).not.toHaveBeenCalled();
  });
});

describe('TemplatesService.resetLayout', () => {
  it('un-authors the ord and falls back to the Anki-seeded layout', async () => {
    seedStore(docWith('Front', 'Back'));
    const svc = new TemplatesService(fakeAnki());

    const detail = await svc.resetLayout(42, 0);

    // Seeded from the card template's Anki HTML ({{Front}} / {{Back}}), not the
    // custom stored layout that was just dropped.
    expect(detail.cards[0].layout.front).toEqual([
      { id: 'heading:Front', field: 'Front', role: 'heading' },
    ]);
    expect(detail.cards[0].authored).toBe(false);
    expect(JSON.parse(state.file!)['42']).toBeUndefined();
  });
});

describe('TemplatesService.defaultSample', () => {
  const storeWithSample = (sampleNoteId: number | null): TemplateStore => ({
    '42': { ...docWith('Front', 'Back')['42'], sampleNoteId },
  });

  it('returns the saved sample when it still exists', async () => {
    seedStore(storeWithSample(100));
    const anki = fakeAnki({
      getNoteForModel: vi.fn(async () => ({
        noteId: 100,
        fields: { Front: '안녕', Back: 'hi' },
      })),
      getNotesForModel: vi.fn(async () => []),
    });
    const svc = new TemplatesService(anki);

    const { sample } = await svc.defaultSample(42);

    expect(sample?.noteId).toBe(100);
    expect(anki.getNoteForModel).toHaveBeenCalledWith(42, 100);
    // No need to fall back to the first note.
    expect(anki.getNotesForModel).not.toHaveBeenCalled();
  });

  it('falls back to the first note when the saved sample is gone', async () => {
    seedStore(storeWithSample(100));
    const anki = fakeAnki({
      getNoteForModel: vi.fn(async () => null),
      getNotesForModel: vi.fn(async () => [{ noteId: 200, fields: {} }]),
    });
    const svc = new TemplatesService(anki);

    const { sample } = await svc.defaultSample(42);

    expect(sample?.noteId).toBe(200);
    expect(anki.getNotesForModel).toHaveBeenCalledWith(42, 1);
  });

  it('returns null when the type has no notes', async () => {
    seedStore(storeWithSample(null));
    const anki = fakeAnki({ getNotesForModel: vi.fn(async () => []) });
    const svc = new TemplatesService(anki);

    expect(await svc.defaultSample(42)).toEqual({ sample: null });
  });
});

describe('TemplatesService.samples', () => {
  it('returns nothing for an empty search without querying Anki', async () => {
    seedStore(docWith('Front', 'Back'));
    const anki = fakeAnki({ getNotesForModel: vi.fn(async () => []) });
    const svc = new TemplatesService(anki);

    expect(await svc.samples(42, '  ')).toEqual({ samples: [] });
    expect(anki.getNotesForModel).not.toHaveBeenCalled();
  });

  it('passes the search term through, capped', async () => {
    seedStore(docWith('Front', 'Back'));
    const anki = fakeAnki({
      getNotesForModel: vi.fn(async () => [{ noteId: 5, fields: {} }]),
    });
    const svc = new TemplatesService(anki);

    const { samples } = await svc.samples(42, 'an');

    expect(samples).toHaveLength(1);
    expect(anki.getNotesForModel).toHaveBeenCalledWith(42, 25, 'an');
  });
});

describe('TemplatesService.list', () => {
  it('flags customized types and surfaces orphans', async () => {
    // Stored doc for id 7 no longer exists in Anki (only 42 is live).
    seedStore({
      '42': docWith('Front', 'Back')['42'],
      '7': {
        modelId: 7,
        name: 'Gone',
        cards: {},
        sampleNoteId: null,
      },
    });
    const svc = new TemplatesService(fakeAnki());

    const { templates, orphans } = await svc.list();

    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({ modelId: 42, customized: true });
    expect(orphans).toEqual([{ modelId: 7, name: 'Gone' }]);
  });
});
