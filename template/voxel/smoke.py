#!/usr/bin/env python3
"""Smoke test for the "voxel" template, through the plugin's own build.

Builds real single-file games with dsh-game-studio's createProject/buildProject
(Node), then plays them in headless Chrome with Playwright. Run from anywhere:

    python3 template/voxel/smoke.py

Needs Node 24+, Python Playwright and an installed Google Chrome.
"""
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
QA = HERE / 'qa'

BUILD = r"""
import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
const [root, dir, rulesJson, custom] = process.argv.slice(2)
const { createProject } = await import(join(root, 'src/project.ts'))
const { buildProject } = await import(join(root, 'src/build.ts'))
const { writeState } = await import(join(root, 'src/assets.ts'))
await createProject(dir, { title: 'Lantern Isle', template: 'voxel' })
const manifest = JSON.parse(await readFile(join(dir, 'game.json'), 'utf8'))
Object.assign(manifest.rules, JSON.parse(rulesJson))
if (custom === 'custom') {
  // Stand-in "user art": the template's own icons as files the user changed.
  for (const slot of ['hero', 'enemy', 'pickup']) {
    const file = join(dir, manifest.slots[slot].file)
    await writeFile(file, (await readFile(file, 'utf8')).replace('</svg>', '<!-- edited --></svg>'))
  }
}
await writeFile(join(dir, 'game.json'), JSON.stringify(manifest, null, 2))
await writeState(dir)
const build = await buildProject(dir)
console.log(JSON.stringify({ artifact: build.artifact, bytes: build.bytes }))
"""


def build(tmp, name, rules=None, custom=False):
    script = Path(tmp) / 'build.mjs'
    script.write_text(BUILD)
    out = subprocess.run(['node', str(script), str(ROOT), str(Path(tmp) / name), json.dumps(rules or {}), 'custom' if custom else ''],
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout.strip().splitlines()[-1])


def state(page):
    return page.evaluate('window.__gameState()')


def wait_phase(page, phases, ms=15000):
    page.wait_for_function('p => p.includes(window.__gameState().phase)', arg=phases, timeout=ms)
    return state(page)['phase']


KEYS = {'up': 'ArrowUp', 'down': 'ArrowDown', 'left': 'ArrowLeft', 'right': 'ArrowRight'}


def walk_to_edge(page, key, seconds=8):
    """Hold one direction until the shore, side-stepping trees and rocks; the hero must stay in frame."""
    axis, sign = ('x', 1) if key == 'ArrowRight' else ('x', -1) if key == 'ArrowLeft' else ('y', 1) if key == 'ArrowDown' else ('y', -1)
    side = 'ArrowDown' if axis == 'x' else 'ArrowRight'
    last, stuck = state(page)['hero'][axis], 0
    page.keyboard.down(key)
    for step in range(int(seconds * 10)):
        page.wait_for_timeout(100)
        s = state(page)
        assert s['heroOnScreen'], ('the hero left the frame', key, s['hero'])
        now = s['hero'][axis]
        stuck = stuck + 1 if (now - last) * sign < 0.05 else 0
        last = now
        if stuck >= 3:
            page.keyboard.down(side); page.wait_for_timeout(450); page.keyboard.up(side)
            side = {'ArrowDown': 'ArrowUp', 'ArrowUp': 'ArrowDown', 'ArrowRight': 'ArrowLeft', 'ArrowLeft': 'ArrowRight'}[side]
            stuck = 0
    page.keyboard.up(key)
    return state(page)['hero']


def steer(page, seconds):
    """Head for the nearest lantern, away from close enemies, side-stepping when blocked; returns the best score seen."""
    keys = KEYS
    held, best, frames, last, stuck = set(), 0, int(seconds * 10), None, 0
    for _ in range(frames):
        s = state(page)
        assert s['heroOnScreen'], ('the hero left the frame', s['hero'])
        best = max(best, s['score'])
        if s['phase'] != 'playing':
            break
        hero = s['hero']
        target = min(s['pickups'], key=lambda p: (p['x'] - hero['x']) ** 2 + (p['y'] - hero['y']) ** 2, default=None)
        dx = dy = 0.0
        if target:
            d = math.hypot(target['x'] - hero['x'], target['y'] - hero['y']) or 1
            dx, dy = (target['x'] - hero['x']) / d, (target['y'] - hero['y']) / d
        for e in s['enemies']:
            d = math.hypot(hero['x'] - e['x'], hero['y'] - e['y'])
            if 0 < d < 4:
                dx += (hero['x'] - e['x']) / d * (4 - d) / 2
                dy += (hero['y'] - e['y']) / d * (4 - d) / 2
        if last is not None and math.hypot(hero['x'] - last['x'], hero['y'] - last['y']) < 0.05 and held:
            stuck += 1
        else:
            stuck = 0
        last = hero
        if stuck >= 4:  # blocked by a tree or rock: slide sideways for a moment
            dx, dy = -dy, dx
        want = {k for k, on in (('right', dx > 0.3), ('left', dx < -0.3), ('down', dy > 0.3), ('up', dy < -0.3)) if on}
        for k in held - want:
            page.keyboard.up(keys[k])
        for k in want - held:
            page.keyboard.down(keys[k])
        held = want
        page.wait_for_timeout(100)
    for k in held:
        page.keyboard.up(keys[k])
    return best


