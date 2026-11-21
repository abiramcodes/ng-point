"""Build a frame-accurate GIF of the landing animation loop.

Instead of wall-clock sampling (screenshots are too slow for that), the Web
Animations API is paused and each frame is *seeked* deterministically, so the
GIF matches the real 8s keyframe timeline exactly.

Usage: python scripts/landing_gif.py <url> <shots-dir>
"""
import io
import pathlib
import sys

from PIL import Image
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
OUT = pathlib.Path(sys.argv[2])
FRAME_MS = 160
FRAME_COUNT = 50  # 50 x 160ms = one full 8s cycle

PAUSE_JS = "() => document.getAnimations().forEach((a) => a.pause())"
SEEK_JS = "(t) => document.getAnimations().forEach((a) => (a.currentTime = t))"

frames = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        color_scheme="light",
        reduced_motion="no-preference",
    )
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(400)
    page.evaluate(PAUSE_JS)
    scene = page.locator(".scene")
    for i in range(FRAME_COUNT):
        page.evaluate(SEEK_JS, i * FRAME_MS)
        frames.append(Image.open(io.BytesIO(scene.screenshot())))
    browser.close()

OUT.mkdir(parents=True, exist_ok=True)
frames[0].save(
    OUT / "landing-motion.gif",
    save_all=True,
    append_images=frames[1:],
    duration=FRAME_MS,
    loop=0,
    optimize=True,
)
print(f"saved {OUT / 'landing-motion.gif'} ({FRAME_COUNT} frames x {FRAME_MS}ms)")
