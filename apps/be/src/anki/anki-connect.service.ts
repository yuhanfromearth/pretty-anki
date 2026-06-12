import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extractAudio, stripHtml } from '@nts/shared';
import type {
  DeckStats,
  DeckStatsItem,
  Streak,
  ReviewPace,
  ReviewCard,
  ReviewSession,
  Note,
  NoteList,
  NoteFields,
  NoteModelList,
} from '@nts/shared';

interface AnkiDeckStats {
  deck_id: number;
  name: string;
  new_count: number;
  learn_count: number;
  review_count: number;
  total_in_deck: number;
}

interface AnkiNoteInfo {
  noteId: number;
  modelName: string;
  tags: string[];
  fields: Record<string, { value: string; order: number }>;
  /** Last modification time in epoch seconds (newer AnkiConnect builds). */
  mod?: number;
}

/** Notes returned by a single search are capped to keep payloads bounded. */
const NOTE_SEARCH_LIMIT = 500;

// cardReviews returns tuples: [id, cid, usn, ease, ivl, lastIvl, factor, time, type]
type AnkiReviewTuple = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

@Injectable()
export class AnkiConnectService {
  private readonly url: string;

  constructor(configService: ConfigService) {
    this.url = configService.get<string>(
      'ANKI_CONNECT_URL',
      'http://localhost:8765',
    );
  }

  async invoke<T>(
    action: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    const res = await fetch(this.url, {
      method: 'POST',
      body: JSON.stringify({ action, version: 6, params }),
    });

    const json = (await res.json()) as { result: T; error: string | null };

    if (json.error) {
      throw new Error(`AnkiConnect ${action}: ${json.error}`);
    }

    return json.result;
  }

  async getDecks(): Promise<string[]> {
    return this.invoke<string[]>('deckNames');
  }

  async getDeckStats(): Promise<DeckStats> {
    const deckNames = await this.getDecks();
    const nameToId =
      await this.invoke<Record<string, number>>('deckNamesAndIds');
    const statsMap = await this.invoke<Record<string, AnkiDeckStats>>(
      'getDeckStats',
      { decks: deckNames },
    );

    const decks: DeckStatsItem[] = await Promise.all(
      deckNames.map(async (name) => {
        const id = nameToId[name];
        const s = id !== undefined ? statsMap[String(id)] : undefined;
        const [matureCards, nextReviewVocab] = await Promise.all([
          this.countMatureCards(name),
          this.getNextDueVocab(name),
        ]);

        return {
          name,
          newCount: s?.new_count ?? 0,
          learnCount: s?.learn_count ?? 0,
          reviewCount: s?.review_count ?? 0,
          totalCards: s?.total_in_deck ?? 0,
          matureCards,
          nextReviewVocab,
        };
      }),
    );

    return { decks };
  }

  async getStreak(): Promise<Streak> {
    const reviewed = await this.invoke<[string, number][]>(
      'getNumCardsReviewedByDay',
    );

    const countByDate = new Map(reviewed.map(([date, count]) => [date, count]));

    let days = 0;
    const now = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const count = countByDate.get(dateStr) ?? 0;
      if (count === 0) {
        if (i === 0) break;
        break;
      }
      days++;
    }

    // Dense daily history for the heat map: last HEATMAP_WEEKS Monday-aligned
    // weeks through today, filling days with no reviews as 0. Uses UTC dates to
    // stay consistent with the streak loop above (known UTC/local-day caveat).
    const HEATMAP_WEEKS = 26; // ~6 months
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const mondayOffset = (today.getUTCDay() + 6) % 7; // 0 = Monday
    const start = new Date(today);
    start.setUTCDate(
      start.getUTCDate() - mondayOffset - (HEATMAP_WEEKS - 1) * 7,
    );

    const history: { date: string; count: number }[] = [];
    for (
      const d = new Date(start);
      d <= today;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const dateStr = d.toISOString().slice(0, 10);
      history.push({ date: dateStr, count: countByDate.get(dateStr) ?? 0 });
    }

