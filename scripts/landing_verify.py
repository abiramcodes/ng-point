"""Verify the ng-point landing page across the PRD matrix:
themes x widths x motion, plus toggle, pause, and copy interactions.

Usage: python scripts/landing_verify.py <url> <shots-dir>
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

URL = sys.argv[1]
OUT = pathlib.Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

errors = []


def new_page(browser, **opts):
    page = browser.new_page(
        viewport=opts.pop("viewport", {"width": 1440, "height": 900}),
        device_scale_factor=opts.pop("dsf", 2),
        color_scheme=opts.pop("scheme", "light"),
        reduced_motion=opts.pop("motion", "no-preference"),
        **opts,
    )
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    return page


GEO = """() => {
  const r = (el) => el.getBoundingClientRect();
  const h1 = document.querySelector('#hero-h');
  const pick = document.querySelector('.pick-anchor');
  const block = document.querySelector('.block-card');
  const page = document.querySelector('.pane-page');
  const agent = document.querySelector('.pane-agent');
  return {
    h1Lines: Math.round(r(h1).height / parseFloat(getComputedStyle(h1).lineHeight)),
    ringOnPick:
      getComputedStyle(pick, '::after').opacity === '1' && r(pick).width > 0,
    blockClearsAppCard: r(block).top >= r(page).top + r(page).height * 0.55,
    blockInsidePane: r(block).right <= r(page).right && r(block).bottom <= r(page).bottom,
    panesSideBySide: r(page).right <= r(agent).left + 1,
    panesStacked: r(page).bottom <= r(agent).top + 1,
    sceneH: Math.round(r(document.querySelector('.scene')).height),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}"""

TABLEAU = """() => ({
  statusFixingOpacity: getComputedStyle(document.querySelector('.status-fixing')).opacity,
  statusDoneOpacity: getComputedStyle(document.querySelector('.status-done')).opacity,
  blockOpacity: getComputedStyle(document.querySelector('.block-card')).opacity,
  promptOpacity: getComputedStyle(document.querySelector('.pl1')).opacity,
  placeholderOpacity: getComputedStyle(document.querySelector('.placeholder')).opacity,
  bcInstrWidth: getComputedStyle(document.querySelector('.bc-instr')).inlineSize,
  pauseHidden: getComputedStyle(document.querySelector('.anim-toggle')).display === 'none',
  animCount: document.getAnimations().length,
})"""

# Deterministic rest-phase capture: pause and seek the loop to the
# "Fixed" tableau (6.4s of the 8s cycle).
PAUSE_SEEK_JS = (
    "() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 6400; })"
)

with sync_playwright() as p:
    browser = p.chromium.launch()

    # 1. Reduced motion: static final tableau, deterministic geometry.
    rm = new_page(browser, motion="reduce")
    rm.goto(URL, wait_until="networkidle")
    rm.wait_for_timeout(800)
    print("--- reduced motion (1440, light) ---")
    print(f"tableau: {rm.evaluate(TABLEAU)}")
    print(f"geometry: {rm.evaluate(GEO)}")
    rm.screenshot(path=str(OUT / "landing-reduced-1440.png"))
    rm.close()

    # 2. Motion on: animations run, pause works, rest-phase geometry.
    mo = new_page(browser)
    mo.goto(URL, wait_until="networkidle")
    mo.wait_for_timeout(700)
    print("--- motion on (1440, light) ---")
    print(f"animations running: {mo.evaluate('document.getAnimations().length > 0')}")
    mo.click(".anim-toggle")
    mo.wait_for_timeout(200)
    paused = mo.evaluate(
        "() => document.getAnimations().every((a) => a.playState === 'paused')"
    )
    print(f"after pause click: all paused={paused}, label={mo.locator('.anim-toggle').text_content()!r}")
    mo.click(".anim-toggle")
    mo.wait_for_timeout(200)
    resumed = mo.evaluate(
        "() => document.getAnimations().every((a) => a.playState === 'running')"
    )
    print(f"after play click: all running={resumed}, label={mo.locator('.anim-toggle').text_content()!r}")
    mo.evaluate(PAUSE_SEEK_JS)
    print(f"geometry at rest: {mo.evaluate(GEO)}")
    mo.screenshot(path=str(OUT / "landing-hero-1440-light.png"))
    mo.close()

    # 3. Dark scheme (system): tokens flip, label shows the switch TARGET.
    dk = new_page(browser, scheme="dark")
    dk.goto(URL, wait_until="networkidle")
    dk.wait_for_timeout(400)
    dk.evaluate(PAUSE_SEEK_JS)
    print("--- system dark (1440) ---")
    print(f"body bg: {dk.evaluate('getComputedStyle(document.body).backgroundColor')}, "
          f"toggle shows: {dk.locator('.theme-toggle').inner_text().strip()!r}")
    assert dk.locator(".theme-toggle").inner_text().strip() == "light", (
        "dark page must offer to switch to light"
    )
    dk.screenshot(path=str(OUT / "landing-hero-1440-dark.png"))
    dk.close()

    # 4. Toggle: pin dark under light system, reload keeps it, toggle back unpins.
    META_JS = "document.querySelector('meta[name=color-scheme]').content"
    BG_JS = "getComputedStyle(document.body).backgroundColor"
    SWITCH_JS = "() => document.documentElement.classList.contains('theme-switch')"
    tg = new_page(browser, scheme="light")
    tg.goto(URL, wait_until="networkidle")
    tg.wait_for_timeout(600)
    print("--- theme toggle (system light) ---")
    assert tg.locator(".theme-toggle").inner_text().strip() == "dark", (
        "light page must offer to switch to dark"
    )
    tg.click(".theme-toggle")
    tg.wait_for_timeout(60)
    print(
        f"pinned dark: meta={tg.evaluate(META_JS)!r}, bg={tg.evaluate(BG_JS)}, "
        f"label={tg.locator('.theme-toggle').inner_text().strip()!r}, "
        f"crossfade active={tg.evaluate(SWITCH_JS)}"
    )
    assert tg.locator(".theme-toggle").inner_text().strip() == "light"
    tg.wait_for_timeout(600)
    assert not tg.evaluate(SWITCH_JS), (
        "theme-switch class must be removed after the transition settles"
    )
    tg.reload(wait_until="networkidle")
    tg.wait_for_timeout(400)
    print(f"after reload: meta={tg.evaluate(META_JS)!r}, bg={tg.evaluate(BG_JS)}")
    tg.click(".theme-toggle")
    tg.wait_for_timeout(200)
    print(f"unpinned: meta={tg.evaluate(META_JS)!r}, bg={tg.evaluate(BG_JS)}, "
          f"label={tg.locator('.theme-toggle').inner_text().strip()!r}")
    assert tg.locator(".theme-toggle").inner_text().strip() == "dark"
    tg.close()

    # 5. Mobile dark: overflow + geometry.
    mb = new_page(browser, scheme="dark", viewport={"width": 390, "height": 844})
    mb.goto(URL, wait_until="networkidle")
    mb.wait_for_timeout(400)
    mb.evaluate(PAUSE_SEEK_JS)
    print("--- mobile (390, dark) ---")
    print(f"geometry: {mb.evaluate(GEO)}")
    mb.screenshot(path=str(OUT / "landing-full-390-dark.png"), full_page=True)
    mb.close()

    # 6. Copy button interaction (first copyable; several exist).
    cp = new_page(browser)
    cp.goto(URL, wait_until="networkidle")
    cp.locator(".copy-button").first.click()
    cp.wait_for_timeout(400)
    state = cp.evaluate(
        "() => { const b = document.querySelector('.copy-button');"
        " return b.hasAttribute('data-copied') || b.hasAttribute('data-failed'); }"
    )
    tip = cp.locator(".copyable").first.locator(".tip").text_content()
    print(f"copy feedback: visible={state}, tip={tip!r}")
    cp.close()

    browser.close()

if errors:
    print("console errors:")
    for e in errors:
        print("  -", e)
else:
    print("no console errors")
