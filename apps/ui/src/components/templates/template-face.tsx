import { useId, useMemo } from 'react';
import { Volume2 } from 'lucide-react';
import type { Block, NoteFields } from '@nts/shared';
import { extractAudio, renderBlockHtml, sanitizeHtml } from '@nts/shared';

/** One side of an app-native Template: the ordered Front/Back block stack laid
 *  out inside the shared card chrome (rounded panel, gradient). This is the
 *  single face renderer used by the builder preview, the manage preview and the
 *  live review card, so what you build equals what you study. Text/raw blocks
 *  come from the shared `renderBlockHtml`; `audio`/`image` render as components.
 *  The card-level wrappers (perspective, flip, tilt, dismiss) live in the
 *  callers (`TemplateCard`, `ReviewCard`).
 *
 *  `frontBlocks` mirrors Anki's `{{FrontSide}}`: when given on the back face, the
 *  front content is rendered on top, a divider below it, then the back blocks —
 *  so flipping never hides the question. */
export function TemplateFace({
  blocks,
  fields,
  side,
  backface = false,
  frontBlocks,
}: {
  blocks: Block[];
  fields: NoteFields;
  side: 'front' | 'back';
  backface?: boolean;
  frontBlocks?: Block[];
}) {
  const showFront = side === 'back' && !!frontBlocks;
  const gradient =
    side === 'front'
      ? 'bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(234,219,200,0.3)_0%,transparent_60%)] dark:bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(247,236,210,0.05)_0%,transparent_60%)]'
      : 'bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(127,179,154,0.1)_0%,transparent_55%)] dark:bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(90,153,120,0.05)_0%,transparent_55%)]';

  return (
    <div
      className="col-start-1 row-start-1 overflow-hidden rounded-3xl border border-milk-200/60 bg-milk-50/95 shadow-medium"
      style={{
        backfaceVisibility: 'hidden',
        transform: backface ? 'rotateY(180deg)' : undefined,
      }}
    >
      <div className={`absolute inset-0 ${gradient}`} />
      <div className="relative flex h-full flex-col items-center justify-center gap-4 px-10 py-12 text-center">
        {showFront && (
          <>
            {frontBlocks.map((b) => (
              <BlockView key={b.id} block={b} fields={fields} />
            ))}
            <div className="mx-auto h-px w-24 bg-milk-300/80" />
          </>
        )}
        {blocks.length === 0 ? (
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-300">
            empty {side}
          </span>
        ) : (
          blocks.map((b) => <BlockView key={b.id} block={b} fields={fields} />)
        )}
      </div>
    </div>
  );
}

function BlockView({ block, fields }: { block: Block; fields: NoteFields }) {
  const value = fields[block.field] ?? '';

  if (block.raw === undefined && block.role === 'audio') {
    return <AudioChip files={extractAudio(value)} />;
  }
  if (block.raw === undefined && block.role === 'image') {
    const file = extractImage(value);
    if (!file) return null;
    return (
      <img
        src={`/api/anki/media/${encodeURIComponent(file)}`}
        alt=""
        className="max-h-56 w-auto rounded-xl object-contain"
      />
    );
  }

  const html = renderBlockHtml(block, fields);
  if (html === null || html.length === 0) return null;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function AudioChip({ files }: { files: string[] }) {
  if (files.length === 0) return null;
  const play = (e: React.MouseEvent) => {
    e.stopPropagation();
    new Audio(`/api/anki/media/${encodeURIComponent(files[0])}`).play();
  };
  return (
    <button
      onClick={play}
      className="flex size-10 items-center justify-center rounded-full border border-milk-300/80 bg-milk-100/80 text-ink-400 transition-colors hover:bg-milk-200 hover:text-ink-600 active:scale-95"
    >
      <Volume2 className="size-4" />
    </button>
  );
}

/** Pull the first image filename out of an Anki image field's HTML. */
function extractImage(html: string): string | null {
  const match = html.match(/<img[^>]*\ssrc=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

/** Scope a card's custom CSS to a single instance so styles can't leak into the
 *  app shell. Returns the unique `scope` class to put on the card root and the
 *  rewritten CSS to drop into a `<style>`. */
export function useScopedCss(css?: string): {
  scope: string;
  scopedCss: string;
} {
  const scope = useId().replace(/:/g, '');
  const scopedCss = useMemo(
    () => (css ? scopeCss(sanitizeHtml(css), scope) : ''),
    [css, scope]
  );
  return { scope, scopedCss };
}

/** Scope the (already sanitised) custom CSS to this card so styles can't leak
 *  into the app. Each selector is prefixed with the card's scope class, except
 *  the root-level selectors people reach for from Anki (`body`, `html`, `:root`,
 *  `.card`), whose leading token is mapped onto the card root itself — so
 *  `body { color: red }` and `.card { … }` style the whole card as expected. */
function scopeCss(css: string, scope: string): string {
  const root = `.tmpl-${scope}`;
  return css.replace(
    /(^|})\s*([^{}@]+)\s*\{/g,
    (_m, brace: string, sel: string) => {
      const scoped = sel
        .split(',')
        .map((s) => {
          const trimmed = s.trim();
          if (!trimmed) return trimmed;
          // Map a leading body/html/:root/.card onto the card root element.
          const mapped = trimmed.replace(
            /^(?:body|html|:root|\.card)\b/i,
            root
          );
          return mapped === trimmed ? `${root} ${trimmed}` : mapped;
        })
        .join(', ');
      return `${brace} ${scoped} {`;
    }
  );
}