    return { days, history };
  }

  async getReviewPace(): Promise<ReviewPace> {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const deckNames = await this.getDecks();

    const allTimes: number[] = [];
    for (const deck of deckNames) {
      const reviews = await this.invoke<AnkiReviewTuple[]>('cardReviews', {
        deck,
        startID: oneWeekAgo,
      });
      for (const r of reviews) {
        const time = r[7];
        if (time > 0 && time < 120000) {
          allTimes.push(time);
        }
      }
    }

    const medianMs =
      allTimes.length > 0 ? this.median(allTimes.slice(-100)) : 8000;

    let totalDue = 0;
    const statsMap = await this.invoke<Record<string, AnkiDeckStats>>(
      'getDeckStats',
      { decks: deckNames },
    );
    for (const s of Object.values(statsMap)) {
      totalDue += s.new_count + s.learn_count + s.review_count;
    }

    return { medianMs, totalDue };
  }

  async createDeck(deckName: string): Promise<number> {
    return this.invoke<number>('createDeck', { deck: deckName });
  }

  async deleteDeck(deckName: string, cardsToo: boolean): Promise<void> {
    await this.invoke<void>('deleteDecks', {
      decks: [deckName],
      cardsToo,
    });
  }

  async getNextDueVocab(deckName: string): Promise<string | null> {
    const cardIds = await this.invoke<number[]>('findCards', {
      query: `deck:"${deckName}" is:due`,
    });
    if (cardIds.length === 0) return null;

    const infos = await this.invoke<
      { fields: Record<string, { value: string }> }[]
    >('cardsInfo', { cards: [cardIds[0]] });

    if (infos.length === 0) return null;
    const fields = infos[0].fields;
    const front =
      fields['Front']?.value ?? Object.values(fields)[0]?.value ?? null;
    if (!front) return null;
    return front.replace(/<[^>]*>/g, '').trim() || null;
  }

  async startReview(deckName: string): Promise<ReviewSession> {
    await this.invoke<boolean>('guiDeckReview', { name: deckName });
    const stats = await this.invoke<Record<string, AnkiDeckStats>>(
      'getDeckStats',
      { decks: [deckName] },
    );
    const s = Object.values(stats)[0];
    const remaining = s ? s.new_count + s.learn_count + s.review_count : 0;
    return { remaining };
  }

  async getCurrentCard(): Promise<ReviewCard | null> {
    try {
      const card = await this.invoke<{
        cardId: number;
        question: string;
        answer: string;
        modelName: string;
        fields: Record<string, { value: string; order: number }>;
        deckName: string;
        buttons: number[];
        nextReviews: string[];
      } | null>('guiCurrentCard');
      if (!card) return null;

      // guiCurrentCard includes neither the note id nor the card-template index,
      // so resolve both from cardsInfo. `ord` lets the review screen pick the
      // direction for reversed note types (ord 0 forward, ord 1 reverse).
      const [info] = await this.invoke<{ note: number; ord: number }[]>(
        'cardsInfo',
        { cards: [card.cardId] },
      );
      const noteId = info?.note ?? 0;
      const ord = info?.ord ?? 0;

      const fieldEntries = Object.entries(card.fields);
      const allAudio = fieldEntries.flatMap(([, f]) => extractAudio(f.value));
      // Raw field values keyed by name, for the app-native Template renderer.
      const fields = Object.fromEntries(
        fieldEntries.map(([name, f]) => [name, f.value]),
      );

      // Use the template-rendered question/answer rather than reconstructing
      // from note fields by position: a single note can produce multiple cards
      // (e.g. an inverted card swaps front/back), and only the rendered output
      // reflects each card's own template. The answer HTML repeats the front
      // followed by `<hr id=answer>`, so keep only the back half.
      const question = stripHtml(card.question);
      const answerBack =
        card.answer.split(/<hr id=?["']?answer["']?\s*\/?>/i)[1] ?? card.answer;
      const answer = stripHtml(answerBack);

      // Only attribute audio to the front when the rendered question side
      // actually references it — Anki marks sounds with `[anki:play:q:N]`
      // (question) / `[anki:play:a:N]` (answer) placeholders, or leaves the raw
      // `[sound:...]` form. Without this gate a sound that lives only on a back
      // field would show a play button on the front. The back replays the
      // front too, so it gets every sound.
      const questionHasAudio = /\[anki:play:q:|\[sound:/.test(card.question);
      const questionAudio = questionHasAudio ? allAudio : [];
      const answerAudio = allAudio;

      return {
        cardId: card.cardId,
        noteId,
        ord,
        modelName: card.modelName,
        question,
        answer,
        deckName: card.deckName,
        buttons: card.buttons,
        nextReviews: card.nextReviews ?? [],
        questionAudio,
        answerAudio,
        fields,
      };
    } catch {
      return null;
    }
  }

  async showAnswer(): Promise<boolean> {
    return this.invoke<boolean>('guiShowAnswer');
  }

  async answerCard(ease: number): Promise<boolean> {
    return this.invoke<boolean>('guiAnswerCard', { ease });
  }

  async rescheduleCard(cardId: number, days: number): Promise<void> {
    await this.invoke<void>('setDueDate', {
      cards: [cardId],
      days: String(days),
    });
  }

  async storeMediaFile(filename: string, dataBase64: string): Promise<string> {
    // deleteExisting:false makes AnkiConnect generate a non-conflicting name
    // instead of overwriting an existing media file with the same name.
    return this.invoke<string>('storeMediaFile', {
      filename,
      data: dataBase64,
      deleteExisting: false,
    });
  }

  async getMediaFile(filename: string): Promise<Buffer | null> {
    const b64 = await this.invoke<string | null>('retrieveMediaFile', {
      filename,
    });
    if (!b64) return null;
    return Buffer.from(b64, 'base64');
  }

  async getNotes(deckName: string, search?: string): Promise<NoteList> {
    let query = `deck:"${this.escapeQuery(deckName)}"`;
    const term = search?.trim();
    if (term) {
      query += ` "*${this.escapeQuery(term)}*"`;
    }

    const noteIds = await this.invoke<number[]>('findNotes', { query });
    if (noteIds.length === 0) return { notes: [], truncated: false };

    const truncated = noteIds.length > NOTE_SEARCH_LIMIT;
    const infos = await this.invoke<AnkiNoteInfo[]>('notesInfo', {
      notes: noteIds.slice(0, NOTE_SEARCH_LIMIT),
    });

    return { notes: infos.map((info) => this.toNote(info)), truncated };
  }

  async getModels(): Promise<NoteModelList> {
    const names = await this.invoke<string[]>('modelNames');
    const models = await Promise.all(
      names.map(async (name) => ({
        name,
        fields: await this.invoke<string[]>('modelFieldNames', {
          modelName: name,
        }),
      })),
    );
    return { models };
  }

  /** Note types with their stable numeric ids — the key the Template store uses
   *  so a rename in Anki doesn't orphan a layout. */
  async getModelsWithIds(): Promise<{ name: string; id: number }[]> {
    const map = await this.invoke<Record<string, number>>('modelNamesAndIds');
    return Object.entries(map).map(([name, id]) => ({ name, id }));
  }

  async getModelFields(modelName: string): Promise<string[]> {
    return this.invoke<string[]>('modelFieldNames', { modelName });
  }

  /** Detect Cloze note types by inspecting their card templates for a
   *  `{{cloze:...}}` reference. Version-safe across AnkiConnect builds (avoids
   *  relying on the newer findModelsByName `type` field). */
  async isClozeModel(modelName: string): Promise<boolean> {
    const templates = await this.invoke<
      Record<string, { Front: string; Back: string }>
    >('modelTemplates', { modelName });
    return Object.values(templates).some(
      (t) => /\{\{\s*cloze:/i.test(t.Front) || /\{\{\s*cloze:/i.test(t.Back),
    );
  }

  /** Card-template names of a note type, in Anki's order — index = card ord. */
  async getModelTemplateNames(modelName: string): Promise<string[]> {
    const templates = await this.invoke<Record<string, unknown>>(
      'modelTemplates',
      { modelName },
    );
    return Object.keys(templates);
  }

  /** Every card template's Front/Back HTML, keyed by name in ord order — lets
   *  the app seed an unauthored direction's layout from the field references in
   *  its existing Anki template. */
  async getModelTemplates(
    modelName: string,
  ): Promise<Record<string, { Front: string; Back: string }>> {
    return this.invoke<Record<string, { Front: string; Back: string }>>(
      'modelTemplates',
      { modelName },
    );
  }

  /** Overwrite a note type's card templates (Front/Back HTML), keyed by template
   *  name. Persists into the Anki collection, so it exports with the deck. */
  async updateModelTemplates(
    modelName: string,
    templates: Record<string, { Front: string; Back: string }>,
  ): Promise<void> {
    await this.invoke<null>('updateModelTemplates', {
      model: { name: modelName, templates },
    });
  }

  /** Overwrite a note type's shared CSS. Persists into the Anki collection. */
  async updateModelStyling(modelName: string, css: string): Promise<void> {
    await this.invoke<null>('updateModelStyling', {
      model: { name: modelName, css },
    });
  }

  /** Create a new note type with the given fields and a minimal pass-through
   *  card template, so Anki stays valid and the `stripHtml` review fallback
   *  works before any app-native layout exists. */
  async createModel(name: string, fields: string[]): Promise<number> {
    const [first, ...rest] = fields;
    const back = [
      '{{FrontSide}}',
      '<hr id=answer>',
      ...rest.map((f) => `{{${f}}}`),
    ].join('\n');
    const result = await this.invoke<{ id?: number }>('createModel', {
      modelName: name,
      inOrderFields: fields,
      css: '',
      isCloze: false,
      cardTemplates: [
        { Name: 'Card 1', Front: first ? `{{${first}}}` : '', Back: back },
      ],
    });
    // createModel returns the full model object on most builds; resolve the id
    // robustly via modelNamesAndIds rather than trusting the shape.
    if (typeof result?.id === 'number') return result.id;
    const map = await this.invoke<Record<string, number>>('modelNamesAndIds');
    return map[name];
  }

  async addModelField(modelName: string, fieldName: string): Promise<void> {
    await this.invoke<null>('modelFieldAdd', { modelName, fieldName });
  }

  async renameModelField(
    modelName: string,
    oldFieldName: string,
    newFieldName: string,
  ): Promise<void> {
    await this.invoke<null>('modelFieldRename', {
      modelName,
      oldFieldName,
      newFieldName,
    });
  }

  async removeModelField(modelName: string, fieldName: string): Promise<void> {
    await this.invoke<null>('modelFieldRemove', { modelName, fieldName });
  }

  async repositionModelField(
    modelName: string,
    fieldName: string,
    index: number,
  ): Promise<void> {
    await this.invoke<null>('modelFieldReposition', {
      modelName,
      fieldName,
      index,
    });
  }

  /** Number of notes of a note type, by stable model id. */
  async countNotesForModel(modelId: number): Promise<number> {
    const ids = await this.invoke<number[]>('findNotes', {
      query: `mid:${modelId}`,
    });
    return ids.length;
  }

  /** A bounded set of real notes of a type, for the builder preview sampler.
   *  An optional `search` term narrows to notes whose fields contain it (Anki
   *  `*term*`), matching the manage-page note search. */
  async getNotesForModel(
    modelId: number,
    limit: number,
    search?: string,
  ): Promise<{ noteId: number; fields: NoteFields }[]> {
    let query = `mid:${modelId}`;
    const term = search?.trim();
    if (term) {
      query += ` "*${this.escapeQuery(term)}*"`;
    }
    const ids = await this.invoke<number[]>('findNotes', { query });
    if (ids.length === 0) return [];
    const infos = await this.invoke<AnkiNoteInfo[]>('notesInfo', {
      notes: ids.slice(0, limit),
    });
    return infos.map((info) => {
      const note = this.toNote(info);
      return { noteId: note.noteId, fields: note.fields };
    });
  }

  /** Fetch a single note's fields by id, but only if it's still of the expected
   *  note type — used to resolve the builder's saved preview sample, which may
   *  have since been deleted or had its type changed. Returns null otherwise. */
  async getNoteForModel(
    modelId: number,
    noteId: number,
  ): Promise<{ noteId: number; fields: NoteFields } | null> {
    const infos = await this.invoke<AnkiNoteInfo[]>('notesInfo', {
      notes: [noteId],
    });
    const info = infos[0];
    // notesInfo returns [] (or an entry without fields) for a missing note.
    if (!info || !info.fields) return null;
    const ids = await this.invoke<number[]>('findNotes', {
      query: `mid:${modelId} nid:${noteId}`,
    });
    if (ids.length === 0) return null;
    const note = this.toNote(info);
    return { noteId: note.noteId, fields: note.fields };
  }

  async addNote(
    deckName: string,
    modelName: string,
    fields: NoteFields,
    tags: string[] = [],
  ): Promise<number> {
    const note = { deckName, modelName, fields, tags };

    // Strictly block duplicates: AnkiConnect's addNote also rejects them, but
    // canAddNotes lets us return a clean 409 instead of a generic error string.
    const [canAdd] = await this.invoke<boolean[]>('canAddNotes', {
      notes: [note],
    });
    if (!canAdd) {
      throw new ConflictException(
        'A note with this first field already exists in this note type.',
      );
    }

    return this.invoke<number>('addNote', { note });
  }

  async updateNoteFields(noteId: number, fields: NoteFields): Promise<void> {
    await this.invoke<null>('updateNoteFields', {
      note: { id: noteId, fields },
    });
  }

  async deleteNotes(noteIds: number[]): Promise<void> {
    await this.invoke<null>('deleteNotes', { notes: noteIds });
  }

  private toNote(info: AnkiNoteInfo): Note {
    const ordered = Object.entries(info.fields).sort(
      ([, a], [, b]) => a.order - b.order,
    );
    const fields: NoteFields = {};
    for (const [name, field] of ordered) {
      fields[name] = field.value;
    }
    return {
      noteId: info.noteId,
      modelName: info.modelName,
      tags: info.tags,
      fields,
      // Anki note IDs are the creation time in epoch milliseconds. `mod` is the
      // modification time in epoch seconds; fall back to creation if absent.
      created: info.noteId,
      modified: info.mod != null ? info.mod * 1000 : info.noteId,
    };
  }

  private escapeQuery(value: string): string {
    return value.replace(/["\\]/g, '\\$&');
  }

  private async countMatureCards(deckName: string): Promise<number> {
    const cards = await this.invoke<number[]>('findCards', {
      query: `deck:"${deckName}" prop:ivl>=84`,
    });
    return cards.length;
  }

  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
}
