# PRD — ng-point landing page v2: quiet, animated, dual-theme

Status: **approved 2026-11-19** — decisions: docs CTA ships as a placeholder; explicit *text-only* theme
toggle; animation is a continuous loop with a pause control; smooth cubic-bezier easing throughout.
Follow-up (same day): content pivoted to the token-reduction story (point instead of pasting
screenshots); the 5-element multi-pick surfaced as one line; MCP removed from the landing (it
stays documented in the README); the animation was left unchanged.
Second follow-up: the pointing-hand cursor removed (the ring and Alt+Click badge carry the
pick); the loop is 8s and gains a completion beat — context pastes, "Fixing…" thinks, then
"Fixed ✓" lands — so the agent pane shows the whole job done.

## 1. Background

v1 shipped dark-only with a static pick-scene and four content sections (how, block demo,
guarantees, close). It works, but it makes a single-gesture product read like a four-screen
brochure, duplicates content that already lives in the repo READMEs, and dropped light mode.

## 2. Problem statement

1. A visitor must read ~4 screens to learn what the tool does; the product's value is one gesture:
   Alt+Click → agent-ready context.
2. Landing copy and README copy now overlap — two sources of truth that will drift.
3. Dark-only ignores light-preference users.
4. The static scene shows the *UI* but never the *workflow*: capture → hand to the agent.

## 3. Goals / non-goals

**Goals**

- One screen that explains the product in ≤5 seconds; the animation carries the explanation.
- All documentation content lives in the README; the landing links to it (the docs destination).
- Light + dark themes, automatic via `prefers-color-scheme`, no toggle UI.
- Reduced-motion, keyboard focus, contrast, and mobile all pass.

**Non-goals**

- No multi-page site, no theme toggle (unless you ask), no JS framework, no analytics, no sound.
- No new marketing copy beyond the hero; nothing invented; README stays the only docs surface.

## 4. Audience and their job

Angular developers who use AI coding agents. Their job on this page: understand "point at an
element, your agent gets the exact code" within 5 seconds, then either run
`npm i -D @abiramcodes/ng-point` (copy button on the page) or open the README.

## 5. Final page structure (single screen + footer)

| Zone | Content |
| --- | --- |
| Header | Logo mark + wordmark; right: a single **Docs** link (→ GitHub README; URL open question Q2) |
| Hero left | H1, one-line sub, install snippet with copy button, **Read the docs** CTA |
| Hero right | The workflow animation (spec in §6) |
| Footer | One line: two packages + MIT |

**Removed from the HTML entirely:** the how-steps section, the context-block demo, the guarantees
grid, the close section, and the header's in-page anchor nav (nothing left to anchor to).

**Word budget:** hero ≤ 45 words, footer ≤ 20 words. Everything else the current page teaches
moves to the README (§8).

## 6. Animation spec — the centerpiece

Replace the static pick-scene with a minimal, looping-free storyboard that shows the actual
product loop: an element in a webpage is captured and lands in an agent's prompt.

**Panes**

- **Pane A — webpage:** a very small app card (one heading line, two muted text lines, one
  primary button "Approve selected"). No table, no nav, no toolbar: v1's demo furniture is cut.
- **Pane B — agent harness:** a small dark prompt window: title bar, a mono input area, a caret.
- A dotted transfer path connects them.

**Storyboard (total ≈ 4.5 s, plays once on load)**

| Time | Phase | What happens |
| --- | --- | --- |
| 0.0–0.8 s | Point | The amber hand cursor drifts onto the Approve button |
| 0.8–1.4 s | Pick | Amber ring + halo flash on the button; a compact 3-line block card (Component / File / Element) pops beside it |
| 1.4–2.6 s | Copy | The block card collapses into a small "Copied" chip and slides along the dotted path to Pane B |
| 2.6–3.8 s | Paste | Block lines appear in the agent prompt, paste-like, ending on a blinking caret |
| 3.8–4.5 s | Rest | Final tableau holds; a quiet **Replay** control fades in |

**Motion rules** (per the `motion` guide from modern-web-guidance)

- Auto-playing content stays under 5 seconds and runs once, so no pause control is required; the
  Replay button re-runs the sequence on demand.
- `prefers-reduced-motion: reduce` → the animation never runs; the pane shows the **static final
  tableau** (block already pasted, caret static). Nothing is left hidden.
