import { Directive, HostBinding, HostListener } from '@angular/core';

/** Demo custom directive — shows up in the `Directives:` line of ng-point blocks. */
@Directive({ selector: '[appHighlight]' })
export class HighlightDirective {
  @HostBinding('class.demo-highlighted')
  protected highlighted = false;

  @HostListener('mouseenter')
  protected onEnter(): void {
    this.highlighted = true;
  }

  @HostListener('mouseleave')
  protected onLeave(): void {
    this.highlighted = false;
  }
}
