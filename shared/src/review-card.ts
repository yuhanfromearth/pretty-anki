import { extractAudio, stripHtml } from './card-html.js';
import type { ReviewCard } from './review.js';

/** The raw card payload AnkiConnect's `guiCurrentCard` returns. */
export interface RawCurrentCard {
  cardId: number;
  question: string;
  answer: string;
  modelName: string;
  fields: Record<string, { value: string; order: number }>;
  deckName: string;
  buttons: number[];
  nextReviews: string[];
}

/** The slice of `cardsInfo` needed to complete the card — `guiCurrentCard`
 *  reports neither the note id, the card-template index, nor the scheduling
 *  state. `type` is Anki's card type: 0 new, 1 learning, 2 review,
 *  3 relearning. */
export interface CardOrdInfo {
  note: number;
  ord: number;
  type?: number;
}

/** Map Anki's numeric card type to the badge's three buckets, folding
 *  relearning (3) into learning to match Anki's red count. Defaults to
 *  'review' when the type is unknown. */
function cardTypeFor(type: number | undefined): ReviewCard['cardType'] {
  switch (type) {
    case 0:
      return 'new';
    case 1:
    case 3:
      return 'learning';
    default:
      return 'review';
  }
}

/** Build the app's `ReviewCard` from AnkiConnect's raw `guiCurrentCard` output
 *  plus the resolved note/ord. Pure so the audio-splitting and answer-side
 *  extraction can be tested without driving a live reviewer. */
export function formatReviewCard(
  card: RawCurrentCard,
  info: CardOrdInfo | undefined
): ReviewCard {
  const noteId = info?.note ?? 0;
  const ord = info?.ord ?? 0;
  const cardType = cardTypeFor(info?.type);

  const fieldEntries = Object.entries(card.fields);
  const allAudio = fieldEntries.flatMap(([, f]) => extractAudio(f.value));
  // Raw field values keyed by name, for the app-native Template renderer.
  const fields = Object.fromEntries(
    fieldEntries.map(([name, f]) => [name, f.value])
  );

  // Use the template-rendered question/answer rather than reconstructing from
  // note fields by position: a single note can produce multiple cards (e.g. an
  // inverted card swaps front/back), and only the rendered output reflects each
  // card's own template. The answer HTML repeats the front followed by
  // `<hr id=answer>`, so keep only the back half.
  const question = stripHtml(card.question);
  const answerBack =
    card.answer.split(/<hr id=?["']?answer["']?\s*\/?>/i)[1] ?? card.answer;
  const answer = stripHtml(answerBack);

  // Only attribute audio to the front when the rendered question side actually
  // references it — Anki marks sounds with `[anki:play:q:N]` (question) /
  // `[anki:play:a:N]` (answer) placeholders, or leaves the raw `[sound:...]`
  // form. Without this gate a sound that lives only on a back field would show a
  // play button on the front. The back replays the front too, so it gets every
  // sound.
  const questionHasAudio = /\[anki:play:q:|\[sound:/.test(card.question);
  const questionAudio = questionHasAudio ? allAudio : [];
  const answerAudio = allAudio;

  return {
    cardId: card.cardId,
    noteId,
    ord,
    modelName: card.modelName,
    cardType,
    question,
    answer,
    deckName: card.deckName,
    buttons: card.buttons,
    nextReviews: card.nextReviews ?? [],
    questionAudio,
    answerAudio,
    fields,
  };
}
