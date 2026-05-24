import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DeckStats, DeckStatsItem, Streak, ReviewPace } from '@nts/dtos';

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
    const statsMap = await this.invoke<Record<string, AnkiDeckStats>>(
      'getDeckStats',
      { decks: deckNames },
    );

    const decks: DeckStatsItem[] = await Promise.all(
      deckNames.map(async (name) => {
        const s =
          statsMap[name] ??
          Object.values(statsMap).find((v) => v.name === name);
        const matureCards = await this.countMatureCards(name);

        return {
          name,
          newCount: s?.new_count ?? 0,
          learnCount: s?.learn_count ?? 0,
          reviewCount: s?.review_count ?? 0,
          totalCards: s?.total_in_deck ?? 0,
          matureCards,
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
