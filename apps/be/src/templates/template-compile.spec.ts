import { describe, expect, it } from 'vitest';
import { compileLayoutToAnki, seedLayout, type Layout } from '@nts/shared';

describe('compileLayoutToAnki', () => {
  const layout = seedLayout(['Word', 'Meaning']);

  it('emits one card template named after the existing Anki template', () => {
    const { cardTemplates } = compileLayoutToAnki(layout, undefined, 'Card 1');
    expect(cardTemplates).toHaveLength(1);
    expect(cardTemplates[0].Name).toBe('Card 1');
  });

  it('renders front blocks as role-classed, conditional field references', () => {
    const { cardTemplates } = compileLayoutToAnki(layout, undefined);
    expect(cardTemplates[0].Front).toBe(
      '{{#Word}}<div class="blk role-heading">{{Word}}</div>{{/Word}}',
    );
  });

  it('mirrors the app: the back shows back blocks only (no FrontSide repeat)', () => {
    const { cardTemplates } = compileLayoutToAnki(layout, undefined);
    expect(cardTemplates[0].Back).toBe(
      '{{#Meaning}}<div class="blk role-body">{{Meaning}}</div>{{/Meaning}}',
    );
    expect(cardTemplates[0].Back).not.toContain('FrontSide');
  });

  it('leads the CSS with the Google Fonts @import and includes role rules', () => {
    const { css } = compileLayoutToAnki(layout, undefined);
    expect(css.startsWith('@import url(')).toBe(true);
    expect(css).toContain('.card .role-heading{');
    expect(css).toContain('Fraunces');
  });

  it('audio/image blocks emit the field verbatim for Anki-native rendering', () => {
    const media = seedLayout(['Term', 'Sound', 'Picture']);
    const { cardTemplates } = compileLayoutToAnki(media, undefined);
    expect(cardTemplates[0].Back).toContain(
      '<div class="blk role-audio">{{Sound}}</div>',
    );
    expect(cardTemplates[0].Back).toContain(
      '<div class="blk role-image">{{Picture}}</div>',
    );
  });

  it('maps a raw block’s {{value}} onto the live field and sanitises it', () => {
    const raw: Layout = {
      front: [
        {
          id: 'r',
          field: 'Word',
          role: 'body',
          raw: '<span onclick="x()">{{value}}</span>',
        },
      ],
      back: [],
    };
    const { cardTemplates } = compileLayoutToAnki(raw, undefined);
    expect(cardTemplates[0].Front).toBe(
      '{{#Word}}<div class="blk"><span>{{Word}}</span></div>{{/Word}}',
    );
  });

  it('appends sanitised custom CSS after the generated rules', () => {
    const { css } = compileLayoutToAnki(
      layout,
      '.card{background:black}<script>evil()</script>',
    );
    expect(css).toContain('.card{background:black}');
    expect(css).not.toContain('<script>');
  });
});
