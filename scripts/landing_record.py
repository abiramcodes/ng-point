"""Record the ng-point landing animation loop as a real-time WebM video.

Usage: python scripts/landing_record.py <url> <shots-dir>
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

URL = sys.argv[1]
OUT = pathlib.Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        record_video_dir=str(OUT),
        record_video_size={"width": 1440, "height": 900},
        color_scheme="light",
        reduced_motion="no-preference",
    )
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle")
    # one full 8s cycle, then ~2s so the loop restart is visible
    page.wait_for_timeout(10200)
    ctx.close()
    page.video.save_as(str(OUT / "landing-motion.webm"))
    browser.close()

print(f"saved {OUT / 'landing-motion.webm'}")