def main():
    results, errors = {}, []
    QA.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
        normal = build(tmp, 'normal')
        short = build(tmp, 'short', {'duration': 3})
        doomed = build(tmp, 'doomed', {'hearts': 1, 'heroSpeed': 0, 'enemySpeed': 14, 'enemySpawnEvery': 0.2, 'maxEnemies': 6})
        custom = build(tmp, 'custom', {}, custom=True)
        results['bytes'] = normal['bytes']
        browser = p.chromium.launch(channel='chrome', headless=True)

        def open_game(artifact, width, height, touch=False):
            context = browser.new_context(viewport={'width': width, 'height': height}, has_touch=touch)
            page = context.new_page()
            page.set_default_timeout(30000)
            page.on('console', lambda m: m.type == 'error' and errors.append(m.text[:300]))
            page.on('pageerror', lambda e: errors.append(str(e)[:300]))
            page.goto(Path(artifact).as_uri())
            page.wait_for_function('typeof window.__gameState === "function"')
            page.wait_for_timeout(800)
            return context, page

        # Landscape keyboard play: start, move, collect.
        context, page = open_game(normal['artifact'], 1280, 720)
        s = state(page)
        assert s['renderer'] == 'webgl' and s['phase'] == 'title', s
        assert s['heroMode'] == 'voxel', s
        page.screenshot(path=str(QA / 'title-landscape.png'))
        page.keyboard.press('Space')
        assert wait_phase(page, ['playing']) == 'playing'
        x0 = state(page)['hero']['x']
        page.keyboard.down('ArrowRight'); page.wait_for_timeout(600); page.keyboard.up('ArrowRight')
        y0 = state(page)['hero']['y']
        page.keyboard.down('ArrowUp'); page.wait_for_timeout(600); page.keyboard.up('ArrowUp')
        moved = state(page)['hero']
        assert moved['x'] > x0 + 0.5, ('right should increase x', x0, moved)
        assert moved['y'] < y0 - 0.5, ('up should decrease y', y0, moved)
        results['collected'] = steer(page, 18)
        if results['collected'] < 3 and state(page)['phase'] != 'playing':
            page.wait_for_timeout(700)  # caught early: the mechanics, not the autopilot, are under test
            page.keyboard.press('Space')
            wait_phase(page, ['playing'])
            results['collected'] = max(results['collected'], steer(page, 18))
        assert results['collected'] >= 3, results
        assert len(state(page)['enemies']) >= 2
        page.screenshot(path=str(QA / 'playing-landscape.png'))
        results['fps'] = state(page)['fps']
        context.close()

        # Portrait tap to start and touch drag to move.
        context, page = open_game(normal['artifact'], 390, 844, touch=True)
        page.screenshot(path=str(QA / 'title-portrait.png'))
        page.mouse.click(195, 600)
        assert wait_phase(page, ['playing']) == 'playing'
        x0 = state(page)['hero']['x']
        page.mouse.move(195, 600); page.mouse.down(); page.mouse.move(320, 600, steps=6)
        page.wait_for_timeout(700); page.mouse.up()
        assert state(page)['hero']['x'] > x0 + 0.5, 'drag right moves right'
        # Walk to the shores of the narrow portrait view; the hero must stay in frame the whole way.
        results['portraitEdges'] = [walk_to_edge(page, key) for key in ('ArrowRight', 'ArrowLeft')]
        # Trees can wall off one side; one shore reached is enough to prove the camera keeps up.
        assert max(abs(edge['x']) for edge in results['portraitEdges']) > 11, results['portraitEdges']
        steer(page, 5)
        page.screenshot(path=str(QA / 'playing-portrait.png'))
        context.close()

        # Running out the clock wins; losing every heart loses.
        context, page = open_game(short['artifact'], 800, 600)
        page.keyboard.press('Enter')
        results['short'] = wait_phase(page, ['won', 'lost'], 12000)
        assert results['short'] == 'won', results
        context.close()
        context, page = open_game(doomed['artifact'], 800, 600)
        page.keyboard.press('Enter')
        results['doomed'] = wait_phase(page, ['won', 'lost'], 20000)
        assert results['doomed'] == 'lost', results
        page.wait_for_timeout(700)
        page.keyboard.press('Enter')
        assert wait_phase(page, ['playing']) == 'playing', 'any key restarts'
        context.close()

        # The user's own art shows as sprites.
        context, page = open_game(custom['artifact'], 1280, 720)
        page.keyboard.press('Space')
        wait_phase(page, ['playing'])
        page.wait_for_timeout(1200)
        results['customMode'] = state(page)['heroMode']
        assert results['customMode'] == 'sprite', results
        page.screenshot(path=str(QA / 'custom-art.png'))
        context.close()
        browser.close()

    results['errors'] = errors
    print(json.dumps(results, indent=2))
    assert not errors, errors
    print('SMOKE OK')


if __name__ == '__main__':
    main()
