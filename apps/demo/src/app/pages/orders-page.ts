import { Component, signal } from '@angular/core';
import { SubmitButtonComponent } from '../orders/submit-button.component';
import { HighlightDirective } from '../highlight.directive';

interface OrderRow {
  id: string;
  customer: string;
  paid: boolean;
  total: string;
}

@Component({
  imports: [SubmitButtonComponent, HighlightDirective],
  selector: 'app-orders-page',
  styles: `
    .toolbar {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-block-end: 16px;
    }

    .orders-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    .orders-table th,
    .orders-table td {
      padding: 8px;
      border-block-end: 1px solid #e3e3ea;
      text-align: start;
    }

    .orders-table tr.demo-highlighted {
      background: #f2f6ff;
    }

    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-block-start: 16px;
    }

    .actions app-submit-button {
      display: inline-block;
    }

    .hint {
      color: #66667a;
      font-size: 13px;
    }
  `,
  template: `
    <article class="card">
      <h1>Orders</h1>
      <p class="lede">
        Multi-selection demo: Alt+Click <strong>Approve selected</strong>, then Alt+Shift+Click
        <strong>Reject selected</strong> and the <strong>search input</strong>. Each becomes its own
        full context block with its own instruction — one Enter commits all of them.
      </p>

      <div class="toolbar">
        <label for="search">Search orders</label>
        <input id="search" name="search" type="search" placeholder="order id, customer…" />
      </div>

      <table class="orders-table">
        <caption>
          Recent orders
        </caption>
        <thead>
          <tr>
            <th scope="col">Order</th>
            <th scope="col">Customer</th>
            <th scope="col">Status</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          @for (order of orders; track order.id) {
            <tr appHighlight>
              <td>{{ order.id }}</td>
              <td>{{ order.customer }}</td>
              <td>
                <span class="pill" [class.pill-paid]="order.paid" [class.pill-due]="!order.paid">
                  {{ order.paid ? 'Paid' : 'Due' }}
                </span>
              </td>
              <td>{{ order.total }}</td>
            </tr>
          }
        </tbody>
      </table>

      <div class="actions">
        <app-submit-button label="Approve selected" (clicked)="approve()" />
        <button type="button" class="btn btn-danger" (click)="reject()">Reject selected</button>
        <app-submit-button label="Export CSV" (clicked)="export()" />
      </div>

      @if (lastAction()) {
        <p class="hint" role="status">Action: {{ lastAction() }}</p>
      }
    </article>
  `,
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
