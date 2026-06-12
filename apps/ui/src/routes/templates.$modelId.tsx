import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import type { Block, Layout, TemplateDetail } from '@nts/shared';
import { Button } from '#/components/ui/button';
import { Badge } from '#/components/ui/badge';
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
  // round-trip through the server and replace fields + layout in place.
  const [fields, setFields] = useState<string[]>([]);
  const [layout, setLayout] = useState<Layout>({ front: [], back: [] });
  const [css, setCss] = useState('');
  const [sampleNoteId, setSampleNoteId] = useState<number | null>(null);
  const [editVersion, setEditVersion] = useState(0);
  const loadedId = useRef<number | null>(null);

  useEffect(() => {
    const d = detailQuery.data;
    if (!d || loadedId.current === d.modelId) return;
    loadedId.current = d.modelId;
    setFields(d.fields);
    setLayout(d.layout);
    setCss(d.css ?? '');
    setSampleNoteId(d.sampleNoteId);
    setEditVersion(0);
  }, [detailQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveLayout(modelId, { layout, css: css || undefined, sampleNoteId }),
  });

  // Autosave the layout/css/sample shortly after the last edit.
  useEffect(() => {
    if (editVersion === 0) return;
    const id = setTimeout(() => saveMutation.mutate(), AUTOSAVE_MS);
    return () => clearTimeout(id);
  }, [editVersion]);

  const edited = () => setEditVersion((v) => v + 1);

  const setSide = (side: keyof Layout, blocks: Block[]) => {
    setLayout((l) => ({ ...l, [side]: blocks }));
    edited();
  };

  const onFieldApplied = (detail: TemplateDetail) => {
    setFields(detail.fields);
    setLayout(detail.layout);
    qc.setQueryData(templateKey(modelId), detail);
  };

  const resetMutation = useMutation({
    mutationFn: () => resetLayout(modelId),
    onSuccess: (detail) => {
      loadedId.current = null; // force re-seed from the reset detail
      qc.setQueryData(templateKey(modelId), detail);
      qc.invalidateQueries({ queryKey: templatesKey });
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
        <Button
          size="sm"
          variant="ghost"
          onClick={() => resetMutation.mutate()}
          title="Clear the custom layout and revert to the default render"
        >
          <RotateCcw /> Reset layout
        </Button>
      </div>

      {detail.isCloze && (
        <p className="mb-4 shrink-0 rounded-lg border border-milk-200/70 bg-milk-50/70 px-3 py-2 text-xs text-ink-400">
          Cloze note types keep Anki’s built-in rendering, so layout changes
          here won’t affect how their cards display.
        </p>
      )}

      <div className="grid min-h-0 flex-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        {/* Editor — scrolls independently when tall */}
        <div className="flex flex-col gap-6 overflow-y-auto pr-1 pb-8">
          <FieldPanel
            modelId={modelId}
            fields={fields}
            noteCount={detail.noteCount}
            onApplied={onFieldApplied}
          />
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
              edited();
            }}
          />
        </div>

        {/* Preview — vertically centered, scrolls only if it overflows */}
        <div className="flex flex-col overflow-y-auto">
          <div className="my-auto">
            <TemplatePreview
              modelId={modelId}
              fields={fields}
              layout={layout}
              css={css || undefined}
              sampleNoteId={sampleNoteId}
              onPickSample={(id) => {
                setSampleNoteId(id);
                edited();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
