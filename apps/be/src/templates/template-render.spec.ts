import { describe, expect, it } from 'vitest';
import {
  extractLayoutFromCardTemplate,
  renderBlockHtml,
  sanitizeHtml,
  seedLayout,
  type Block,
} from '@nts/shared';

describe('extractLayoutFromCardTemplate', () => {
  const fields = ['Korean', 'English', 'Audio', 'Example'];

  it('recovers front/back field placement from a reversed card template', () => {
    const layout = extractLayoutFromCardTemplate(
      '{{English}}',
      '{{FrontSide}}<hr id=answer>{{Korean}}\n{{Audio}}',
      fields,
    );
    expect(layout.front.map((b) => b.field)).toEqual(['English']);
    expect(layout.back.map((b) => b.field)).toEqual(['Korean', 'Audio']);
    // First front field becomes the heading; audio detected by name.
    expect(layout.front[0].role).toBe('heading');
    expect(layout.back[1].role).toBe('audio');
  });

  it('ignores non-field tokens, modifiers, and section markers', () => {
    const layout = extractLayoutFromCardTemplate(
      '{{#Korean}}{{text:Korean}}{{/Korean}}{{Tags}}{{FrontSide}}',
      '{{hint:Example}}',
      fields,
    );
    // Korean appears once despite the conditional + modifier; Tags/FrontSide drop.
    expect(layout.front.map((b) => b.field)).toEqual(['Korean']);
    expect(layout.back.map((b) => b.field)).toEqual(['Example']);
  });

  it('reuses role hints so a field looks the same across directions', () => {
    const layout = extractLayoutFromCardTemplate(
      '{{English}}',
      '{{Korean}}',
      fields,
      {
        English: 'subheading',
        Korean: 'heading',
      },
    );
    expect(layout.front[0].role).toBe('subheading');
    expect(layout.back[0].role).toBe('heading');
  });
});

describe('seedLayout', () => {
  it('puts the first field on the front as a heading', () => {
    const layout = seedLayout(['Word', 'Meaning']);
    expect(layout.front).toEqual([
      { id: 'heading:Word', field: 'Word', role: 'heading' },
    ]);
    expect(layout.back).toEqual([
      { id: 'body:Meaning', field: 'Meaning', role: 'body' },
    ]);
  });

  it('matches audio and image fields by name', () => {
    const layout = seedLayout(['Term', 'Sound', 'Picture']);
    const roles = layout.back.map((b) => b.role);
    expect(roles).toEqual(['audio', 'image']);
  });

  it('handles an empty field list', () => {
    expect(seedLayout([])).toEqual({ front: [], back: [] });
  });
});

describe('sanitizeHtml', () => {
  it('drops script tags and their contents', () => {
    expect(sanitizeHtml('<b>hi</b><script>alert(1)</script>')).toBe(
      '<b>hi</b>',
    );
  });

  it('strips inline event handlers', () => {
    expect(sanitizeHtml('<div onclick="evil()">x</div>')).toBe('<div>x</div>');
  });

  it('neutralises javascript: urls but keeps the tag', () => {
    expect(sanitizeHtml('<a href="javascript:evil()">x</a>')).toBe(
      '<a href="#">x</a>',
    );
  });

  it('preserves inline styles and style blocks', () => {
    const html = '<style>.c{color:red}</style><div style="color:blue">x</div>';
    expect(sanitizeHtml(html)).toBe(html);
  });
});

describe('renderBlockHtml', () => {
  const block = (over: Partial<Block>): Block => ({
    id: 'b',
    field: 'Word',
    role: 'body',
    ...over,
  });

  it('wraps a text role in its style bundle', () => {
    const html = renderBlockHtml(block({ role: 'heading' }), { Word: '안녕' });
    expect(html).toContain('font-display');
    expect(html).toContain('안녕');
  });

  it('returns null for component-rendered roles', () => {
    expect(renderBlockHtml(block({ role: 'audio' }), { Word: 'x' })).toBeNull();
    expect(renderBlockHtml(block({ role: 'image' }), { Word: 'x' })).toBeNull();
  });

  it('returns empty string for an empty field value', () => {
    expect(renderBlockHtml(block({}), { Word: '' })).toBe('');
  });

  it('substitutes {{value}} into raw HTML and sanitises it', () => {
    const html = renderBlockHtml(
      block({ raw: '<span onclick="x()">{{value}}</span>' }),
      { Word: 'hi' },
    );
    expect(html).toBe('<span>hi</span>');
  });
});
