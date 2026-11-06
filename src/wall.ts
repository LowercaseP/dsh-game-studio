/**
 * The game wall outside DSH: find every game in the workspace (the same scan
 * the sidebar's wall uses) and pack their latest builds into one offline HTML
 * page with the wall's tiles. Opening a tile plays that game full-window.
 *
 * Nothing is rebuilt or written inside the game projects; a game that was
 * never built is left out and reported. 3D games share one copy of the
 * runtime they all inline.
 */
import { lstat, mkdir, readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { scanShelf, type ListDir, type ReadText, type ShelfGame } from './client/shelf.ts'
import { runtimeTag } from './build.ts'
import { decodePng, encodePng, shrinkToWidth } from './png.ts'
import { RUNTIMES, type RuntimeId } from './project.ts'
import { resolveInside, StudioError, writeFileAtomic } from './util.ts'

export const fsList: ListDir = async (path) => {
  const entries = await readdir(path, { withFileTypes: true })
  // Symbolic links count as "other": the scan never follows one out of the workspace.
  return { entries: entries.map(entry => ({ name: entry.name, type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other' })), truncated: false }
}
export const fsRead: ReadText = async (path) => readFile(path, 'utf8')

export function listGames(root: string, signal: AbortSignal = new AbortController().signal) {
  return scanShelf(fsList, fsRead, root, signal)
}

export type WallLang = 'zh' | 'en'

export interface WallOptions {
  root: string
  /** Game folders (relative to root or absolute inside it) in the order to show; default every game, newest first. */
  projects?: string[]
  lang?: WallLang
  /** File name without extension; default game-wall. */
  name?: string
  signal?: AbortSignal
}

export interface WallResult {
  file: string
  bytes: number
  games: number
  skipped: Array<{ path: string; reason: string }>
}

/** Above this the page gets slow to open; ask for fewer games instead. */
const MAX_WALL_BYTES = 64 * 1024 * 1024
const COVER_WIDTH = 480
const MAX_COVER_BYTES = 600 * 1024

async function isPlainFile(path: string): Promise<boolean> {
  try { return (await lstat(path)).isFile() } catch { return false }
}

/** A small data URL for the tile, or undefined when the cover is missing, a link, or too big to embed. */
async function coverData(path: string | undefined): Promise<string | undefined> {
  if (!path || !(await isPlainFile(path))) return undefined
  const bytes = await readFile(path)
  const lower = path.toLowerCase()
  if (lower.endsWith('.png')) {
    try {
      const small = encodePng(shrinkToWidth(decodePng(bytes), COVER_WIDTH))
      return `data:image/png;base64,${Buffer.from(small).toString('base64')}`
    } catch { return undefined }
  }
  if (bytes.byteLength > MAX_COVER_BYTES) return undefined
  const type = lower.endsWith('.svg') ? 'image/svg+xml' : lower.endsWith('.webp') ? 'image/webp' : /\.jpe?g$/u.test(lower) ? 'image/jpeg' : undefined
  return type ? `data:${type};base64,${bytes.toString('base64')}` : undefined
}

function slugOf(name: string): string {
  return name.normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/gu, '').toLowerCase() || 'game-wall'
}

/** JSON that cannot close the script element it sits in. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</gu, '\\u003c').replace(/\u2028/gu, '\\u2028').replace(/\u2029/gu, '\\u2029')
}

function guessLang(games: ShelfGame[]): WallLang {
  return games.some(game => /[㐀-鿿]/u.test(game.title)) ? 'zh' : 'en'
}

export async function exportWall(options: WallOptions): Promise<WallResult> {
  const { root } = options
  const signal = options.signal ?? new AbortController().signal
  const scan = await listGames(root, signal)
  const byPath = new Map(scan.games.map(game => [game.project, game]))
  const skipped: WallResult['skipped'] = []
  let chosen: ShelfGame[]
  if (options.projects && options.projects.length > 0) {
    chosen = []
    for (const path of options.projects) {
      const dir = resolveInside(root, path)
      const game = byPath.get(dir)
      if (game) chosen.push(game)
      else skipped.push({ path, reason: 'not a game folder (needs game.json and .studio/)' })
    }
  } else chosen = scan.games

  const runtimes: Partial<Record<RuntimeId, string>> = {}
  for (const id of RUNTIMES) { try { runtimes[id] = await runtimeTag(id) } catch { /* runtime missing from this install */ } }
  const usedRuntimes = new Set<RuntimeId>()

  const entries: Array<Record<string, unknown>> = []
  for (const game of chosen) {
    if (signal.aborted) throw new StudioError('Export was cancelled', 'CANCELLED')
    const rel = relative(root, game.project) || '.'
    const artifact = join(game.project, 'dist', 'index.html')
    if (!(await isPlainFile(artifact))) { skipped.push({ path: rel, reason: 'not built yet' }); continue }
    let html = await readFile(artifact, 'utf8')
    for (const id of RUNTIMES) {
      const tag = runtimes[id]
      if (tag && html.includes(tag)) { html = html.split(tag).join(`<!--dsh-runtime:${id}-->`); usedRuntimes.add(id) }
    }
    entries.push({
      title: game.title, dimension: game.dimension ?? '', orientation: game.orientation,
      versions: game.versions, updatedAt: game.updatedAt, cover: await coverData(game.cover), html,
    })
  }
  if (entries.length === 0) throw new StudioError('No built games to put on the wall', 'NOTHING_TO_EXPORT')

  const lang = options.lang ?? guessLang(chosen)
  const data = {
    lang,
    exportedAt: new Date().toISOString(),
    runtimes: Object.fromEntries([...usedRuntimes].map(id => [id, runtimes[id]])),
    games: entries,
  }
  const page = renderWallPage(lang, scriptJson(data))
  const bytes = Buffer.byteLength(page)
  if (bytes > MAX_WALL_BYTES) {
    throw new StudioError(`The wall would be ${(bytes / 1048576).toFixed(1)} MB; the limit is ${MAX_WALL_BYTES / 1048576} MB. Export fewer games.`, 'TOO_LARGE')
  }
  const dir = join(root, 'export')
  await mkdir(dir, { recursive: true })
  const file = join(dir, `${slugOf(options.name ?? 'game-wall')}.html`)
  await writeFileAtomic(file, page)
  return { file, bytes, games: entries.length, skipped }
}

const COPY: Record<WallLang, Record<string, string>> = {
  zh: { title: '游戏墙', count: '{n} 款', all: '全部', made: '用 DSH 游戏工坊做的 · 导出于 {date}', back: '← 返回游戏墙', versions: '{n} 个版本', hint: 'Esc 返回' },
  en: { title: 'Game wall', count: '{n} games', all: 'All', made: 'Made with DSH Game Studio · exported {date}', back: '← Back to the wall', versions: '{n} versions', hint: 'Esc to go back' },
}

const CSP = [
  "default-src 'none'", 'img-src data: blob:', 'media-src data: blob:', 'font-src data:',
  "style-src 'unsafe-inline'", "script-src 'unsafe-inline'", "connect-src 'none'", "form-action 'none'",
].join('; ')

/** The page: tiles like the sidebar's wall, 2D/3D filters, and a full-window player. */
export function renderWallPage(lang: WallLang, json: string): string {
  const copy = COPY[lang]
  return `<!doctype html>
<html lang="${lang === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<title>${copy.title}</title>
<style>
:root{color-scheme:dark;--bg:#111317;--fg:#f2f3f5;--muted:#9aa0aa;--chip:#23262d;--chip-on:#f2f3f5;--chip-on-fg:#111317}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.4 -apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif}
header{padding:20px 16px 8px;max-width:1280px;margin:0 auto}
h1{margin:0;font-size:24px;display:flex;align-items:baseline;gap:10px}h1 small{font-size:14px;color:var(--muted);font-weight:400}
.made{margin:4px 0 0;color:var(--muted);font-size:12px}.made a{color:inherit}
.chips{display:flex;gap:8px;margin:14px 0 4px;flex-wrap:wrap}
.chip{font:inherit;border:0;border-radius:999px;padding:5px 14px;background:var(--chip);color:var(--fg);cursor:pointer}
.chip[aria-pressed="true"]{background:var(--chip-on);color:var(--chip-on-fg);font-weight:600}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:10px;padding:8px 16px 28px;max-width:1280px;margin:0 auto}
.tile{position:relative;aspect-ratio:4/3;border:0;padding:0;border-radius:12px;overflow:hidden;cursor:pointer;background:#1d1f24;color:#fff;font:inherit;text-align:left}
.tile .shot{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .25s ease}
.tile .art{position:absolute;inset:8% 12% 30%;width:76%;height:62%;object-fit:contain;transition:transform .25s ease}
.tile.art-bg{background:radial-gradient(circle at 50% 40%,#3a3f4b 0%,#1d1f24 75%)}
.tile:hover img,.tile:focus-visible img{transform:scale(1.05)}.tile:focus-visible{outline:2px solid #4c8bf5;outline-offset:2px}
.cap{position:absolute;left:0;right:0;bottom:0;padding:28px 10px 8px;background:linear-gradient(to top,rgba(0,0,0,.82),rgba(0,0,0,.55) 55%,rgba(0,0,0,0))}
.name{display:block;font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 2px rgba(0,0,0,.5)}
.meta{display:block;font-size:12px;color:rgba(255,255,255,.72);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#player{position:fixed;inset:0;background:#000;display:none;z-index:10}#player.open{display:block}
#player iframe{position:absolute;top:40px;left:0;width:100%;height:calc(100% - 40px);border:0}
#bar{position:absolute;top:0;left:0;right:0;height:40px;display:flex;align-items:center;gap:10px;padding:0 10px;background:#16181c;border-bottom:1px solid #2a2d33}
#bar strong{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#back{font:inherit;font-size:13px;border:0;border-radius:999px;padding:5px 12px;background:#2a2d33;color:#fff;cursor:pointer;flex:none}
#back:hover,#back:focus-visible{background:#3a3e46}
#back small{opacity:.7;margin-left:6px}
</style></head><body>
<header><h1>${copy.title} <small id="count"></small></h1><p class="made" id="made"></p><div class="chips" id="chips"></div></header>
<main id="wall"></main>
<div id="player" role="dialog" aria-modal="true"><div id="bar"><button id="back" type="button">${copy.back}<small>${copy.hint}</small></button><strong id="playing"></strong></div></div>
<script type="application/json" id="data">${json}</script>
<script>
(function () {
  var COPY = ${JSON.stringify(copy)};
  var data = JSON.parse(document.getElementById('data').textContent);
  var wall = document.getElementById('wall'), chips = document.getElementById('chips'), player = document.getElementById('player');
  var filter = 'all', frame = null;
  function fill(text, n) { return text.replace('{n}', String(n)).replace('{date}', n); }
  var made = document.getElementById('made');
  made.appendChild(document.createTextNode(fill(COPY.made, data.exportedAt.slice(0, 10)) + ' · '));
  var link = document.createElement('a'); link.href = 'https://github.com/ZSeven-W/dsh-game-studio'; link.target = '_blank'; link.rel = 'noopener';
  link.textContent = 'github.com/ZSeven-W/dsh-game-studio'; made.appendChild(link);
  function counts() { var c = { all: data.games.length, '2d': 0, '3d': 0 }; data.games.forEach(function (g) { if (c[g.dimension] !== undefined) c[g.dimension]++; }); return c; }
  function renderChips() {
    var c = counts(); chips.innerHTML = '';
    [['all', COPY.all], ['2d', '2D'], ['3d', '3D']].forEach(function (pair) {
      if (pair[0] !== 'all' && c[pair[0]] === 0) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip';
      b.textContent = pair[1] + ' ' + c[pair[0]]; b.setAttribute('aria-pressed', String(filter === pair[0]));
      b.onclick = function () { filter = pair[0]; renderChips(); renderWall(); }; chips.appendChild(b);
    });
  }
  function renderWall() {
    wall.innerHTML = ''; var shown = 0;
    data.games.forEach(function (g, i) {
      if (filter !== 'all' && g.dimension !== filter) return; shown++;
      var shot = g.cover && g.cover.indexOf('data:image/jpeg') === 0;
      var t = document.createElement('button'); t.type = 'button'; t.className = 'tile' + (shot ? '' : ' art-bg'); t.title = g.title;
      if (g.cover) { var img = document.createElement('img'); img.src = g.cover; img.alt = ''; img.className = shot ? 'shot' : 'art'; t.appendChild(img); }
      var cap = document.createElement('span'); cap.className = 'cap';
      var name = document.createElement('span'); name.className = 'name'; name.textContent = g.title;
      var meta = document.createElement('span'); meta.className = 'meta';
      meta.textContent = [g.dimension ? g.dimension.toUpperCase() : '', g.versions > 0 ? fill(COPY.versions, g.versions) : ''].filter(Boolean).join(' · ');
      cap.appendChild(name); cap.appendChild(meta); t.appendChild(cap);
      t.onclick = function () { play(i); }; wall.appendChild(t);
    });
    document.getElementById('count').textContent = fill(COPY.count, shown);
  }
  function play(i) {
    var g = data.games[i];
    var html = g.html.replace(/<!--dsh-runtime:([a-z0-9]+)-->/g, function (all, id) { return data.runtimes[id] || all; });
    close();
    frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock');
    frame.setAttribute('allow', 'fullscreen; gamepad; autoplay');
    frame.title = g.title; frame.srcdoc = html;
    frame.onload = function () {
      try {
        frame.contentWindow.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
      } catch (e) { /* not reachable */ }
      try { frame.contentWindow.focus(); } catch (e) { frame.focus(); }
    };
    player.appendChild(frame); player.classList.add('open'); document.title = g.title;
    document.getElementById('playing').textContent = g.title;
  }
  function close() {
    if (frame) { frame.remove(); frame = null; }
    player.classList.remove('open'); document.title = COPY.title;
  }
  document.getElementById('back').onclick = close;
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  renderChips(); renderWall();
})();
</script>
</body></html>
`
}
