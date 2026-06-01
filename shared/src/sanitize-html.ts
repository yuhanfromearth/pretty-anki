/** Best-effort HTML sanitiser for the Template builder's raw escape hatch.
 *
 *  The raw block and per-Template custom CSS deliberately allow arbitrary HTML
 *  and CSS (that is the whole point of the escape hatch). We only strip code
 *  *execution*: scripts, inline event handlers, and dangerous URL schemes.
 *  Presentation — tags, inline `style`, `<style>` blocks — is preserved.
 *
 *  Threat model is mild: this is a single-user local tool and the raw template
 *  is authored by the user, not pulled from shared note data (note *values* go
 *  through the curated role renderer, never here). This regex pass is therefore
 *  good enough; it is not a substitute for a DOM-based sanitiser against
 *  hostile input. Kept dependency-free and pure so both apps share one
 *  implementation, matching the spirit of `card-html.ts`. */

/** Escape a field value for safe interpolation into raw HTML's `{{value}}`. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strip script execution from author HTML/CSS while preserving styling. */
export function sanitizeHtml(html: string): string {
  return (
    html
      // Drop <script> entirely, including its contents.
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      // Drop <script> with no closing tag.
      .replace(/<script[^>]*>/gi, '')
      // Strip inline event handlers: on*="..." | on*='...' | on*=unquoted.
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
      .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
      // Neutralise dangerous URL schemes in any attribute value.
      .replace(
        /(href|src|xlink:href)\s*=\s*"\s*(?:javascript|data|vbscript):[^"]*"/gi,
        '$1="#"'
      )
      .replace(
        /(href|src|xlink:href)\s*=\s*'\s*(?:javascript|data|vbscript):[^']*'/gi,
        "$1='#'"
      )
      // Drop CSS expression() (legacy IE script vector) and url(javascript:).
      .replace(/expression\s*\(/gi, 'void(')
      .replace(
        /url\s*\(\s*(?:["']?)\s*(?:javascript|vbscript):[^)]*\)/gi,
        'url()'
      )
  );
}
