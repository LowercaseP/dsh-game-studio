/**
 * Build a project into one self-contained HTML file: inline script, inline
 * assets as data URLs, and a CSP that forbids every network request. The same
 * file is what the sidebar previews and what the user exports and shares.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadLedger, loadManifest, paths, RUNTIMES, type GameManifest, type RuntimeId } from './project.ts'
import { mimeOf, sha256, StudioError, writeFileAtomic } from './util.ts'
import { recordVersion } from './versions.ts'

export interface BuildResult {
  artifact: string
  buildId: string
  bytes: number
  title: string
  builtAt: string
}

const MAX_ARTIFACT_BYTES = 24 * 1024 * 1024

const CSP = [
  "default-src 'none'",
  "img-src data: blob:",
  "media-src data: blob:",
  "font-src data:",
  "style-src 'unsafe-inline'",
  "script-src 'unsafe-inline'",
  "connect-src 'none'",
  "form-action 'none'",
].join('; ')

const STYLE = 'html,body{margin:0;height:100%;overflow:hidden;background:#000}'
  + 'canvas{display:block;width:100vw;height:100vh;touch-action:none;outline:none}'

const RUNTIME_FILES: Record<RuntimeId, URL> = {
  // Built by scripts/build.mjs; resolves to <package>/lib/vendor from both src/ and lib/.
  three: new URL('../lib/vendor/three.js', import.meta.url),
}

async function runtimeScripts(manifest: GameManifest): Promise<string[]> {
  const scripts: string[] = []
  for (const id of manifest.runtime ?? []) {
    if (!(RUNTIMES as readonly string[]).includes(id)) {
      throw new StudioError(`Unknown runtime "${id}" in game.json; available: ${RUNTIMES.join(', ')}`, 'BAD_MANIFEST')
    }
    try { scripts.push(await readFile(RUNTIME_FILES[id], 'utf8')) }
    catch { throw new StudioError(`Runtime "${id}" is missing from this dsh-game-studio install`, 'MISSING_RUNTIME') }
  }
  return scripts
}

/**
 * The exact `<script>` element a build inlines for a runtime, so the game wall
 * can keep one shared copy instead of one per 3D game.
 */
export async function runtimeTag(id: RuntimeId): Promise<string> {
  return `<script>${inlineSafe(await readFile(RUNTIME_FILES[id], 'utf8'))}</script>`
}

/** Keep inline JSON and code from closing the script element early. */
function inlineSafe(text: string): string {
  return text.replace(/<\/(script)/giu, '<\\/$1').replace(/<!--/gu, '<\\!--')
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

export async function renderHtml(dir: string, manifest: GameManifest): Promise<string> {
  const assets: Record<string, string> = {}
  for (const [slot, spec] of Object.entries(manifest.slots)) {
    const path = join(dir, spec.file)
    let bytes: Buffer
    try { bytes = await readFile(path) }
    catch { throw new StudioError(`Asset for slot "${slot}" is missing: ${spec.file}`, 'MISSING_ASSET') }
    assets[slot] = `data:${mimeOf(spec.file)};base64,${bytes.toString('base64')}`
  }
  let code: string
  try { code = await readFile(paths.code(dir), 'utf8') }
  catch { throw new StudioError(`game.js is missing in ${dir}`, 'MISSING_CODE') }
  // `custom`: the slot holds the user's own art (generated, imported or edited), not the template's.
  // A template that draws its default look in code switches to the file only then.
  let ledger: Awaited<ReturnType<typeof loadLedger>> | undefined
  try { ledger = await loadLedger(dir) } catch { ledger = undefined }
  const game = {
    title: manifest.title,
    rules: manifest.rules,
    slots: Object.fromEntries(Object.entries(manifest.slots).map(([slot, spec]) => [slot, {
      tile: spec.tile === true,
      custom: ledger?.assets[slot] !== undefined && ledger.assets[slot]!.source !== 'template',
    }])),
    assets,
  }
  const runtimes = await runtimeScripts(manifest)
  return [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    `<title>${escapeHtml(manifest.title)}</title>`,
    `<style>${STYLE}</style></head><body><canvas id="game" tabindex="0"></canvas>`,
    ...runtimes.map(script => `<script>${inlineSafe(script)}</script>`),
    `<script>window.GAME=${inlineSafe(JSON.stringify(game))};</script>`,
    `<script>${inlineSafe(code)}</script>`,
    '</body></html>',
    '',
  ].join('\n')
}

/** Build the game; a build that changed anything is kept as a version described by `note`. */
export async function buildProject(dir: string, note = 'Built'): Promise<BuildResult> {
  const manifest = await loadManifest(dir)
  const html = await renderHtml(dir, manifest)
  const bytes = Buffer.byteLength(html)
  if (bytes > MAX_ARTIFACT_BYTES) {
    throw new StudioError(`Build is ${(bytes / 1048576).toFixed(1)} MB; the limit is ${MAX_ARTIFACT_BYTES / 1048576} MB. Use smaller assets.`, 'TOO_LARGE')
  }
  await writeFileAtomic(paths.artifact(dir), html)
  const result: BuildResult = {
    artifact: paths.artifact(dir),
    buildId: sha256(html).slice(0, 12),
    bytes,
    title: manifest.title,
    builtAt: new Date().toISOString(),
  }
  await recordVersion(dir, result, note)
  return result
}
