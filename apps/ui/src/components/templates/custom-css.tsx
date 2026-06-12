import { useState } from 'react';
import { AlignLeft, ChevronRight, Code2, HelpCircle } from 'lucide-react';
import { Button } from '#/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '#/components/ui/dialog';

/** Per-Template custom CSS — the card-level half of the raw escape hatch.
 *  Collapsed by default so it never intimidates; sanitised and scoped to the
 *  card at render time (see template-card). A help dialog explains how it
 *  works. */
export function CustomCss({
  value,
  onChange,
}: {
  value: string;
  onChange: (css: string) => void;
}) {
  const [open, setOpen] = useState(value.trim().length > 0);
  const [help, setHelp] = useState(false);

  return (
    <div className="rounded-xl border border-milk-200/70 bg-milk-50/70">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          className="flex flex-1 items-center gap-2 text-left"
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronRight
            className={`size-3.5 text-ink-300 transition-transform ${open ? 'rotate-90' : ''}`}
          />
          <Code2 className="size-3.5 text-ink-300" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-300">
            Custom CSS
          </span>
        </button>
        <Button
          size="xs"
          variant="ghost"
          className="text-ink-400"
          disabled={!value.trim()}
          onClick={() => onChange(formatCss(value))}
          title="Auto-format CSS"
        >
          <AlignLeft /> Format
        </Button>
        <button
          className="flex size-5 items-center justify-center rounded-full text-ink-300 transition-colors hover:bg-milk-200 hover:text-ink-600"
          title="How custom CSS works"
          aria-label="How custom CSS works"
          onClick={() => setHelp(true)}
        >
          <HelpCircle className="size-3.5" />
        </button>
      </div>
      {open && (
        <textarea
          className="h-32 w-full resize-y rounded-b-xl border-t border-milk-200/70 bg-milk-50 p-3 font-mono text-xs text-ink-700 outline-none focus-visible:border-ring"
          value={value}
          spellCheck={false}
          placeholder=".card { color: #333; }"
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <DialogTitle>Custom CSS</DialogTitle>
          <DialogDescription>
            CSS applied to every card built from this template.
          </DialogDescription>

          <div className="mt-3 flex flex-col gap-3 text-sm text-ink-600">
            <p>
              These rules style{' '}
              <span className="font-medium text-ink-800">
                every card of this template
              </span>
              . They’re automatically{' '}
              <span className="font-medium text-ink-800">scoped</span> to the
              card region, so they can’t affect the rest of the app. Scripts and
              event handlers are stripped — only styling is kept.
            </p>
            <p>
              Style the whole card with{' '}
              <span className="font-mono text-xs">.card</span> or{' '}
              <span className="font-mono text-xs">body</span> (as in Anki), or
              target elements inside it:
            </p>
            <pre className="rounded-lg border border-milk-200/70 bg-milk-100/60 p-3 font-mono text-xs text-ink-700">
              {`.card { color: #333; }
img   { border-radius: 16px; }`}
            </pre>
            <p>
              For precise control, give a block a class through its raw HTML
              (the <span className="font-mono text-xs">{'</>'}</span> toggle),
              then style that class:
            </p>
            <pre className="rounded-lg border border-milk-200/70 bg-milk-100/60 p-3 font-mono text-xs text-ink-700">
              {`Raw block:  <span class="term">{{value}}</span>
Custom CSS: .term { color: #b45; font-weight: 600; }`}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Minimal, dependency-free CSS pretty-printer: one declaration per line,
 *  two-space indentation per brace depth, normalised spacing. Brace-depth aware
 *  so nested at-rules (e.g. @media) indent correctly. Good enough for the
 *  simple rules written here; not a full CSS parser (comments with stray braces
 *  aren't handled). */
function formatCss(css: string): string {
  const decl = (raw: string): string => {
    const text = raw.trim();
    if (!text) return '';
    const colon = text.indexOf(':');
    if (colon === -1) return text.replace(/\s+/g, ' ');
    const prop = text.slice(0, colon).trim();
    const val = text
      .slice(colon + 1)
      .trim()
      .replace(/\s+/g, ' ');
    return `${prop}: ${val};`;
  };

  let out = '';
  let depth = 0;
  let buf = '';
  const pad = () => '  '.repeat(depth);

  for (const ch of css) {
    if (ch === '{') {
      const sel = buf
        .trim()
        .replace(/\s*,\s*/g, ', ')
        .replace(/\s+/g, ' ');
      out += `${pad()}${sel} {\n`;
      depth++;
      buf = '';
    } else if (ch === '}') {
      const d = decl(buf);
      if (d) out += `${pad()}${d}\n`;
      depth = Math.max(0, depth - 1);
      out += `${pad()}}\n`;
      buf = '';
    } else if (ch === ';') {
      const d = decl(buf);
      if (d) out += `${pad()}${d}\n`;
      buf = '';
    } else {
      buf += ch;
    }
  }

  return out.trim();
}
