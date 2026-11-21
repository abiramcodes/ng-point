import { Component, input, output } from '@angular/core';

/**
 * Standalone child component — demonstrates the `Template:` line in ng-point
 * context blocks (requires `enableTemplateSourceLocations` in the dev tsconfig;
 * with an inline template the reported location points into this file).
 */
@Component({
  selector: 'app-submit-button',
  styles: `
    :host {
      display: inline-block;
    }
  `,
  template: `
    <button type="button" class="btn btn-primary" (click)="clicked.emit()">{{ label() }}</button>
  `,
})
export class SubmitButtonComponent {
  readonly label = input('Submit');
  readonly clicked = output<void>();
}
