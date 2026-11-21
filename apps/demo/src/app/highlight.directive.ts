import { Directive } from '@angular/core';

/** Demo custom directive — shows up in the `Directives:` line of ng-point blocks. */
@Directive({
  selector: '[appHighlight]',
  host: {
    '[class.demo-highlighted]': 'highlighted',
    '(mouseenter)': 'onEnter()',
    '(mouseleave)': 'onLeave()',
  },
})
export class HighlightDirective {
  protected highlighted = false;

  protected onEnter(): void {
    this.highlighted = true;
  }

  protected onLeave(): void {
    this.highlighted = false;
  }
}
