import { Component, input, output } from '@angular/core';

/**
 * Standalone child component with an EXTERNAL template — demonstrates the
 * `Template:` line in ng-point context blocks
 * (requires `enableTemplateSourceLocations` in the dev tsconfig).
 */
@Component({
  selector: 'app-submit-button',
  styleUrl: './submit-button.component.css',
  templateUrl: './submit-button.component.html',
})
export class SubmitButtonComponent {
  readonly label = input('Submit');
  readonly clicked = output<void>();
}
