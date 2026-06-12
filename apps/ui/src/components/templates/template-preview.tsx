import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import type { Layout, NoteFields, TemplateSample } from '@nts/shared';
import { fieldToPlainText } from '#/components/manage/manage-media';
import { TemplateCard } from './template-card';
import {
  defaultSampleKey,
  fetchDefaultSample,
  sampleSearchKey,
  searchSamples,
} from './api';

/** The hero of the builder: renders the live layout in the real card chrome,
 *  filled by a single sample note. One card shows by default (the saved pick,
 *  else the first note of this type, else field-name placeholders); a search
 *  box above the card lets the user find and swap in any other note of this
 *  type. The chosen note is persisted via `onPickSample`. */
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
  const [flipped, setFlipped] = useState(false);

  // The default sample resolves the saved pick (or first note) server-side, so
  // a reload restores the previously previewed card with its fields.
  const defaultQuery = useQuery({
    queryKey: defaultSampleKey(modelId),
    queryFn: () => fetchDefaultSample(modelId),
    retry: false,
  });

  // A locally picked search result overrides the default until the model
  // reloads. Reset when switching to a different note type.
  const [picked, setPicked] = useState<TemplateSample | null>(null);
  useEffect(() => {
    setPicked(null);
  }, [modelId]);

  const active = picked ?? defaultQuery.data?.sample ?? null;

  const placeholderFields = useMemo<NoteFields>(
    () => Object.fromEntries(fields.map((f) => [f, `[${f}]`])),
    [fields]
  );
  const activeFields = active?.fields ?? placeholderFields;

  const select = (sample: TemplateSample) => {
    setPicked(sample);
    setFlipped(false);
    onPickSample(sample.noteId);
  };

  return (
    <div className="flex flex-col gap-4">
      <SampleSearch
        modelId={modelId}
        firstField={fields[0]}
        activeNoteId={picked?.noteId ?? sampleNoteId}
        onSelect={select}
      />

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

/** Debounced typeahead over the note type's own notes. Shows a dropdown of
 *  matches (labelled by first field) while focused with a non-empty query;
 *  picking one closes the list and clears the box. */
function SampleSearch({
  modelId,
  firstField,
  activeNoteId,
  onSelect,
}: {
  modelId: number;
  firstField: string | undefined;
  activeNoteId: number | null;
  onSelect: (sample: TemplateSample) => void;
}) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  // Close the dropdown on an outside click without stealing the row's own click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const term = debounced.trim();
  const resultsQuery = useQuery({
    queryKey: sampleSearchKey(modelId, term),
    queryFn: () => searchSamples(modelId, term),
    enabled: open && term.length > 0,
    retry: false,
  });
  const results = resultsQuery.data?.samples ?? [];

  const pick = (sample: TemplateSample) => {
    onSelect(sample);
    setSearch('');
    setDebounced('');
    setOpen(false);
  };

  const labelFor = (sample: TemplateSample) =>
    fieldToPlainText(sample.fields[firstField ?? ''] ?? '') || '(empty)';

  const showDropdown = open && term.length > 0;

  return (
    <div ref={boxRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Search cards to preview…"
        className="h-9 w-full rounded-xl border border-milk-300/70 bg-milk-50/70 pl-9 pr-9 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-mint-400 focus:bg-milk-50"
      />
      {search && (
        <button
          type="button"
          onClick={() => {
            setSearch('');
            setDebounced('');
          }}
          title="Clear"
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-milk-200 hover:text-ink-600"
        >
          <X className="size-3.5" />
        </button>
      )}

      {showDropdown && (
        <div className="absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-milk-300/70 bg-milk-50 p-1 shadow-medium">
          {resultsQuery.isPending ? (
            <p className="px-3 py-2 text-xs text-ink-300">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-ink-300">No cards match.</p>
          ) : (
            results.map((sample) => {
              const isActive = sample.noteId === activeNoteId;
              return (
                <button
                  key={sample.noteId}
                  type="button"
                  // mousedown beats the input's blur so the pick registers.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(sample);
                  }}
                  className={`flex w-full items-baseline gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-mint-500/10 text-ink-900'
                      : 'text-ink-700 hover:bg-milk-200'
                  }`}
                >
                  <span className="truncate font-korean">
                    {labelFor(sample)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
