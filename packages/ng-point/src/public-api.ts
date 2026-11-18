/**
 * ng-point — dev-mode-only element context picker for Angular applications.
 *
 * Alt+Click any element in your running dev app to capture an LLM-ready
 * context block (component, file:line, template, cleaned HTML, directives,
 * parent component). Enter copies it to the clipboard and queues it; a local
 * MCP server (`ng-point-mcp`) exposes the recent queue to AI coding agents.
 */
export { provideNgPoint } from './lib/provide-ng-point';
export { NG_POINT_CONFIG } from './lib/config';
export type { NgPointConfig } from './lib/config';
export type { NgPointQueueEntry } from './lib/types';