- Only `transform`/`opacity`/`scale` animate (compositor-only); no canvas, no WebGL, no JS
  timeline — pure CSS keyframes with a single animation-delay chain.
- The whole scene is `role="img"` with an `aria-label` describing the sequence; every moving part
  inside is `aria-hidden`.

## 7. Theming

- `color-scheme: light dark`; light tokens restored (v1-light values), dark tokens as shipped,
  switched by `@media (prefers-re-scheme: dark)`. No toggle (open question Q3).
- **Amber stays the "pointing" accent, theme-tuned:** dark keeps `#FFC53D` (≈10:1 on the dark
  ground); light mode uses a darker bronze for text/marks (target ≥ 4.5:1, e.g. `#8A6400`) with a
  brighter amber only for decorative fills (the hand, the ring). Exact values fixed during
  implementation review.
- Red `#DD0031` remains brand-only (logo dot, Angular identity).
- Pane B (agent harness) stays dark in both themes — terminals read dark; it also gives the light
  page its one dark moment.

## 8. Content migration — HTML → README.md

The README is canonical; nothing stays duplicated on the landing page.

| Removed from `site/index.html` | Destination |
| --- | --- |
| 3-step how (provider → Alt+Click → paste/MCP) | Root `README.md`: new "Quick tour" summary (packages README already has the detailed Usage) |
| Context block demo | Root `README.md`: new "The context block" section with the exact format example (matches the packages README spec) |
| Guarantees grid (dev-only, redaction, MCP, ngPointIgnore) | Root `README.md`: new "Guarantees" bullet list, one line each |
| `npx ng-point-mcp` line | Already covered by `packages/ng-point-mcp/README.md`; root README links to it |
| Pick-scene's table/toolbar/panel mock | **Not migrated** — the real demo app remains the product truth; the landing keeps no fake product furniture |

Migration rule: verify each destination section against what the packages READMEs already say;
consolidate, never duplicate. Root README grows by ~3 short sections.

## 9. AGENTS.md

Created alongside this PRD (your instruction, content fully specified — not part of the
approval-gated work): Angular changes load `angular-developer`; FE changes load `frontend-design`
and consult `modern-web-guidance`; visual work is verified in a real browser via `webapp-testing`.

## 10. Success criteria

1. The page fits one screen at 1440×900 (hero + animation + footer; header included).
2. Hero copy ≤ 45 words; zero content duplicated between landing and READMEs.
3. Both themes pass: text ≥ 4.5:1, non-text UI ≥ 3:1, identical geometry in light and dark.
4. Reduced motion: static final tableau; no hidden content; Replay swaps instantly.
5. 0 px horizontal overflow at 390×844; copy button works in both themes; no console errors.
6. A first-time viewer who watches once can describe: "click element in the app → context block →
   agent prompt".

## 11. Verification plan

Playwright (via the `webapp-testing` skill) across a matrix: 1440 and 390 × light and dark ×
motion on and reduced. Checks: screenshots, geometry audit (hand lands on the button, chip lands
in Pane B, no overlaps), copy-button interaction, console errors. Final screenshots delivered to
you at the end, as before.

## 12. Open questions (blocking approval)

1. **The attached screenshot**: I cannot view images in this session (model limitation). I read
   "[Image 1] like this" as: *replace the current static pick-scene mock with the animated
   copy→paste story described in §6*. If the image showed something else (a specific layout,
   an inspiration site, a defect), describe it in a sentence and I will fold it in.
2. **Docs CTA target**: the repo has no git remote, so no GitHub README URL exists yet. Options:
   (a) you give me the repo URL now; (b) I ship the button as a `#` placeholder with a TODO
   comment, same as the header link today.
3. **Theme switch**: automatic system theme with no toggle (recommended, quietest), or an
   explicit light/dark toggle in the header?
4. **Animation behavior**: play once on load + Replay control (recommended; satisfies WCAG 2.2.2
   without a pause button), or a continuous loop with a pause control?
5. Anything else you want stripped from the page while it is open?

## 13. Implementation order (after approval)

1. README migration (root `README.md` sections; dedupe against packages READMEs).
2. Landing rebuild: dual-theme tokens, single-screen IA, stripped sections.
3. The animation: DOM structure, CSS keyframe timeline, replay control, reduced-motion tableau.
4. Browser verification matrix (§11) and fixes.
5. Screenshots + final report.
