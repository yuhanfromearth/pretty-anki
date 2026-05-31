/**
 * Anki stores `<img src="filename.jpg">` as bare collection-media filenames.
 * The browser can't load those directly, so we rewrite them through the
 * backend media proxy when loading into the editor, and strip the prefix back
 * off before saving so Anki keeps storing bare filenames.
 */
const MEDIA_PREFIX = '/api/anki/media/';

const IMG_SRC = /(<img\b[^>]*?\bsrc=")([^"]*)(")/gi;

function isAlreadyResolvable(src: string): boolean {
  return /^(https?:|data:|\/)/i.test(src);
}

/** Anki field HTML → HTML the editor can render (media made loadable). */
export function ankiToEditorHtml(html: string): string {
  return html.replace(IMG_SRC, (match, pre, src, post) => {
    if (isAlreadyResolvable(src)) return match;
    return `${pre}${MEDIA_PREFIX}${encodeURIComponent(src)}${post}`;
  });
}

/** Editor HTML → Anki field HTML (proxy prefix removed from media). */
export function editorToAnkiHtml(html: string): string {
  return html.replace(IMG_SRC, (match, pre, src, post) => {
    if (!src.startsWith(MEDIA_PREFIX)) return match;
    return `${pre}${decodeURIComponent(src.slice(MEDIA_PREFIX.length))}${post}`;
  });
}

/** Plain-text preview of a field for list rows: strips tags, media, audio. */
export function fieldToPlainText(html: string): string {
  return html
    .replace(/\[sound:[^\]]+\]/g, '')
    .replace(/<img\b[^>]*>/gi, '🖼')
    .replace(/<br\s*\/?>(?=\S)/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Heuristic: does this text contain Hangul/Hanja (for font-korean)? */
export function hasCJK(text: string): boolean {
  return /[ᄀ-ᇿ㄰-㆏가-힯一-鿿]/.test(text);
}
