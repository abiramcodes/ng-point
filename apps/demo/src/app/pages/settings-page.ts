import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-settings-page',
  styles: `
    .secrets {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 6px 16px;
      margin-block: 0 16px;
      padding: 12px;
      border: 1px solid #e3e3ea;
      border-radius: 8px;
      background: #fafaff;
    }

    .secrets dt {
      font-weight: 600;
    }

    .secrets dd {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .secrets code {
      font-size: 12.5px;
    }
  `,
  template: `
    <article class="card">
      <h1>Settings</h1>
      <p class="lede">
        Secret-shaped values. Alt+Click any row below to watch ng-point redact them at capture time.
      </p>

      <dl class="secrets">
        <dt>API key</dt>
        <dd><code>sk_live_51H8xQ2eZvKYlo2CRaBcdEFGHIJKLMNOP</code></dd>
        <dt>Webhook signing secret</dt>
        <dd><code>whsec_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6</code></dd>
        <dt>AWS access key</dt>
        <dd><code>AKIAIOSFODNN7EXAMPLE</code></dd>
      </dl>

      <nav aria-label="Account">
        <a routerLink="/orders" class="btn">Back to orders</a>
      </nav>
    </article>
  `,
})
export class SettingsPage {}
