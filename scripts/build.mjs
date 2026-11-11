// Build the Host entry (lib/index.js, ESM, host packages external) and the
// browser module (lib/client.js) in the loader shape dsh-web requires:
// `window.__ModuleLoader__.load({ id, factory })`, React from the host.
import { readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

await rm(join(root, 'lib'), { recursive: true, force: true })

await build({
  entryPoints: [join(root, 'src/index.ts')],
  outfile: join(root, 'lib/index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  // Host packages come from the DSH installation; pngjs and undici ship as dependencies.
  external: ['@deepseek-ai/*', 'pngjs', 'undici', 'playwright-core'],
  logLevel: 'warning',
})

const client = await build({
  entryPoints: [join(root, 'src/client/index.tsx')],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react-dom'],
  logLevel: 'warning',
})
const source = client.outputFiles[0].text
if (/__CLIENT_INTERNALS_DO_NOT_USE|__SECRET_INTERNALS_DO_NOT_USE/u.test(source)) {
  throw new Error('Client bundle contains React internals; host React must remain external')
}
await writeFile(join(root, 'lib/client.js'), [
  `window.__ModuleLoader__.load({ id: ${JSON.stringify(manifest.name)}, factory: (require) => {`,
  'var module = { exports: {} }; var exports = module.exports;',
  source,
  'return module.exports; } });',
  '',
].join('\n'))
// Game runtimes a project can ask for in game.json `runtime`. Exported games
// cannot reach the network, so each is bundled into one classic script that
// the game build inlines ahead of game.js.
const three = JSON.parse(await readFile(join(root, 'node_modules/three/package.json'), 'utf8'))
await build({
  stdin: { contents: "import * as THREE from 'three'; window.THREE = THREE;", resolveDir: root, loader: 'js' },
  outfile: join(root, 'lib/vendor/three.js'),
  bundle: true,
  minify: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2020',
  legalComments: 'none',
  banner: { js: `/* three.js ${three.version} | MIT License | Copyright 2010-2025 three.js authors | https://threejs.org/ */` },
  logLevel: 'warning',
})
await writeFile(join(root, 'lib/vendor/three.LICENSE.txt'), await readFile(join(root, 'node_modules/three/LICENSE'), 'utf8'))
// The Rune runtime is optional: it needs a Rust toolchain, so it is bundled only when
// rune/build.sh has produced rune/dist. The wasm rides inside the script as base64.
let runeNote = ''
try {
  const wasm = await readFile(join(root, 'rune/dist/app_bg.wasm'))
  await build({
    stdin: {
      contents: "import init from './rune/dist/app.js'; window.RuneGame = { init };",
      resolveDir: root, loader: 'js',
    },
    outfile: join(root, 'lib/vendor/rune.js'),
    bundle: true,
    minify: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2020',
    legalComments: 'none',
    // A classic script has no import.meta; Rune only reads it to locate its full font faces,
    // which an offline build cannot fetch anyway (it keeps the embedded Latin cut).
    define: { 'import.meta.url': 'document.baseURI' },
    banner: { js: `/* Rune | MIT License | https://github.com/anomalyco/rune */\nwindow.RUNE_WASM=${JSON.stringify(wasm.toString('base64'))};` },
    logLevel: 'error',
  })
  runeNote = ` and lib/vendor/rune.js (${(wasm.length / 1048576).toFixed(1)} MB wasm)`
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
  runeNote = '; skipped lib/vendor/rune.js (run rune/build.sh first for the rune template)'
}
console.log(`built lib/index.js, lib/client.js and lib/vendor/three.js (three ${three.version})${runeNote}`)
