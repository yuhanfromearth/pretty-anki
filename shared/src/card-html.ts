/** Card field HTML helpers shared by the backend (rendering review cards from
 *  AnkiConnect output) and the UI (rendering the manage-page card preview from
 *  live field values). Keeping one implementation guarantees the preview matches
 *  what review actually shows. */

/** Pull `[sound:...]` filenames out of a field's HTML, in order. */
export function extractAudio(html: string): string[] {
  const matches = [...html.matchAll(/\[sound:([^\]]+)]/g)];
  return matches.map((m) => m[1]);
}

/** Reduce card/field HTML to the constrained subset the review card renders:
 *  plain text with `<br>` line breaks, no styling, scripts, images, audio
 *  markers, or Anki play placeholders. Blank lines left by stripped markup are
 *  collapsed so the card doesn't grow with empty `<br>`s. */
export function stripHtml(html: string): string {
  return (
    html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/\[sound:[^\]]+]/g, '')
      // Rendered cards emit `[anki:play:q:0]` / `[anki:play:a:0]` placeholders
      // where audio sits; we handle playback separately, so drop them.
      .replace(/\[anki:play:[^\]]+]/g, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
      // Rich-text editors (and Anki) separate lines with paragraphs rather than
      // <br>; treat every paragraph break as a newline so multi-line fields
      // don't collapse onto one line.
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\u00a0/g, ' ')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('<br>')
  );
}
