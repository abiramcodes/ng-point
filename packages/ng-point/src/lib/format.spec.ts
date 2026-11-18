import { describe, expect, it } from 'vitest';
import { assembleBlocks, collapseInstruction, formatBlock } from './format';
import type { NgPointContext } from './types';

function context(overrides: Partial<NgPointContext> = {}): NgPointContext {
  return {
    component: {
      name: 'SubmitButtonComponent',
      file: 'src/app/submit-button/submit-button.component.ts',
      line: 42,
    },
    directives: ['RouterLink', 'NgClass'],
    element: '<button class="submit-btn">Save</button>',
    parent: { name: 'FormComponent', file: 'src/app/form/form.component.ts', line: 18 },
    template: { path: 'src/app/submit-button/submit-button.component.html', line: 7 },
    sensitive: false,
    redacted: false,
    ...overrides,
  };
}

describe('formatBlock', () => {
  it('formats the exact required output', () => {
    const block = formatBlock(context(), 'make this disabled when form is invalid');
    expect(block).toBe(
      [
        'Component: SubmitButtonComponent',
        'File: src/app/submit-button/submit-button.component.ts:42',
        'Template: src/app/submit-button/submit-button.component.html:7',
        'Element: <button class="submit-btn">Save</button>',
        'Directives: RouterLink, NgClass',
        'Parent: FormComponent (src/app/form/form.component.ts:18)',
        'Instruction: make this disabled when form is invalid',
      ].join('\n'),
    );
  });

  it('omits Template/Directives/Parent/Instruction when absent', () => {
    const block = formatBlock(
      context({ template: null, directives: [], parent: null, sensitive: false }),
      '',
    );
    expect(block).toBe(
      [
        'Component: SubmitButtonComponent',
        'File: src/app/submit-button/submit-button.component.ts:42',
        'Element: <button class="submit-btn">Save</button>',
      ].join('\n'),
    );
  });

  it('labels library components without source locations', () => {
    const block = formatBlock(context({ component: { name: 'LibWidget' } }), '');
    expect(block).toContain('Component: LibWidget');
    expect(block).toContain('File: (source location unavailable)');
  });

  it('handles selections with no component at all', () => {
    const block = formatBlock(context({ component: null }), '');
    expect(block.startsWith('Component: (no component found)')).toBe(true);
    expect(block).not.toContain('File:');
  });

  it('adds the redaction note exactly when redaction fired', () => {
    expect(formatBlock(context({ sensitive: true }), '')).toContain(
      'Note: sensitive values redacted',
    );
    expect(formatBlock(context({ redacted: true }), '')).toContain(
      'Note: sensitive values redacted',
    );
    expect(formatBlock(context(), '')).not.toContain('Note:');
  });

  it('collapses multiline instructions into one line', () => {
    const block = formatBlock(context(), 'make   this\n\n  disabled');
    expect(block).toContain('Instruction: make this disabled');
  });

  it('formats parents without file info without parens', () => {
    expect(formatBlock(context({ parent: { name: 'FormComponent' } }), '')).toContain(
      'Parent: FormComponent',
    );
  });

  it('can drop the Template line via includeTemplateLine', () => {
    const withLine = formatBlock(context(), '');
    const withoutLine = formatBlock(context(), '', false);
    expect(withLine).toContain('Template:');
    expect(withoutLine).not.toContain('Template:');
  });
});

describe('assembleBlocks', () => {
  it('joins multiple blocks with the --- separator', () => {
    expect(assembleBlocks(['a', 'b', 'c'])).toBe('a\n\n---\n\nb\n\n---\n\nc');
  });

  it('returns the single block untouched', () => {
    expect(assembleBlocks(['only'])).toBe('only');
  });
});

describe('collapseInstruction', () => {
  it('squashes all whitespace runs', () => {
    expect(collapseInstruction('  fix   this\n\tbutton  ')).toBe('fix this button');
  });
});
