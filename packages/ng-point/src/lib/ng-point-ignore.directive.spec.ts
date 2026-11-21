import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import {
  firstUnignoredAncestor,
  firstUnignoredChild,
  isNgPointIgnored,
  NgPointIgnoreDirective,
} from './ng-point-ignore.directive';

@Component({
  imports: [NgPointIgnoreDirective],
  selector: 'lib-ignore-host',
  template: `
    <div id="static" ngPointIgnore><span id="static-child">x</span></div>
    <div id="off" [ngPointIgnore]="false">y</div>
    <div id="on" [ngPointIgnore]="true">z</div>
  `,
})
class HostComponent {}

describe('NgPointIgnoreDirective', () => {
  it('marks the host and its whole subtree for static usage', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const host = document.getElementById('static')!;
    const child = document.getElementById('static-child')!;
    expect(host.hasAttribute('data-ng-point-ignore')).toBe(true);
    expect(isNgPointIgnored(host)).toBe(true);
    expect(isNgPointIgnored(child)).toBe(true);
  });

  it('re-enables picking when bound false, marks again when bound true', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const off = document.getElementById('off')!;
    const on = document.getElementById('on')!;
    expect(off.hasAttribute('data-ng-point-ignore')).toBe(false);
    expect(isNgPointIgnored(off)).toBe(false);
    expect(on.hasAttribute('data-ng-point-ignore')).toBe(true);
    expect(isNgPointIgnored(on)).toBe(true);
  });
});

describe('isNgPointIgnored (plain DOM, directive import not required)', () => {
  it('honors a plain ng-point-ignore template attribute and its subtree', () => {
    const zone = document.createElement('div');
    zone.setAttribute('ng-point-ignore', '');
    const child = document.createElement('button');
    zone.appendChild(child);

    expect(isNgPointIgnored(zone)).toBe(true);
    expect(isNgPointIgnored(child)).toBe(true);
  });

  it('returns false outside ignore zones and for null', () => {
    expect(isNgPointIgnored(document.createElement('div'))).toBe(false);
    expect(isNgPointIgnored(null)).toBe(false);
  });
});

describe('ignore-aware tree walks (retargeting)', () => {
  it('firstUnignoredAncestor skips entire zones, not just the marked element', () => {
    const outer = document.createElement('section');
    const zone = document.createElement('div');
    zone.setAttribute('data-ng-point-ignore', '');
    const inner = document.createElement('button');
    zone.appendChild(inner);
    outer.appendChild(zone);

    expect(firstUnignoredAncestor(inner)).toBe(outer);
    expect(firstUnignoredAncestor(zone)).toBe(outer);
  });

  it('firstUnignoredChild skips ignored children and lands on the next real one', () => {
    const outer = document.createElement('section');
    const zone = document.createElement('div');
    zone.setAttribute('ng-point-ignore', '');
    const ok = document.createElement('p');
    outer.append(zone, ok);

    expect(firstUnignoredChild(outer)).toBe(ok);
  });

  it('walks return null when the whole neighborhood is ignored or absent', () => {
    const zone = document.createElement('div');
    zone.setAttribute('data-ng-point-ignore', '');
    const inner = document.createElement('button');
    zone.appendChild(inner);
    const outer = document.createElement('section');
    outer.appendChild(zone);

    expect(firstUnignoredChild(zone)).toBe(null);
    expect(firstUnignoredChild(inner)).toBe(null);
    expect(firstUnignoredAncestor(inner)).toBe(outer);
  });
});
