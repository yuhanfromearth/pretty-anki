import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import type {
  Block,
  CardTemplateLayout,
  Layout,
  TemplateDetail,
  UpdateLayout,
} from '@nts/shared';
import { cn } from '#/lib/utils';
import { Button } from '#/components/ui/button';
import { Badge } from '#/components/ui/badge';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '#/components/ui/dialog';
import { BlockStack } from '#/components/templates/block-stack';
import { FieldPanel } from '#/components/templates/field-panel';
import { CustomCss } from '#/components/templates/custom-css';
import { TemplatePreview } from '#/components/templates/template-preview';
import {
  fetchTemplate,
  resetLayout,
  saveLayout,
  templateKey,
  templatesKey,
} from '#/components/templates/api';

export const Route = createFileRoute('/templates/$modelId')({
  component: BuilderPage,
});

const AUTOSAVE_MS = 600;
const EMPTY_LAYOUT: Layout = { front: [], back: [] };

function BuilderPage() {
  const { modelId: modelIdParam } = Route.useParams();
  const modelId = Number(modelIdParam);
  const qc = useQueryClient();

  const detailQuery = useQuery({
    queryKey: templateKey(modelId),
    queryFn: () => fetchTemplate(modelId),
    retry: false,
  });

  // Working copy of the editable state, seeded once per model load. Field ops
  // round-trip through the server and replace fields + cards in place. `cards`
  // holds one layout per card template (direction); `css`/`sampleNoteId` are
  // note-type-level (shared across directions).
  const [fields, setFields] = useState<string[]>([]);
  const [cards, setCards] = useState<CardTemplateLayout[]>([]);
  const [selectedOrd, setSelectedOrd] = useState(0);
  const [css, setCss] = useState('');
  const [sampleNoteId, setSampleNoteId] = useState<number | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const loadedId = useRef<number | null>(null);

  useEffect(() => {
    const d = detailQuery.data;
    if (!d || loadedId.current === d.modelId) return;
    loadedId.current = d.modelId;
    setFields(d.fields);
    setCards(d.cards);
    setCss(d.css ?? '');
    setSampleNoteId(d.sampleNoteId);
    setSelectedOrd((o) => (o < d.cards.length ? o : 0));
  }, [detailQuery.data]);

  const selected = cards.find((c) => c.ord === selectedOrd) ?? cards[0] ?? null;
  const layout = selected?.layout ?? EMPTY_LAYOUT;

  // Per-direction debounced autosave. Each save targets one ord; a still-pending
  // save for a *different* direction is flushed before being replaced so quickly
  // editing two directions can't drop the first one's save.
  const saveMutation = useMutation({
    mutationFn: (body: UpdateLayout) => saveLayout(modelId, body),
  });
  const mutate = saveMutation.mutate;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<UpdateLayout | null>(null);

  const flushSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const body = pendingSave.current;
    pendingSave.current = null;
    if (body) mutate(body);
  }, [mutate]);

  const queueSave = useCallback(
    (body: UpdateLayout) => {
      if (pendingSave.current && pendingSave.current.ord !== body.ord) {
        flushSave();
      }
      pendingSave.current = body;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flushSave, AUTOSAVE_MS);
    },
    [flushSave]
  );

  // Flush a pending edit when leaving the builder.
  useEffect(() => () => flushSave(), [flushSave]);

  const save = useCallback(
    (next: { layout?: Layout; css?: string; sampleNoteId?: number | null }) => {
      queueSave({
        ord: selectedOrd,
        layout: next.layout ?? layout,
        css: (next.css ?? css) || undefined,
        sampleNoteId:
          next.sampleNoteId !== undefined ? next.sampleNoteId : sampleNoteId,
      });
    },
    [queueSave, selectedOrd, layout, css, sampleNoteId]
  );

  const setSide = (side: keyof Layout, blocks: Block[]) => {
    const nextLayout: Layout = { ...layout, [side]: blocks };
    setCards((cs) =>
      cs.map((c) =>
        c.ord === selectedOrd ? { ...c, layout: nextLayout, authored: true } : c
      )
    );
    save({ layout: nextLayout });
  };

  const onFieldApplied = (detail: TemplateDetail) => {
    setFields(detail.fields);
    setCards(detail.cards);
    qc.setQueryData(templateKey(modelId), detail);
  };

  const resetMutation = useMutation({
    mutationFn: () => resetLayout(modelId, selectedOrd),
    onSuccess: (detail) => {
      loadedId.current = null; // force re-seed from the reset detail
      qc.setQueryData(templateKey(modelId), detail);
      qc.invalidateQueries({ queryKey: templatesKey });
      setResetOpen(false);
    },
  });

  if (detailQuery.isPending) {
    return <div className="p-10 text-sm text-ink-300">Loading…</div>;
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="p-10 text-sm text-destructive">
        Couldn’t load this template — is Anki running?
      </div>
    );
  }

  const detail = detailQuery.data;
  const multi = cards.length > 1;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex shrink-0 items-center gap-3">
        <Button
          render={<Link to="/templates" />}
          size="icon-sm"
          variant="ghost"
        >
          <ArrowLeft />
        </Button>
        <h1 className="font-display text-2xl text-ink-900">{detail.name}</h1>
        {detail.isCloze && <Badge variant="outline">cloze</Badge>}
        <span className="ml-auto font-mono text-xs text-ink-300">
          {saveMutation.isPending ? 'saving…' : 'saved'}
        </span>
        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <Button
            size="sm"
            variant="ghost"
            disabled={!selected?.authored}
            onClick={() => setResetOpen(true)}
            title={
              selected?.authored
                ? 'Clear this direction’s layout and revert it to Anki'
                : 'This direction isn’t customized yet'
            }
          >
            <RotateCcw /> Reset {multi ? selected?.name : 'layout'}
          </Button>
          <DialogContent className="max-w-sm">
            <DialogTitle className="text-base font-semibold text-ink-900">
              Reset {multi ? `“${selected?.name}”` : 'layout'}?
            </DialogTitle>
            <DialogDescription className="mt-2.5 text-sm text-ink-500">
              This clears the app layout for{' '}
              <strong className="text-ink-700">
                {multi ? selected?.name : 'this note type'}
              </strong>{' '}
              and reverts it to what’s configured in Anki.
              {multi && ' Other directions keep their layouts.'} This can’t be
              undone.
            </DialogDescription>
            <div className="mt-5 flex items-center justify-end gap-2">
              <DialogClose>
                <Button variant="ghost" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                size="sm"
                disabled={resetMutation.isPending}
                onClick={() => resetMutation.mutate()}
              >
                {resetMutation.isPending ? 'Resetting…' : 'Reset'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {detail.isCloze && (
        <p className="mb-4 shrink-0 rounded-lg border border-milk-200/70 bg-milk-50/70 px-3 py-2 text-xs text-ink-400">
          Cloze note types keep Anki’s built-in rendering, so layout changes
          here won’t affect how their cards display.
        </p>
      )}

      <div className="grid min-h-0 flex-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        {/* Editor — vertically centered, scrolls from the top when it overflows */}
        <div className="flex flex-col overflow-y-auto pr-1">
          <div className="my-auto flex flex-col gap-6 pt-1 pb-20">
            <FieldPanel
              modelId={modelId}
              fields={fields}
              noteCount={detail.noteCount}
              onApplied={onFieldApplied}
            />
            {multi && (
              <DirectionTabs
                cards={cards}
                selectedOrd={selectedOrd}
                onSelect={(ord) => {
                  flushSave();
                  setSelectedOrd(ord);
                }}
              />
            )}
            <div className="flex flex-col gap-6">
              <BlockStack
                label="Front"
                blocks={layout.front}
                fields={fields}
                onChange={(b) => setSide('front', b)}
              />
              <BlockStack
                label="Back"
                blocks={layout.back}
                fields={fields}
                onChange={(b) => setSide('back', b)}
              />
            </div>
            <CustomCss
              value={css}
              onChange={(v) => {
                setCss(v);
                save({ css: v });
              }}
            />
          </div>
        </div>

        {/* Preview — vertically centered, scrolls only if it overflows */}
        <div className="flex flex-col overflow-y-auto">
          <div className="my-auto pb-20">
            <TemplatePreview
              modelId={modelId}
              fields={fields}
              layout={layout}
              css={css || undefined}
              sampleNoteId={sampleNoteId}
              onPickSample={(id) => {
                setSampleNoteId(id);
                save({ sampleNoteId: id });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Segmented control for switching the edited card template (direction). A dot
 *  marks directions already authored in the app (vs. seeded from Anki). */
function DirectionTabs({
  cards,
  selectedOrd,
  onSelect,
}: {
  cards: CardTemplateLayout[];
  selectedOrd: number;
  onSelect: (ord: number) => void;
}) {
  return (
    <div className="flex w-fit items-center gap-1 rounded-full border border-milk-200/70 bg-milk-50/70 p-1">
      {cards.map((c) => {
        const active = c.ord === selectedOrd;
        return (
          <button
            key={c.ord}
            type="button"
            onClick={() => onSelect(c.ord)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-mint-500 text-white dark:text-cocoa-950'
                : 'text-ink-400 hover:text-ink-700'
            )}
          >
            {c.name}
            {c.authored && (
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  active ? 'bg-white/70 dark:bg-cocoa-950/60' : 'bg-mint-500'
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
