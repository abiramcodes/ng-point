import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-login-page',
  styleUrl: './login-page.css',
  templateUrl: './login-page.html',
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
