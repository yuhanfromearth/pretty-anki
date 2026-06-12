import type { Block, Layout, Role } from './template.js';
import { sanitizeHtml } from './sanitize-html.js';

/** Compile an app-native Template (role-based block layout) into a real Anki
 *  note type's card template HTML + model CSS, so the styling a user builds here
 *  is persisted into the Anki collection itself — it then exports with the
 *  `.apkg` and renders for anyone opening the deck in Anki, not just in this app.
 *
 *  Roles map onto Anki's native model the way Anki intends: each block becomes a
 *  `{{Field}}` reference wrapped in a semantic `role-*` class, and the role's
 *  typography lives in the shared model CSS (one definition styles every card of
 *  the type). This is the portable twin of `template-render.ts`, which renders
 *  the same roles with Tailwind for the in-app preview. The two must be kept
 *  visually in sync — `ROLE_CSS` below mirrors `ROLE_STYLES` there. */

export interface AnkiCardTemplate {
  Name: string;
  Front: string;
  Back: string;
}

export interface CompiledModel {
  /** Full model CSS: leading Google-Fonts @import, card chrome, role rules,
   *  then the user's sanitised custom CSS. */
  css: string;
  /** Single card template (the builder is single-card). */
  cardTemplates: AnkiCardTemplate[];
}

/** Web fonts the roles use, imported from Google Fonts. Must lead the
 *  stylesheet — a `@import` after any rule is invalid and dropped. Renders
 *  correctly anywhere online; offline/AnkiMobile falls back to the generic
 *  families in each stack below. */
const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400&family=Inter+Tight:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@400;500&family=Noto+Serif+KR:wght@400;500&display=swap');";

// Font stacks mirror the app's `styles.css`. Noto Serif KR is appended to every
// stack as the CJK fallback so Hangul/Hanja render even though the primary face
// is Latin-only — the role conveys hierarchy, the stack supplies the glyphs.
const DISPLAY = "'Fraunces', 'Noto Serif KR', Georgia, serif";
const SANS = "'Inter Tight', 'Noto Serif KR', system-ui, sans-serif";
const MONO = "'JetBrains Mono', 'Noto Serif KR', ui-monospace, monospace";

const INK = '#2c2523';
const MUTED = '#8a817c';
const PAPER = '#faf7f2';
const RULE = '#e7ddcf';
const INK_DARK = '#f7ecd2';
const PAPER_DARK = '#1c1917';

/** Plain-CSS twin of `ROLE_STYLES` in `template-render.ts`. Keep the two in
 *  sync: those Tailwind classes drive the in-app preview, these drive the
 *  exported Anki card, so "what you build equals what you study" survives export. */
const ROLE_CSS: Record<Exclude<Role, 'audio' | 'image'>, string> = {
  heading:
    `font-family:${DISPLAY};font-size:3rem;font-weight:500;` +
    'letter-spacing:-0.025em;line-height:1.1;',
  subheading: `font-family:${DISPLAY};font-size:1.5rem;line-height:1.3;`,
  annotation: `font-family:${MONO};font-size:1rem;color:${MUTED};`,
  body: `font-family:${SANS};font-size:1.25rem;line-height:1.625;`,
  example: `font-family:${SANS};font-size:1.125rem;font-style:italic;color:${MUTED};`,
};

/** Card chrome + per-role rules. Scoped under `.card` (the wrapper Anki puts
 *  around rendered template HTML) so it can't leak, mirroring the app shell. */
function modelCss(): string {
  const roleRules = Object.entries(ROLE_CSS)
    .map(([role, decl]) => `.card .role-${role}{${decl}}`)
    .join('\n');

  return [
    FONT_IMPORT,
    `.card{font-family:${SANS};color:${INK};background-color:${PAPER};` +
      'text-align:center;padding:2.25rem 1.5rem;line-height:1.5;}',
    '.card .blk + .blk{margin-top:0.85rem;}',
    '.card .role-image img{max-width:100%;max-height:18rem;' +
      'border-radius:0.75rem;}',
    `.card hr#answer{border:none;border-top:1px solid ${RULE};margin:1.5rem 0;}`,
    `.nightMode .card,.card.nightMode{background-color:${PAPER_DARK};` +
      `color:${INK_DARK};}`,
    `.nightMode .card hr#answer,.card.nightMode hr#answer` +
      '{border-top-color:#3a352f;}',
    roleRules,
  ].join('\n');
}

/** One block → Anki template HTML. Wrapped in a `{{#Field}}…{{/Field}}`
 *  conditional so an empty field renders nothing (mirroring the in-app
 *  renderer's empty-value skip) instead of an empty styled box. */
function blockHtml(block: Block): string {
  const open = `{{#${block.field}}}`;
  const close = `{{/${block.field}}}`;
  const ref = `{{${block.field}}}`;

  if (block.raw !== undefined) {
    // Raw escape hatch: author HTML with a single {{value}} placeholder, mapped
    // onto the live Anki field reference and stripped of script execution.
    const filled = block.raw.replace(/\{\{\s*value\s*\}\}/g, ref);
    return `${open}<div class="blk">${sanitizeHtml(filled)}</div>${close}`;
  }

  // audio/image fields hold Anki-native markup ([sound:…] / <img>); Anki turns
  // those into a play button / image on its own when we emit the field verbatim.
  const role = block.role;
  return `${open}<div class="blk role-${role}">${ref}</div>${close}`;
}

function sideHtml(blocks: Block[]): string {
  return blocks.map(blockHtml).join('\n');
}

/** Compile a layout (+ optional custom CSS) into the Anki card template + CSS.
 *  The back face mirrors the app: it shows the back blocks only (the app's flip
 *  reveals a separate back face), not the conventional `{{FrontSide}}` repeat,
 *  so the exported card matches the builder preview exactly. `templateName` is
 *  the existing card-template name to overwrite (Anki keys templates by name). */
export function compileLayoutToAnki(
  layout: Layout,
  css: string | undefined,
  templateName = 'Card 1'
): CompiledModel {
  const custom = css?.trim() ? `\n\n/* custom */\n${sanitizeHtml(css)}` : '';
  return {
    css: modelCss() + custom,
    cardTemplates: [
      {
        Name: templateName,
        Front: sideHtml(layout.front),
        Back: sideHtml(layout.back),
      },
    ],
  };
}
