import { useMemo } from 'react';
import type { NoteFields } from '@nts/shared';
import { extractAudio, stripHtml } from '@nts/shared';
import { ReviewCard } from '#/components/review/review-card';

const noop = () => {};

/** Renders the live note exactly as the review screen would show it: the real
 *  ReviewCard, front and back, fed the current field values run through the same
 *  stripHtml the review pipeline uses. Front field → question, second field →
 *  answer; audio is gathered from every field. The edit affordance and hover
 *  tilt are suppressed since this is a static, read-only preview. */
export function CardPreview({
  fieldNames,
  values,
}: {
  fieldNames: string[];
  values: NoteFields;
}) {
  const question = useMemo(
    () => stripHtml(values[fieldNames[0]] ?? ''),
    [values, fieldNames]
  );
  const answer = useMemo(
    () => stripHtml(values[fieldNames[1]] ?? ''),
    [values, fieldNames]
  );
  const audio = useMemo(
    () => Object.values(values).flatMap((v) => extractAudio(v)),
    [values]
  );

  const common = {
    cardId: 0,
    noteId: 0,
    deckName: '',
    question,
    answer,
    audio,
    dismiss: null,
    tilt: false,
    showEdit: false,
    onFlip: noop,
  } as const;

  return (
    <div className="flex flex-col gap-6">
      <Side label="Front">
        <ReviewCard {...common} flipped={false} />
      </Side>
      <Side label="Back">
        <ReviewCard {...common} flipped />
      </Side>
    </div>
  );
}

function Side({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-300">
        {label}
      </span>
      {children}
    </div>
  );
}
