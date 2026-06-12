import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Layout, NoteFields } from '@nts/shared';
import { Button } from '#/components/ui/button';
import { TemplateCard } from './template-card';
import { fetchSamples, samplesKey } from './api';

/** The hero of the builder: renders the live layout in the real card chrome,
 *  filled with a real note when the type has any (cycle through a few to test
 *  short/long content) and field-name placeholders otherwise. */
export function TemplatePreview({
  modelId,
  fields,
  layout,
  css,
  sampleNoteId,
  onPickSample,
}: {
  modelId: number;
  fields: string[];
  layout: Layout;
  css?: string;
  sampleNoteId: number | null;
  onPickSample: (noteId: number | null) => void;
}) {
  const samplesQuery = useQuery({
    queryKey: samplesKey(modelId),
    queryFn: () => fetchSamples(modelId),
    retry: false,
  });
  const samples = samplesQuery.data?.samples ?? [];

  const [flipped, setFlipped] = useState(false);

  // Resolve the active sample: the stored choice if still present, else the
  // first available, else null (placeholders).
  const index = useMemo(() => {
    if (samples.length === 0) return -1;
    const stored = samples.findIndex((s) => s.noteId === sampleNoteId);
    return stored >= 0 ? stored : 0;
  }, [samples, sampleNoteId]);

  const placeholderFields = useMemo<NoteFields>(
    () => Object.fromEntries(fields.map((f) => [f, `[${f}]`])),
    [fields]
  );
  const activeFields =
    index >= 0 ? (samples[index]?.fields ?? {}) : placeholderFields;

  const step = (delta: number) => {
    if (samples.length === 0) return;
    const next = (index + delta + samples.length) % samples.length;
    onPickSample(samples[next].noteId);
    setFlipped(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-300">
          {index >= 0
            ? `sample ${index + 1} / ${samples.length}`
            : 'placeholder preview'}
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={samples.length < 2}
            onClick={() => step(-1)}
            title="Previous sample"
          >
            <ChevronLeft />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={samples.length < 2}
            onClick={() => step(1)}
            title="Next sample"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <TemplateCard
        front={layout.front}
        back={layout.back}
        fields={activeFields}
        css={css}
        flipped={flipped}
        onFlip={() => setFlipped((f) => !f)}
      />

      <p className="text-center text-xs text-ink-300">
        {flipped
          ? 'Showing back — tap to flip back'
          : 'Showing front — tap to flip'}
      </p>
    </div>
  );
}
