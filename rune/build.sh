#!/usr/bin/env bash
# Build the Rune game runtime to WebAssembly: rune/dist/app.js + rune/dist/app_bg.wasm.
# `npm run build` then bundles both into lib/vendor/rune.js for the "rune" template.
# Needs: rustup (toolchain from rust-toolchain.toml), the wasm32-unknown-unknown target,
# wasm-bindgen-cli 0.2.129, and on Linux libxkbcommon-dev.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
cd "$here"
rustup target add wasm32-unknown-unknown >/dev/null
cargo build --release --target wasm32-unknown-unknown
target=${CARGO_TARGET_DIR:-$here/target}
rm -rf dist
wasm-bindgen --target web --out-dir dist --out-name app --no-typescript --remove-name-section --remove-producers-section \
  "$target/wasm32-unknown-unknown/release/dsh_rune_game.wasm"
if command -v wasm-opt >/dev/null; then wasm-opt -Oz --enable-bulk-memory --enable-nontrapping-float-to-int -o dist/app_bg.wasm dist/app_bg.wasm; fi
ls -la dist
