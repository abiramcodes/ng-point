import { Component } from '@angular/core';
import { NgPointIgnoreDirective } from '@abiramcodes/ng-point';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgPointIgnoreDirective],
  selector: 'app-root',
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .skip-link {
      position: absolute;
      inset-block-start: -48px;
      inset-inline-start: 8px;
      z-index: 100;
      padding: 8px 16px;
      border-radius: 6px;
      background: #1c1c24;
      color: #ffffff;
      transition: inset-block-start 120ms ease;
    }

    .skip-link:focus {
      inset-block-start: 8px;
    }

    .app-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 24px;
      border-block-end: 1px solid #e3e3ea;
    }

    .app-brand {
      margin: 0;
      font-weight: 700;
    }

    .app-nav {
      display: flex;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .app-nav a {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 6px;
      color: #2b2b3a;
      text-decoration: none;
    }

    .app-nav a:hover,
    .app-nav a:focus-visible,
    .app-nav a.active {
      background: #eef1ff;
      color: #2f5fd0;
    }

    .app-main {
      flex: 1 1 auto;
      width: 100%;
      max-width: 880px;
      margin-inline: auto;
      padding: 24px;
    }

    .app-footer {
      padding: 12px 24px;
      border-block-start: 1px solid #e3e3ea;
      color: #66667a;
      font-size: 13px;
    }

    .app-footer p {
      margin: 0;
    }

    .app-footer p + p {
      margin-block-start: 6px;
    }
  `,
  template: `
    <a class="skip-link" href="#main-content">Skip to main content</a>

    <header class="app-header">
      <p class="app-brand">ng-point demo</p>
      <nav aria-label="Primary">
        <ul class="app-nav">
          <li>
            <a routerLink="/login" routerLinkActive="active" [ariaCurrentWhenActive]="'page'">
              Login
            </a>
          </li>
          <li>
            <a routerLink="/orders" routerLinkActive="active" [ariaCurrentWhenActive]="'page'">
              Orders
            </a>
          </li>
          <li>
            <a routerLink="/settings" routerLinkActive="active" [ariaCurrentWhenActive]="'page'">
              Settings
            </a>
          </li>
        </ul>
      </nav>
    </header>

    <main id="main-content" class="app-main">
      <router-outlet />
    </main>

    <footer class="app-footer">
      <p>
        Dev-mode only: Alt+Click any element to capture its context. Alt+Shift+Click adds more
        elements (up to 5), Alt+↑/↓ retargets, Enter copies &amp; queues, Esc discards.
      </p>
      <p ngPointIgnore>
        This paragraph opts out of picking with <code>ngPointIgnore</code> — Alt+Click it and
        nothing happens.
      </p>
    </footer>
  `,
})
export class App {}
