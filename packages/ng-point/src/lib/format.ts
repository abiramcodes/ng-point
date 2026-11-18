import type { NgPointContext } from './types';

/** Collapses all whitespace runs in an instruction to single spaces. */
export function collapseInstruction(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function fileRef(file: string, line?: number): string {
  return line ? `${file}:${line}` : file;
}

/**
 * Formats one selection into the concise, labeled context block:
 *
 * Component: SubmitButtonComponent
 * File: src/app/submit-button/submit-button.component.ts:42
 * Template: src/app/submit-button/submit-button.component.html:7
 * Element: <button class="submit-btn">Save</button>
 * Directives: RouterLink, NgClass
 * Parent: FormComponent (src/app/form/form.component.ts:18)
 * Instruction: make this disabled when form is invalid
 * Note: sensitive values redacted
 */
export function formatBlock(
  context: NgPointContext,
  instruction: string,
  includeTemplateLine = true,
): string {
  const lines: string[] = [];
  const component = context.component;

  lines.push(`Component: ${component?.name ?? '(no component found)'}`);
  if (component?.file) {
    lines.push(`File: ${fileRef(component.file, component.line)}`);
  } else if (component) {
    lines.push('File: (source location unavailable)');
  }
  if (includeTemplateLine && context.template) {
    lines.push(`Template: ${fileRef(context.template.path, context.template.line)}`);
  }
  if (context.element) {
    lines.push(`Element: ${context.element}`);
  }
  if (context.directives.length > 0) {
    lines.push(`Directives: ${context.directives.join(', ')}`);
  }
  if (context.parent) {
    const location = context.parent.file ? ` (${fileRef(context.parent.file, context.parent.line)})` : '';
    lines.push(`Parent: ${context.parent.name}${location}`);
  }
  const instructionText = collapseInstruction(instruction);
  if (instructionText) {
    lines.push(`Instruction: ${instructionText}`);
  }
  if (context.sensitive || context.redacted) {
    lines.push('Note: sensitive values redacted');
  }
  return lines.join('\n');
}

/** Joins multiple context blocks with the `---` separator (LLM-friendly, deterministic). */
export function assembleBlocks(blocks: string[]): string {
  return blocks.join('\n\n---\n\n');
}
