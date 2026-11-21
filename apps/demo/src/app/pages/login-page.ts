import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-login-page',
  styles: `
    form {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-width: 360px;
      margin-block-end: 16px;
    }

    form button {
      margin-block-start: 10px;
    }

    .token-display {
      padding: 8px;
      border: 1px dashed #d0a020;
      border-radius: 8px;
      background: #fffaf0;
      overflow-wrap: anywhere;
    }

    .token-display code {
      font-size: 12px;
    }

    .hint {
      color: #66667a;
      font-size: 13px;
    }
  `,
  template: `
    <article class="card">
      <h1>Sign in</h1>
      <p class="lede">
        A login form with a password field. Alt+Click it: ng-point captures the element context but
        never its typed value.
      </p>

      <form (submit)="onSubmit($event)">
        <label for="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autocomplete="email"
          placeholder="dev@example.com"
          required
        />

        <label for="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autocomplete="current-password"
          placeholder="••••••••"
          required
        />

        <button type="submit" class="btn btn-primary">Sign in</button>
      </form>

      @if (fakeSessionToken()) {
        <p class="token-display">
          Fake session token:
          <code>{{ fakeSessionToken() }}</code>
        </p>
        <p class="hint">
          Alt+Click the paragraph above — the JWT shape is redacted at capture time, before anything
          reaches the clipboard or the queue.
        </p>
      }
    </article>
  `,
})
export class LoginPage {
  protected readonly fakeSessionToken = signal('');

  protected onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    // Fake authentication: renders a secret-looking token so developers can
    // verify that ng-point redacts it from captured text.
    this.fakeSessionToken.set(
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkZXYtNDEyIiwicm9sZSI6ImFkbWluIn0.aGF6el9sZWNyZXRfdG9rZW5fMTIzNDU2Nzg',
    );
  }
}
