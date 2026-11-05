#!/usr/bin/env python3
"""Smoke test for the "collector" template using Playwright + Chromium."""
import json
import os
import socket
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def state(page):
    return page.evaluate("window.__gameState()")


def wait_phase(page, phases, timeout_ms=8000):
    deadline = time.time() + timeout_ms / 1000.0
    while time.time() < deadline:
        try:
            p = state(page)["phase"]
        except Exception:
            p = None
        if p in phases:
            return p
        time.sleep(0.1)
    raise AssertionError("Timed out waiting for phase %r" % (phases,))


def touch_drag(page, x1, y1, x2, y2, steps=8, hold=0.5):
    client = page.context.new_cdp_session(page)
    client.send("Input.dispatchTouchEvent", {
        "type": "touchStart",
        "touchPoints": [{"x": x1, "y": y1}],
    })
    for i in range(1, steps + 1):
        x = x1 + (x2 - x1) * i / steps
        y = y1 + (y2 - y1) * i / steps
        client.send("Input.dispatchTouchEvent", {
            "type": "touchMove",
            "touchPoints": [{"x": x, "y": y}],
        })
        time.sleep(0.02)
    time.sleep(hold)
    client.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})


def main():
    results = {}
    failures = []

    port = free_port()
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=HERE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    base = "http://127.0.0.1:%d" % port

    try:
        time.sleep(0.4)
        with sync_playwright() as pw:
            try:
                browser = pw.chromium.launch()
            except Exception:
                browser = pw.chromium.launch(channel="chrome")

            # ---- Desktop -------------------------------------------------
            ctx = browser.new_context(viewport={"width": 1280, "height": 720})
            page = ctx.new_page()
            console_errors = []
            page_errors = []
            page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: page_errors.append(str(e)))

            page.goto(base + "/dev.html", wait_until="load")
            page.wait_for_function("typeof window.__gameState === 'function'")

            phase = state(page)["phase"]
            assert phase == "title", "expected title, got %r" % phase
            page.screenshot(path=os.path.join(HERE, "qa", "title.png"))

            page.keyboard.press("Enter")
            assert state(page)["phase"] == "playing", "Enter did not start game"
            x0 = state(page)["hero"]["x"]

            page.keyboard.down("ArrowRight")
            time.sleep(1.0)
            page.keyboard.up("ArrowRight")
            x1 = state(page)["hero"]["x"]
            assert x1 > x0, "hero x did not increase (%r -> %r)" % (x0, x1)
            page.screenshot(path=os.path.join(HERE, "qa", "playing.png"))

            results["desktop"] = {
                "title_ok": True,
                "enter_starts": True,
                "hero_x_from": round(x0, 2),
                "hero_x_to": round(x1, 2),
            }

            # ---- Desktop short round ------------------------------------
            page.goto(base + "/dev.html?duration=3", wait_until="load")
            page.wait_for_function("typeof window.__gameState === 'function'")
            page.keyboard.press("Enter")
            end_phase = wait_phase(page, {"won", "lost"}, timeout_ms=8000)
            page.screenshot(path=os.path.join(HERE, "qa", "end.png"))
            results["desktop_end"] = {"phase": end_phase, "score": state(page)["score"]}

            # ---- Phone ---------------------------------------------------
            pctx = browser.new_context(
                viewport={"width": 390, "height": 844},
                has_touch=True,
                is_mobile=True,
            )
            ppage = pctx.new_page()
            pconsole = []
            ppage.on("console", lambda m: pconsole.append(m.text) if m.type == "error" else None)
            ppage.on("pageerror", lambda e: pconsole.append(str(e)))

            ppage.goto(base + "/dev.html", wait_until="load")
            ppage.wait_for_function("typeof window.__gameState === 'function'")

            # Tap to start.
            ppage.touchscreen.tap(195, 400)
            try:
                wait_phase(ppage, {"playing"}, timeout_ms=3000)
            except AssertionError:
                ppage.mouse.click(195, 400)
                wait_phase(ppage, {"playing"}, timeout_ms=3000)

            h0 = state(ppage)["hero"]
            touch_drag(ppage, 195, 420, 195, 280, steps=8, hold=0.5)
            h1 = state(ppage)["hero"]
            assert h1["y"] < h0["y"] - 5, "hero did not move on drag (%r -> %r)" % (h0, h1)
            ppage.screenshot(path=os.path.join(HERE, "qa", "phone.png"))
            results["phone"] = {
                "tap_starts": True,
                "hero_y_from": round(h0["y"], 2),
                "hero_y_to": round(h1["y"], 2),
            }

            # ---- Error accounting ---------------------------------------
            results["errors"] = {
                "desktop_console": console_errors,
                "desktop_page": page_errors,
                "phone_console": pconsole,
            }
            if console_errors or page_errors or pconsole:
                failures.append("console/page errors seen: %r" % results["errors"])

            pctx.close()
            ctx.close()
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=5)

    summary = {"ok": not failures, "results": results, "failures": failures}
    print(json.dumps(summary, indent=2))
    sys.exit(0 if not failures else 1)


if __name__ == "__main__":
    os.makedirs(os.path.join(HERE, "qa"), exist_ok=True)
    main()
