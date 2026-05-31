import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
} from '@nts/dtos';

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
        fields: Record<string, { value: string; order: number }>;
        deckName: string;
        buttons: number[];
        nextReviews: string[];
      } | null>('guiCurrentCard');
      if (!card) return null;

      const fieldEntries = Object.entries(card.fields).sort(
        ([, a], [, b]) => a.order - b.order,
      );
      const audio = fieldEntries.flatMap(([, f]) => this.extractAudio(f.value));
      const question = this.stripHtml(fieldEntries[0]?.[1]?.value ?? '');
      const answer = this.stripHtml(fieldEntries[1]?.[1]?.value ?? '');

      return {
        cardId: card.cardId,
        question,
        answer,
        deckName: card.deckName,
        buttons: card.buttons,
        nextReviews: card.nextReviews ?? [],
        audio,
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
    };
  }

  private escapeQuery(value: string): string {
    return value.replace(/["\\]/g, '\\$&');
  }

  private extractAudio(html: string): string[] {
    const matches = [...html.matchAll(/\[sound:([^\]]+)]/g)];
    return matches.map((m) => m[1]);
  }

  private stripHtml(html: string): string {
    return html
      .replace(/\[sound:[^\]]+]/g, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .trim()
      .replace(/\n/g, '<br>');
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
