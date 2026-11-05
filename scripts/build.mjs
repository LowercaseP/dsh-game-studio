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
console.log(`built lib/index.js, lib/client.js and lib/vendor/three.js (three ${three.version})`)
