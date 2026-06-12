import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NoteFields } from '@nts/shared';
import { extractAudio, stripHtml } from '@nts/shared';
import { ReviewCard } from '#/components/review/review-card';
import { TemplateCard } from '#/components/templates/template-card';
import {
  fetchTemplate,
  fetchTemplates,
  templateKey,
  templatesKey,
} from '#/components/templates/api';

const noop = () => {};

/** Renders the live note exactly as the review screen would show it. When the
 *  note type has an app-native layout (customized in the Template builder), the
 *  preview honors it — placing each field by role/order via the same
 *  `TemplateCard` the builder uses, so "what you build" equals "what you see"
 *  here too. Note types that have never been opened in the builder fall back to
 *  the legacy flat rendering: first field → question, all remaining fields →
 *  answer, run through the same `stripHtml` the review pipeline uses. Audio is
 *  attributed by side (front field vs. the rest) so a back-only sound doesn't
 *  surface on the front. The edit affordance and hover tilt are suppressed
 *  since this is a static, read-only preview. */
export function CardPreview({
  modelName,
  fieldNames,
  values,
}: {
  modelName: string;
  fieldNames: string[];
  values: NoteFields;
}) {
  // Resolve this note type to its app-native Template. Notes carry only
  // modelName, so map it to a modelId via the templates list, then load the
  // saved layout when the type has been customized in the builder.
  const summariesQuery = useQuery({
    queryKey: templatesKey,
    queryFn: fetchTemplates,
    retry: false,
  });
  const summary = summariesQuery.data?.templates.find(
    (t) => t.name === modelName
  );
  // Only customized, non-cloze types carry a layout worth honoring; everything
  // else stays on the flat fallback below.
  const useTemplate = !!summary && summary.customized && !summary.isCloze;

  const detailQuery = useQuery({
    queryKey: templateKey(summary?.modelId ?? -1),
    queryFn: () => fetchTemplate(summary!.modelId),
    enabled: useTemplate,
    retry: false,
  });
  const layout = detailQuery.data?.layout;
  const css = detailQuery.data?.css;

  // Fallback inputs, computed unconditionally to keep hook order stable.
  const question = useMemo(
    () => stripHtml(values[fieldNames[0]] ?? ''),
    [values, fieldNames]
  );
  const answer = useMemo(
    () =>
      fieldNames
        .slice(1)
        .map((name) => stripHtml(values[name] ?? ''))
        .filter((html) => html.length > 0)
        .join('<br>'),
    [values, fieldNames]
  );
  // Audio is attributed by side to match the review screen: the front carries
  // only its own field's sound, while the back (which repeats the front) gets
  // every sound. This keeps a back-only audio field from showing a play button
  // on the front.
  const questionAudio = useMemo(
    () => extractAudio(values[fieldNames[0]] ?? ''),
    [values, fieldNames]
  );
  const answerAudio = useMemo(
    () => Object.values(values).flatMap((v) => extractAudio(v)),
    [values]
  );

  // Don't flash the fallback before we know whether a layout exists.
  if (summariesQuery.isPending) return <PreviewLoading />;

  if (useTemplate) {
    if (!layout) return <PreviewLoading />;
    return (
      <div className="flex flex-col gap-6">
        <Side label="Front">
          <TemplateCard
            front={layout.front}
            back={layout.back}
            fields={values}
            css={css}
            flipped={false}
            onFlip={noop}
          />
        </Side>
        <Side label="Back">
          <TemplateCard
            front={layout.front}
            back={layout.back}
            fields={values}
            css={css}
            flipped
            onFlip={noop}
          />
        </Side>
      </div>
    );
  }

  const common = {
    cardId: 0,
    noteId: 0,
    deckName: '',
    question,
    answer,
    questionAudio,
    answerAudio,
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

function PreviewLoading() {
  return (
    <div className="flex flex-col gap-6">
      {(['Front', 'Back'] as const).map((label) => (
        <Side key={label} label={label}>
          <div className="min-h-96 w-full animate-pulse rounded-3xl border border-milk-200/60 bg-milk-100/60" />
        </Side>
      ))}
    </div>
  );
}
