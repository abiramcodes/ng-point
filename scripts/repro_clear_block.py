"""Real-browser verification for "cleared the context block, then Alt+Click does nothing".

Runs every flow variant from a fresh page against the dev build (served via
route fulfillment), with Element-line probes and per-scenario error capture.
Scenario G verifies the fix: Alt+Click straight on the panel picks the
element visually beneath it.
"""
import pathlib

from playwright.sync_api import sync_playwright

DIST = pathlib.Path("dist/demo/browser")
BASE = "http://localhost:4200"


def fulfill(route):
    url = route.request.url
    path = url[len(BASE):].split("?")[0] or "/"
    file = DIST / "index.html" if path == "/" else DIST / path.lstrip("/")
    if not file.exists():
        file = DIST / "index.html"
    ctype = "text/html"
    if file.suffix == ".js":
        ctype = "text/javascript"
    elif file.suffix == ".css":
        ctype = "text/css"
    route.fulfill(status=200, body=file.read_bytes(), content_type=ctype)


def fresh(browser):
    errors = []
    ctx = browser.new_context(viewport={"width": 1280, "height": 800})
    ctx.route(BASE + "/**", fulfill)
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + "/orders")
    page.wait_for_selector("app-orders-page h1")
    page.wait_for_timeout(500)
    return ctx, page, errors


def pick(page, selector):
    page.click(selector, modifiers=["Alt"])
    page.wait_for_selector(".ng-point-panel[open]", timeout=5000)


def probe(page):
    panel = bool(page.query_selector(".ng-point-panel[open]"))
    value = page.eval_on_selector(".ng-point-block", "el => el.value")
    element_line = next(
        (ln for ln in value.split("\n") if ln.startswith("Element:")),
        "(no Element line)",
    )
    status = page.eval_on_selector(".ng-point-status", "el => el.textContent.trim()")
    return panel, element_line, status


with sync_playwright() as p:
    browser = p.chromium.launch()

    # B: clear the block, Enter, then Alt+Click a different element.
    ctx, page, errs = fresh(browser)
    pick(page, "app-orders-page h1")
    page.fill(".ng-point-block", "")
    page.keyboard.press("Enter")
    page.click("footer p:first-child", modifiers=["Alt"])
    page.wait_for_timeout(600)
    panel, el, status = probe(page)
    print(f"B: open={panel} | {el} | status={status!r} | errors={errs or 'none'}")
    ctx.close()

    # C: clear the block, click the commit button, then Alt+Click.
    ctx, page, errs = fresh(browser)
    pick(page, "app-orders-page h1")
    page.fill(".ng-point-block", "")
    page.click(".ng-point-commit")
    page.click("footer p:first-child", modifiers=["Alt"])
    page.wait_for_timeout(600)
    panel, el, status = probe(page)
    print(f"C: open={panel} | {el} | status={status!r} | errors={errs or 'none'}")
    ctx.close()

    # D: clear the block, Escape, then Alt+Click.
    ctx, page, errs = fresh(browser)
    pick(page, "app-orders-page h1")
    page.fill(".ng-point-block", "")
    page.keyboard.press("Escape")
    page.click("footer p:first-child", modifiers=["Alt"])
    page.wait_for_timeout(600)
    panel, el, status = probe(page)
    print(f"D: open={panel} | {el} | status={status!r} | errors={errs or 'none'}")
    ctx.close()

    # E: clear the block, Alt+Click the SAME element.
    ctx, page, errs = fresh(browser)
    pick(page, "app-orders-page h1")
    page.fill(".ng-point-block", "")
    page.click("app-orders-page h1", modifiers=["Alt"])
    page.wait_for_timeout(600)
    panel, el, status = probe(page)
    print(f"E: open={panel} | {el} | status={status!r} | errors={errs or 'none'}")
    ctx.close()

    # F: clear the block, Alt+Click the ngPointIgnore demo paragraph.
    ctx, page, errs = fresh(browser)
    pick(page, "app-orders-page h1")
    page.fill(".ng-point-block", "")
    page.click("footer p:nth-child(2)", modifiers=["Alt"])
    page.wait_for_timeout(600)
    panel, el, status = probe(page)
    print(f"F: open={panel} | {el} | status={status!r} | errors={errs or 'none'}")
    ctx.close()

    # G (the fix): Alt+Click straight ON the open panel -> picks what's beneath.
    ctx, page, errs = fresh(browser)
    pick(page, "app-orders-page h1")
    page.fill(".ng-point-block", "")
    before = probe(page)[1]
    page.click(".ng-point-head", modifiers=["Alt"], position={"x": 120, "y": 10})
    page.wait_for_timeout(600)
    panel, el, status = probe(page)
    print(f"G: before={before}")
    print(f"G: after  open={panel} | {el} | status={status!r} | errors={errs or 'none'}")
    ctx.close()

    browser.close()
