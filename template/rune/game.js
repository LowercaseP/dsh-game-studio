/* State Machine — "rune" starter. The game itself is Rust drawn by Rune
 * (github.com/anomalyco/rune), compiled to WebAssembly and inlined ahead of
 * this script as window.RuneGame and window.RUNE_WASM. This file only boots
 * it. Change gameplay through window.GAME.rules (game.json) and art through
 * the slots; the Rust source is rune/src/lib.rs in dsh-game-studio. */
(function () {
  'use strict';
  var state = { phase: 'loading', engine: 'rune' };
  window.__gameState = function () { return state; };

  function fail(message) {
    state = { phase: 'error', engine: 'rune', error: message };
    var box = document.createElement('div');
    box.textContent = message;
    box.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;'
      + 'padding:24px;text-align:center;color:#fff;font:16px system-ui,sans-serif;background:#111';
    document.body.appendChild(box);
  }

  if (!window.RuneGame || !window.RUNE_WASM) return fail('The Rune runtime is missing from this build.');

  if (!navigator.gpu) return fail('This game needs a browser with WebGPU (current Chrome, Edge or Safari).');

  var bin = atob(window.RUNE_WASM);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  window.RuneGame.init({ module_or_path: bytes }).catch(function (error) {
    console.error(error);
    fail('The game could not start: ' + String(error && error.message || error));
  });
})();
