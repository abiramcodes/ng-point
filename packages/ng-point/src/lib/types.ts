/** Component class info resolved from Angular's dev-mode debug metadata. */
export interface ComponentInfo {
  name: string;
  file?: string;
  line?: number;
}

/** Template source location parsed from the `data-ng-source-location` attribute. */
export interface TemplateInfo {
  path: string;
  line: number;
}

/**
 * Fully materialized context for one picked element.
 * Everything is captured up front so the DOM element never needs to be retained.
 */
export interface NgPointContext {
  component: ComponentInfo | null;
  directives: string[];
  element: string;
  parent: ComponentInfo | null;
  template: TemplateInfo | null;
  sensitive: boolean;
  redacted: boolean;
}

/** One entry of the recent-selections queue. */
export interface NgPointQueueEntry {
  id: string;
  /** ISO 8601 timestamp. */
  capturedAt: string;
  component: string;
  file: string;
  template?: string;
  element: string;
  directives: string[];
  parent?: string;
  instruction: string;
  /** The final, user-reviewed context block exactly as it was copied to the clipboard. */
  block: string;
}
