import { describe, it, expect } from 'vitest';
import { formatReviewCard, type RawCurrentCard } from '@nts/shared';

function rawCard(overrides: Partial<RawCurrentCard> = {}): RawCurrentCard {
  return {
    cardId: 1,
    question: 'Front text',
    answer: 'Front text<hr id=answer>Back text',
    modelName: 'Basic',
    fields: {
      Front: { value: 'Front text', order: 0 },
      Back: { value: 'Back text', order: 1 },
    },
    deckName: 'Korean',
    buttons: [1, 2, 3, 4],
    nextReviews: ['<1m', '<10m', '1d', '4d'],
    ...overrides,
  };
}

describe('formatReviewCard', () => {
  it('resolves note id and ord from cardsInfo', () => {
    const card = formatReviewCard(rawCard(), { note: 555, ord: 1 });
    expect(card.noteId).toBe(555);
    expect(card.ord).toBe(1);
  });

  it('defaults note id and ord to 0 when cardsInfo is missing', () => {
    const card = formatReviewCard(rawCard(), undefined);
    expect(card.noteId).toBe(0);
    expect(card.ord).toBe(0);
  });

  it('keeps only the back half of the answer after the answer separator', () => {
    const card = formatReviewCard(rawCard(), { note: 1, ord: 0 });
    expect(card.question).toBe('Front text');
    expect(card.answer).toBe('Back text');
  });

  it('falls back to the whole answer when there is no separator', () => {
    const card = formatReviewCard(
      rawCard({ answer: 'No separator here' }),
      undefined,
    );
    expect(card.answer).toBe('No separator here');
  });

  it('extracts audio and withholds front audio that the front does not reference', () => {
    const card = formatReviewCard(
      rawCard({
        question: 'What is this?',
        answer: 'What is this?<hr id=answer>[sound:back.mp3]',
        fields: {
          Front: { value: 'What is this?', order: 0 },
          Back: { value: '[sound:back.mp3]', order: 1 },
        },
      }),
      undefined,
    );
    // Sound lives only on the back, and the front never references it.
    expect(card.questionAudio).toEqual([]);
    expect(card.answerAudio).toEqual(['back.mp3']);
  });

  it('attributes audio to the front when the question references a sound', () => {
    const card = formatReviewCard(
      rawCard({
        question: '[anki:play:q:0]',
        answer: '[anki:play:q:0]<hr id=answer>back',
        fields: { Front: { value: '[sound:front.mp3]', order: 0 } },
      }),
      undefined,
    );
    expect(card.questionAudio).toEqual(['front.mp3']);
    expect(card.answerAudio).toEqual(['front.mp3']);
  });

  it('carries raw field values through for the template renderer', () => {
    const card = formatReviewCard(rawCard(), undefined);
    expect(card.fields).toEqual({ Front: 'Front text', Back: 'Back text' });
  });
});
