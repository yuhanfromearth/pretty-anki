import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  DeckStats,
  DeckStatsItem,
  Streak,
  ReviewPace,
  ReviewCard,
  ReviewSession,
} from '@nts/dtos';

interface AnkiDeckStats {
  deck_id: number;
  name: string;
  new_count: number;
  learn_count: number;
  review_count: number;
  total_in_deck: number;
}

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

    return { days };
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

  async getMediaFile(filename: string): Promise<Buffer | null> {
    const b64 = await this.invoke<string | null>('retrieveMediaFile', {
      filename,
    });
    if (!b64) return null;
    return Buffer.from(b64, 'base64');
  }

  private extractAudio(html: string): string[] {
    const matches = [...html.matchAll(/\[sound:([^\]]+)]/g)];
    return matches.map((m) => m[1]);
  }

  private stripHtml(html: string): string {
    return html
      .replace(/\[sound:[^\]]+]/g, '')
      .replace(/<[^>]*>/g, '')
      .trim();
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
