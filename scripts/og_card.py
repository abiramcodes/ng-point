#!/usr/bin/env python3
"""Render the ng-point social/OG cards (site/media/) in the current design.

Cards are drawn from the landing page's own visual system — dark instrument
base, faint coordinate grid, reticle logo with the < chevron in brand
red-magenta, JetBrains Mono, hard corners, and the install box framed by the
scene's amber corner brackets with the border glint parked on it.

Outputs:
  site/media/og-card.png         1200x630  (og:image / twitter large card)
  site/media/og-card-square.png  1080x1080 (square crop for manual use)
  site/media/apple-touch-icon.png 180x180  (iOS home-screen icon)

Usage: pw-venv/bin/python scripts/og_card.py
"""

from pathlib import Path

from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "media"

# The landing page's own tokens (dark theme).
TOKENS = """
      --bg: #0a0a0f;
      --ink: #e8e8f0;
      --dim: #8a8a9a;
      --rule: #1e1e28;
      --surf: #14141b;
      --surf-edge: #2b2b36;
      --pick: #ffc53d;
      --brand: #d40f62;
      --grid: rgba(232, 232, 240, 0.035);
"""

HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&display=swap" />
<style>
  * { box-sizing: border-box; border-radius: 0; margin: 0; }
  :root { %(tokens)s }
  body {
    width: %(w)dpx;
    height: %(h)dpx;
    overflow: hidden;
    background: var(--bg);
    background-image:
      linear-gradient(var(--grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--grid) 1px, transparent 1px);
    background-size: 32px 32px;
    color: var(--ink);
    font: 400 %(base)dpx/1.6 'JetBrains Mono', 'SF Mono', Consolas, monospace;
    -webkit-font-smoothing: antialiased;
  }
  .card {
    position: relative;
    width: 100%%;
    height: 100%%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: %(pad)dpx;
  }
  .brandrow { display: flex; align-items: center; gap: %(brandgap)dpx; }
  .brandrow svg { display: block; }
  .wordmark {
    font-size: %(word)dpx;
    font-weight: 800;
    letter-spacing: 0.5px;
  }
  .meta {
    margin-inline-start: auto;
    color: var(--dim);
    font-size: %(meta)dpx;
    text-align: right;
    line-height: 1.5;
  }
  .headline {
    font-size: %(head)dpx;
    font-weight: 800;
    line-height: 1.16;
    letter-spacing: -0.5px;
    margin-block: %(headgap)dpx 0;
  }
  .installwrap {
    position: relative;
    margin-block-start: %(boxgap)dpx;
    padding: %(brk)dpx;
    width: max-content;
  }
  .install {
    position: relative;
    padding: 16px 24px;
    background: var(--surf);
    border: 1px solid var(--surf-edge);
    font-size: %(install)dpx;
    font-weight: 500;
  }
  .install .dollar { color: var(--dim); margin-inline-end: 12px; }
  .install .pkg { color: var(--ink); font-weight: 700; }
  /* the site's border glint, parked mid-orbit */
  .install::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    padding: 1px;
    background: conic-gradient(
      from 40deg,
      transparent 0deg 300deg,
      color-mix(in oklab, #ffc53d 35%%, transparent) 318deg,
      color-mix(in oklab, #ffc53d 70%%, transparent) 328deg,
      color-mix(in oklab, #ffc53d 35%%, transparent) 338deg,
      transparent 356deg 360deg
    );
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: exclude;
  }
  /* the scene's fiducial corner brackets: this command is the target */
  .brk { position: absolute; width: %(brkarm)dpx; height: %(brkarm)dpx; }
  .brk.tl { inset-block-start: 0; inset-inline-start: 0;
             border-block-start: 2px solid var(--pick); border-inline-start: 2px solid var(--pick); }
  .brk.tr { inset-block-start: 0; inset-inline-end: 0;
             border-block-start: 2px solid var(--pick); border-inline-end: 2px solid var(--pick); }
  .brk.bl { inset-block-end: 0; inset-inline-start: 0;
             border-block-end: 2px solid var(--pick); border-inline-start: 2px solid var(--pick); }
  .brk.br { inset-block-end: 0; inset-inline-end: 0;
             border-block-end: 2px solid var(--pick); border-inline-end: 2px solid var(--pick); }
  .footrow {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 24px;
    color: var(--dim);
    font-size: %(foot)dpx;
  }
  .url { white-space: nowrap; }
</style>
</head>
<body>
  <div class="card">
    <div class="brandrow">
      <svg width="%(logo)d" height="%(logo)d" viewBox="0 0 26 26" aria-hidden="true">
        <circle cx="13" cy="13" r="7.5" fill="none" stroke="var(--ink)" stroke-width="1.8" />
        <path d="M13 1.8v3.2M13 21v3.2M1.8 13h3.2M21 13h3.2"
              stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round" />
        <path d="M15.2 9.6L11.5 13l3.7 3.4"
              fill="none" stroke="var(--brand)" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span class="wordmark">ng-point</span>
      <span class="meta">angular 21&ndash;22<br />dev-mode only &middot; MIT</span>
    </div>

    <div>
      <h1 class="headline">One Alt+Click.<br />Your agent is already on it.</h1>
      <div class="installwrap">
        <i class="brk tl"></i><i class="brk tr"></i><i class="brk bl"></i><i class="brk br"></i>
        <div class="install"><span class="dollar">$</span>npm install -D <span class="pkg">ng-point</span></div>
      </div>
    </div>

    <div class="footrow">
      <span>component &middot; file:line &middot; cleaned html &middot; your instruction</span>
      <span class="url">abiramcodes.github.io/ng-point</span>
    </div>
  </div>
</body>
</html>
"""

WIDE = dict(w=1200, h=630, pad=72, base=22, logo=64, brandgap=20, word=34,
            meta=19, head=56, headgap=40, boxgap=44, install=23,
            brk=14, brkarm=24, foot=19)
SQUARE = dict(w=1080, h=1080, pad=88, base=23, logo=72, brandgap=24, word=38,
              meta=20, head=62, headgap=48, boxgap=56, install=25,
              brk=16, brkarm=28, foot=20)


def render(pg, values, out_name):
    html = HTML % dict(values, tokens=TOKENS)
    pg.set_viewport_size({"width": values["w"], "height": values["h"]})
    pg.set_content(html, wait_until="networkidle")
    pg.evaluate("document.fonts.ready.then(() => {})")
    pg.wait_for_timeout(400)
    pg.screenshot(path=str(OUT / out_name), clip={"x": 0, "y": 0,
                                                 "width": values["w"],
                                                 "height": values["h"]})
    print(f"saved {OUT / out_name} ({values['w']}x{values['h']})")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        pg = browser.new_page()
        render(pg, WIDE, "og-card.png")
        render(pg, SQUARE, "og-card-square.png")
        render_touch_icon(pg)
        browser.close()


def render_touch_icon(pg):
    """iOS home-screen icon: solid dark base, the reticle mark at 2x."""
    size = 360  # rendered at 2x, downscaled to 180 for crisp strokes
    pg.set_viewport_size({"width": size, "height": size})
    pg.set_content(f"""<!doctype html>
<html><head><style>
  * {{ box-sizing: border-box; border-radius: 0; margin: 0; }}
  html, body {{ width: {size}px; height: {size}px; overflow: hidden; }}
  body {{
    display: grid;
    place-items: center;
    background: #0a0a0f;
  }}
  svg {{ display: block; width: 224px; height: 224px; }}
</style></head>
<body>
  <svg viewBox="0 0 26 26" aria-hidden="true">
    <circle cx="13" cy="13" r="7.5" fill="none" stroke="#e8e8f0" stroke-width="1.8" />
    <path d="M13 1.8v3.2M13 21v3.2M1.8 13h3.2M21 13h3.2"
          stroke="#e8e8f0" stroke-width="1.8" stroke-linecap="round" />
    <path d="M15.2 9.6L11.5 13l3.7 3.4"
          fill="none" stroke="#d40f62" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</body></html>""")
    pg.wait_for_timeout(200)
    tmp = OUT / "apple-touch-icon@2x.png"
    pg.screenshot(path=str(tmp), clip={"x": 0, "y": 0, "width": size, "height": size})
    Image.open(tmp).resize((180, 180), Image.LANCZOS).save(OUT / "apple-touch-icon.png")
    tmp.unlink()
    print(f"saved {OUT / 'apple-touch-icon.png'} (180x180 from {size}px render)")


if __name__ == "__main__":
    main()
