import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, beforeEach } from 'vitest';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    });
  });

  it('renders the app shell with primary navigation and a main landmark', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('main')).toBeTruthy();
    expect(el.querySelector('header nav[aria-label="Primary"]')).toBeTruthy();
    const links = el.querySelectorAll('header nav a');
    expect(links.length).toBe(3);
    expect(links[0].textContent?.trim()).toBe('Login');
    expect(links[1].textContent?.trim()).toBe('Orders');
    expect(links[2].textContent?.trim()).toBe('Settings');
  });

  it('includes a skip link targeting the main content', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const skip = el.querySelector<HTMLAnchorElement>('.skip-link');
    expect(skip).toBeTruthy();
    expect(skip?.getAttribute('href')).toBe('#main-content');
    expect(el.querySelector('#main-content')).toBeTruthy();
  });
});
