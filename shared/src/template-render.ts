import type { Block, Layout, Role } from './template.js';
import { stripHtml } from './card-html.js';
import { sanitizeHtml } from './sanitize-html.js';

/** Shared rendering for the app-native Template layout. Used by the UI for the
 *  live builder preview and the review/manage cards. Kept pure and
 *  framework-agnostic so the same role→style mapping drives every surface and
 *  "what you build" always equals "what you study". Sibling to `card-html.ts`. */

/** Curated style bundle per text role. Tailwind classes only — the role conveys
 *  hierarchy/emphasis; correct glyphs for any script come from the font stacks
 *  defined in the app's `styles.css`, which carry broad Unicode + CJK
 *  fallbacks. `audio` and `image` are interactive/media and rendered as
 *  components by the UI, so they are intentionally absent here. */
export const ROLE_STYLES: Record<Exclude<Role, 'audio' | 'image'>, string> = {
  heading: 'font-display text-5xl font-medium tracking-tight',
  subheading: 'font-display text-2xl',
  annotation: 'font-mono text-base text-muted-foreground',
  body: 'font-sans text-xl leading-relaxed',
  example: 'font-sans text-lg italic text-muted-foreground',
};

/** Roles whose HTML is produced here. `audio`/`image` are component-rendered. */
const TEXT_ROLES = new Set<Role>([
  'heading',
  'subheading',
  'annotation',
  'body',
  'example',
]);

export function isTextRole(role: Role): boolean {
  return TEXT_ROLES.has(role);
}

/** Render a single block to an HTML string, or `null` when the role is
 *  component-rendered (`audio`/`image`) and the UI should handle it directly.
 *  Field values are reduced to the constrained `stripHtml` subset (text + <br>,
 *  no markup/audio markers) before styling, so note content can never inject
 *  markup through a curated block. A `raw` block instead substitutes the
 *  cleaned value into the author's `{{value}}` placeholder and sanitises the
 *  result. */
export function renderBlockHtml(
  block: Block,
  fields: Record<string, string>
): string | null {
  const value = stripHtml(fields[block.field] ?? '');

  if (block.raw !== undefined) {
    const filled = block.raw.replace(/\{\{\s*value\s*\}\}/g, value);
    return sanitizeHtml(filled);
  }

  if (!isTextRole(block.role)) return null;
  if (value.length === 0) return '';

  const cls = ROLE_STYLES[block.role as Exclude<Role, 'audio' | 'image'>];
  return `<div class="${cls}">${value}</div>`;
}

/** Render a whole side to a single HTML string (used where component rendering
 *  isn't needed, e.g. simple previews). Component roles are skipped. */
export function renderSideHtml(
  blocks: Block[],
  fields: Record<string, string>
): string {
  return blocks
    .map((b) => renderBlockHtml(b, fields))
    .filter((html): html is string => html !== null && html.length > 0)
    .join('');
}

/** Heuristic starting layout so the builder never opens on a blank canvas:
 *  first field becomes the front `heading`; remaining fields go on the back,
 *  matched to `audio`/`image` by name or defaulting to `body`. */
export function seedLayout(fieldNames: string[]): Layout {
  const block = (field: string, role: Role): Block => ({
    id: `${role}:${field}`,
    field,
    role,
  });

  const roleFor = (field: string): Role => {
    if (/audio|sound/i.test(field)) return 'audio';
    if (/image|picture|photo|pic\b/i.test(field)) return 'image';
    return 'body';
  };

  const [first, ...rest] = fieldNames;
  return {
    front: first ? [block(first, 'heading')] : [],
    back: rest.map((f) => block(f, roleFor(f))),
  };
}

/** The note-type fields a card-template side references, in first-appearance
 *  order. Scans Mustache tags, stripping section markers (`#`/`^`/`/`) and
 *  field modifiers (`text:`, `hint:`, `furigana:`, …) down to the bare name,
 *  then keeps only real fields — so `{{FrontSide}}`, `{{Tags}}`, `{{Type}}` and
 *  the like fall away by not being in the field list. */
function referencedFields(html: string, fieldNames: string[]): string[] {
  const known = new Set(fieldNames);
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /\{\{([^}]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    let token = m[1]
      .trim()
      .replace(/^[#^/]/, '')
      .trim();
    const colon = token.lastIndexOf(':');
    if (colon !== -1) token = token.slice(colon + 1).trim();
    if (known.has(token) && !seen.has(token)) {
      seen.add(token);
      out.push(token);
    }
  }
  return out;
}

/** Seed a layout from a real Anki card template's Front/Back HTML by recovering
 *  which fields each side references — used to fill an unauthored direction from
 *  what the user configured in Anki (e.g. a "reversed" card's own front/back).
 *  Only field *placement* is imported; styling comes from the app's roles.
 *  `roleHints` reuses the role a field already carries in an authored direction
 *  so a field looks the same across directions; otherwise the first front field
 *  becomes the `heading` and the rest fall back by name (audio/image/body). */
export function extractLayoutFromCardTemplate(
  frontHtml: string,
  backHtml: string,
  fieldNames: string[],
  roleHints: Record<string, Role> = {}
): Layout {
  const autoRole = (field: string): Role => {
    if (/audio|sound/i.test(field)) return 'audio';
    if (/image|picture|photo|pic\b/i.test(field)) return 'image';
    return 'body';
  };
  const toBlocks = (names: string[], isFront: boolean): Block[] =>
    names.map((field, i) => {
      const role =
        roleHints[field] ?? (isFront && i === 0 ? 'heading' : autoRole(field));
      return { id: `${role}:${field}`, field, role };
    });

  return {
    front: toBlocks(referencedFields(frontHtml, fieldNames), true),
    back: toBlocks(referencedFields(backHtml, fieldNames), false),
  };
}
