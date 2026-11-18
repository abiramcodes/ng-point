import { Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { SubmitButtonComponent } from '../orders/submit-button.component';
import { HighlightDirective } from '../highlight.directive';

interface OrderRow {
  id: string;
  customer: string;
  paid: boolean;
  total: string;
}

@Component({
  imports: [NgClass, SubmitButtonComponent, HighlightDirective],
  selector: 'app-orders-page',
  styleUrl: './orders-page.css',
  templateUrl: './orders-page.html',
})
export class OrdersPage {
  protected readonly lastAction = signal('');

  protected readonly orders: OrderRow[] = [
    { id: '#1042', customer: 'ann@example.com', paid: true, total: '$129.00' },
    { id: '#1043', customer: 'jules@example.com', paid: false, total: '$89.50' },
    { id: '#1044', customer: 'kim@example.com', paid: true, total: '$342.75' },
  ];

  protected approve(): void {
    this.lastAction.set('approved');
  }

  protected reject(): void {
    this.lastAction.set('rejected');
  }

  protected export(): void {
    this.lastAction.set('exported');
  }
}
