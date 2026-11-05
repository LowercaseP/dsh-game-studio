/* Lantern Isle — a 60-second 3D voxel collect-and-dodge game, the "voxel"
 * template of dsh-game-studio. Classic script: the page provides window.THREE
 * (three.js) and window.GAME = { title, rules, slots: { slot: { tile, custom } },
 * assets: { slot: data URL } }. Characters and ground are drawn in code until a
 * slot holds the user's own art (slots[slot].custom); then that image is used:
 * camera-facing sprites for characters, a repeating texture for the ground. */
(function () {
  'use strict';

  var GAME = window.GAME || {};
  var canvas = document.getElementById('game');
  var parentWindow = window.parent && window.parent !== window ? window.parent : null;

  function post(message) {
    if (!parentWindow) return;
    message.source = 'dsh-game-studio';
    try { parentWindow.postMessage(message, '*'); } catch (e) { /* the host may be gone */ }
  }
  function reportError(text) { post({ type: 'error', message: String(text).slice(0, 300) }); }
  window.addEventListener('error', function (event) { reportError(event.message || event.error || 'error'); });
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    reportError((reason && reason.message) || reason || 'unhandled rejection');
  });

  /* 1. RULES — every gameplay value lives here, read from GAME.rules (game.json)
   * with these defaults; a wrong type falls back to the default. Distances are
   * world units: one ground block is 1 unit. */
  var DEFAULTS = {
    duration: 60,            // seconds per round
    hearts: 3,               // hits the hero can take
    heroSpeed: 6.5,          // units per second
    enemySpeed: 2.6,         // starting chase speed
    enemySpeedGrowth: 0.05,  // added to enemy speed every second
    enemySpawnEvery: 5,      // seconds between new enemies
    maxEnemies: 6,
    maxPickups: 6,           // lanterns on the island at once
    heroSize: 1.9,           // height in units
    enemySize: 1.7,
    pickupSize: 1.3,
    shield: { enabled: true, every: 5, seconds: 4 }, // every N lanterns, N seconds of safety
    worldSize: 34,           // island diameter in blocks
    seed: 7,                 // island shape
    palette: {
      skyTop: '#1d2550', skyBottom: '#e58a6a', fog: '#6f5a7e', grass: '#6bab5c',
      dirt: '#8b6446', sand: '#e6cf96', water: '#3f7fb3', accent: '#ffc463'
    }
  };

  function merge(fallback, value) {
    if (typeof fallback === 'number') return typeof value === 'number' && isFinite(value) ? value : fallback;
    if (typeof fallback === 'string') return typeof value === 'string' && value ? value : fallback;
    if (typeof fallback === 'boolean') return typeof value === 'boolean' ? value : fallback;
    var out = {};
    for (var key in fallback) out[key] = merge(fallback[key], value && typeof value === 'object' ? value[key] : undefined);
    return out;
  }
  var R = merge(DEFAULTS, GAME.rules || {});
  var SLOTS = GAME.slots || {};
  var ASSETS = GAME.assets || {};
  var TITLE = GAME.title || 'Lantern Isle';
  function customArt(slot) { return !!(SLOTS[slot] && SLOTS[slot].custom && ASSETS[slot]); }

  /* 2. RENDERER — fail readably when WebGL is unavailable. */
  var THREE = window.THREE;
  var renderer;
  try {
    if (!THREE) throw new Error('the three.js runtime is missing');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    var note = document.createElement('div');
    note.textContent = 'This game needs WebGL, which is not available here (' + (error && error.message || error) + ').';
    note.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;'
      + 'color:#fff;font:16px system-ui,sans-serif;text-align:center;background:#1d2550';
    document.body.appendChild(note);
    reportError('WebGL unavailable: ' + (error && error.message || error));
    window.__gameState = function () { return { phase: 'error', score: 0, renderer: 'none' }; };
    return;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);
  canvas.style.background = 'linear-gradient(to bottom,' + R.palette.skyTop + ' 0%,' + R.palette.skyTop + ' 18%,' + R.palette.skyBottom + ' 100%)';

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(R.palette.fog, 30, 90);
  var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);

  /* 3. HELPERS */
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(Math.round(R.seed) * 2654435761);
  var hashSeed = Math.round(R.seed) * 374761393;
  function hash2(x, z) {
    var h = (x * 374761393 + z * 668265263 + hashSeed) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function valueNoise(x, z) {
    var xi = Math.floor(x), zi = Math.floor(z), xf = smooth(x - xi), zf = smooth(z - zi);
    return lerp(lerp(hash2(xi, zi), hash2(xi + 1, zi), xf), lerp(hash2(xi, zi + 1), hash2(xi + 1, zi + 1), xf), zf);
  }
  function fbm(x, z) { return valueNoise(x, z) * 0.62 + valueNoise(x * 2.1 + 17, z * 2.1 + 5) * 0.28 + valueNoise(x * 4.3 + 3, z * 4.3 + 11) * 0.1; }
  function color(hex) { return new THREE.Color(hex); }

  /** A small radial-gradient texture drawn on a 2D canvas (glows, shadows, the moon). */
  function radialTexture(stops, size) {
    var c = document.createElement('canvas');
    c.width = c.height = size || 128;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(c.width / 2, c.height / 2, 0, c.width / 2, c.height / 2, c.width / 2);
    for (var i = 0; i < stops.length; i++) grad.addColorStop(stops[i][0], stops[i][1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    var texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  var GLOW = radialTexture([[0, 'rgba(255,230,160,1)'], [0.25, 'rgba(255,196,99,0.55)'], [1, 'rgba(255,170,60,0)']]);
  var BLOB = radialTexture([[0, 'rgba(0,0,0,0.5)'], [0.6, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']], 64);

  /**
   * Merge boxes into one mesh with vertex colours, so a whole character is one
   * draw call. Each box is [x, y, z, w, h, d, colour, glow]; glowing boxes go
   * into a second, unlit mesh.
   */
  function voxelModel(boxes) {
    var parts = [[], []];
    for (var i = 0; i < boxes.length; i++) parts[boxes[i][7] ? 1 : 0].push(boxes[i]);
    var group = new THREE.Group();
    for (var p = 0; p < 2; p++) {
      if (!parts[p].length) continue;
      var positions = [], normals = [], colors = [], indices = [];
      for (var b = 0; b < parts[p].length; b++) {
        var box = parts[p][b];
        var geo = new THREE.BoxGeometry(box[3], box[4], box[5]);
        geo.translate(box[0], box[1], box[2]);
        var pos = geo.attributes.position, nor = geo.attributes.normal, base = positions.length / 3;
        var tint = color(box[6]);
        for (var v = 0; v < pos.count; v++) {
          positions.push(pos.getX(v), pos.getY(v), pos.getZ(v));
          normals.push(nor.getX(v), nor.getY(v), nor.getZ(v));
          colors.push(tint.r, tint.g, tint.b);
        }
        var index = geo.index.array;
        for (var k = 0; k < index.length; k++) indices.push(base + index[k]);
        geo.dispose();
      }
      var merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      merged.setIndex(indices);
      merged.computeBoundingSphere();
      var material = p === 0 ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshBasicMaterial({ vertexColors: true });
      var mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = p === 0;
      group.add(mesh);
    }
    return group;
  }

  /* 4. ISLAND — a heightmap of stacked blocks inside a noisy circle. */
  var N = clamp(Math.round(R.worldSize), 16, 64);
  var HALF = N / 2;
  var WATER_Y = 0.55;
  var height = new Int8Array(N * N);   // 0 = water, otherwise blocks stacked from y = 0
  var sandy = new Uint8Array(N * N);
  var solid = new Uint8Array(N * N);   // trees and rocks block movement
  for (var gx = 0; gx < N; gx++) {
    for (var gz = 0; gz < N; gz++) {
      var wx = gx - HALF + 0.5, wz = gz - HALF + 0.5;
      var d = Math.sqrt(wx * wx + wz * wz) / HALF;
      var n = fbm(gx * 0.11, gz * 0.11);
      var land = 1 - d + (n - 0.5) * 0.42;
      var i0 = gx * N + gz;
      if (land < 0.07 && d > 0.25) continue;
      var h = 1 + Math.floor(clamp(land, 0, 1) * 3.2 + n * 1.4);
      height[i0] = clamp(h, 1, 5);
      if (land < 0.17 && d > 0.3) { height[i0] = 1; sandy[i0] = 1; }
    }
  }
  function cell(x, z) {
    var cx = Math.floor(x + HALF), cz = Math.floor(z + HALF);
    return cx < 0 || cz < 0 || cx >= N || cz >= N ? -1 : cx * N + cz;
  }
  function groundAt(x, z) { var c = cell(x, z); return c < 0 ? 0 : height[c]; }
  function walkable(x, z) { var c = cell(x, z); return c >= 0 && height[c] > 0 && !solid[c]; }
  function cellCenter(index) { return { x: Math.floor(index / N) - HALF + 0.5, z: (index % N) - HALF + 0.5 }; }
  function isShore(index) {
    var cx = Math.floor(index / N), cz = index % N;
    if (!height[index]) return false;
    for (var dx = -1; dx <= 1; dx++) for (var dz = -1; dz <= 1; dz++) {
      var x = cx + dx, z = cz + dz;
      if (x < 0 || z < 0 || x >= N || z >= N || !height[x * N + z]) return true;
    }
    return false;
  }

  // Decoration: trees and rocks, never in the middle where the hero starts.
  var trees = [], rocks = [];
  for (var t = 0; t < N * N; t++) {
    if (!height[t] || sandy[t] || isShore(t)) continue;
    var at = cellCenter(t);
    if (Math.abs(at.x) < 3 && Math.abs(at.z) < 3) continue;
    var r = rand();
    if (r < 0.032) { trees.push(t); solid[t] = 1; } else if (r < 0.05) { rocks.push(t); solid[t] = 1; }
  }

  var BOX = new THREE.BoxGeometry(1, 1, 1);
  var dummy = new THREE.Object3D();
  function blockMesh(count, material) {
    var mesh = new THREE.InstancedMesh(BOX, material, Math.max(1, count));
    mesh.count = 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  function addBlock(mesh, x, y, z, sx, sy, sz, tint) {
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(mesh.count, dummy.matrix);
    mesh.setColorAt(mesh.count, tint);
    mesh.count++;
  }

  var columns = 0, stacked = 0;
  for (var q = 0; q < N * N; q++) if (height[q]) { columns++; stacked += height[q]; }
  var groundTexture = null;
  if (customArt('background')) {
    groundTexture = new THREE.TextureLoader().load(ASSETS.background);
    groundTexture.colorSpace = THREE.SRGBColorSpace;
  }
  var tops = blockMesh(columns, new THREE.MeshLambertMaterial(groundTexture ? { map: groundTexture } : {}));
  var sides = blockMesh(stacked, new THREE.MeshLambertMaterial());
  var tint = new THREE.Color();
  for (var s = 0; s < N * N; s++) {
    if (!height[s]) continue;
    var c0 = cellCenter(s), top = height[s];
    var jitter = 0.9 + hash2(s, 99) * 0.14;
    if (groundTexture) tint.setRGB(jitter, jitter, jitter);
    else tint.set(sandy[s] ? R.palette.sand : R.palette.grass).multiplyScalar(jitter);
    addBlock(tops, c0.x, top - 0.5, c0.z, 1, 1, 1, tint);
    for (var y = 0; y < top - 1; y++) {
      tint.set(sandy[s] ? R.palette.sand : R.palette.dirt).multiplyScalar((0.75 + y * 0.06) * (0.92 + hash2(s, y) * 0.1));
      addBlock(sides, c0.x, y + 0.5, c0.z, 1, 1, 1, tint);
    }
  }
  tops.instanceMatrix.needsUpdate = sides.instanceMatrix.needsUpdate = true;

  var trunks = blockMesh(trees.length * 2, new THREE.MeshLambertMaterial());
  var leaves = blockMesh(trees.length * 13, new THREE.MeshLambertMaterial());
  var stones = blockMesh(rocks.length * 2, new THREE.MeshLambertMaterial());
  var LEAF_TONES = ['#3f7d4a', '#4b8f50', '#356b45', '#5a9a52'];
  trees.forEach(function (index, k) {
    var p = cellCenter(index), base = height[index];
    addBlock(trunks, p.x, base + 0.6, p.z, 0.42, 1.2, 0.42, tint.set('#6b4a32'));
    var tall = 1.3 + (k % 2) * 0.5;
    for (var lx = -1; lx <= 1; lx++) for (var lz = -1; lz <= 1; lz++) {
      if (lx && lz && hash2(index, lx * 3 + lz) < 0.5) continue;
      addBlock(leaves, p.x + lx * 0.62, base + tall + 0.45, p.z + lz * 0.62, 0.66, 0.66, 0.66, tint.set(LEAF_TONES[(k + lx + lz + 4) % 4]));
    }
    addBlock(leaves, p.x, base + tall + 1.05, p.z, 0.7, 0.62, 0.7, tint.set(LEAF_TONES[k % 4]));
  });
  rocks.forEach(function (index, k) {
    var p = cellCenter(index), base = height[index];
    addBlock(stones, p.x, base + 0.3, p.z, 0.8, 0.6, 0.7, tint.set('#8a8f98'));
    if (k % 2) addBlock(stones, p.x + 0.15, base + 0.75, p.z - 0.1, 0.45, 0.35, 0.45, tint.set('#a3a8b0'));
  });
  [trunks, leaves, stones].forEach(function (mesh) { mesh.instanceMatrix.needsUpdate = true; });

  // Water and a darker sea floor beneath it.
  var water = new THREE.Mesh(new THREE.CircleGeometry(N * 2.2, 48), new THREE.MeshLambertMaterial({ color: R.palette.water, transparent: true, opacity: 0.86 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  scene.add(water);
  var floor = new THREE.Mesh(new THREE.CircleGeometry(N * 2.2, 32), new THREE.MeshBasicMaterial({ color: color(R.palette.water).multiplyScalar(0.35) }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.6;
  scene.add(floor);

  // Lights: a cool sky, a warm low sun, and a hint of fill.
  scene.add(new THREE.HemisphereLight('#8a8cff', '#4a3428', 0.95));
  var sun = new THREE.DirectionalLight('#ffb27a', 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -22;
  sun.shadow.camera.right = sun.shadow.camera.top = 22;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);

  // Sky dressing: stars high up and a low moon, both far away.
  var starGeo = new THREE.BufferGeometry(), starPos = [];
  for (var st = 0; st < 260; st++) {
    var theta = rand() * Math.PI * 2, phi = 0.12 + rand() * 0.55;
    starPos.push(Math.cos(theta) * Math.cos(phi) * 180, Math.sin(phi) * 180, Math.sin(theta) * Math.cos(phi) * 180);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  var stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#fff4dc', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
  scene.add(stars);
  var moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture([[0, '#fffbe8'], [0.42, '#fff1c2'], [0.5, 'rgba(255,230,170,0.35)'], [1, 'rgba(255,220,150,0)']]), fog: false, depthWrite: false }));
  moon.scale.set(26, 26, 1);
  scene.add(moon);

  // Fireflies drifting over the island.
  var FLY_COUNT = 36, flyGeo = new THREE.BufferGeometry(), flyBase = [];
  for (var f = 0; f < FLY_COUNT; f++) flyBase.push((rand() - 0.5) * N * 0.8, 2 + rand() * 3, (rand() - 0.5) * N * 0.8, rand() * 10);
  flyGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(FLY_COUNT * 3), 3));
  var flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ map: GLOW, color: '#ffe59a', size: 0.5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(flies);

  /* 5. CHARACTERS — voxel models by default, the user's art as sprites. */
  var HERO_BOXES = [
    [-1.2, 1, -1, 1, 2, 1, '#4a2a1a'], [1.2, 1, -1, 1, 2, 1, '#4a2a1a'], [-1.2, 1, 1.2, 1, 2, 1, '#4a2a1a'], [1.2, 1, 1.2, 1, 2, 1, '#4a2a1a'],
    [0, 3, 0, 4, 2.6, 5, '#e8803a'], [0, 3, 2.4, 2.6, 2.2, 0.6, '#f6e7d0'],
    [0, 6, 2, 3.8, 3.2, 3.4, '#e8803a'], [0, 5.25, 3.95, 2, 1.4, 1, '#f6e7d0'], [0, 5.7, 4.5, 0.7, 0.55, 0.4, '#2b1a14'],
    [-0.95, 6.55, 3.72, 0.6, 0.8, 0.15, '#22140f'], [0.95, 6.55, 3.72, 0.6, 0.8, 0.15, '#22140f'],
    [-1.25, 8.4, 2, 1.2, 1.6, 0.9, '#e8803a'], [1.25, 8.4, 2, 1.2, 1.6, 0.9, '#e8803a'],
    [-1.25, 8.2, 2.48, 0.6, 1, 0.15, '#f6e7d0'], [1.25, 8.2, 2.48, 0.6, 1, 0.15, '#f6e7d0'],
    [0, 4.65, 0.8, 4.3, 0.9, 4.2, '#c8323c'], [1.5, 3.6, 2.85, 0.9, 1.8, 0.4, '#c8323c'],
    [0, 3.8, -3.2, 1.6, 1.6, 2.6, '#e8803a'], [0, 4.25, -4.8, 1.5, 1.5, 1.1, '#f6e7d0'],
    [-2.6, 3, 1.4, 0.4, 2.4, 0.4, '#5a3a22'], [-2.6, 1.5, 1.4, 1, 1.2, 1, '#ffd27a', true]
  ];
  var ENEMY_BOXES = [
    [-1.5, 0.4, 0, 1.2, 0.8, 1.6, '#2a1830'], [1.5, 0.4, 0, 1.2, 0.8, 1.6, '#2a1830'],
    [0, 3, 0, 5, 4.6, 5, '#3b2448'], [0, 3, 0, 5.4, 1, 5.4, '#4a2d5a'],
    [-1.1, 3.9, 2.55, 1.1, 0.85, 0.2, '#ffd34d', true], [1.1, 3.9, 2.55, 1.1, 0.85, 0.2, '#ffd34d', true],
    [0, 2.4, 2.55, 2.4, 0.45, 0.2, '#ff9f45', true]
  ];
  [[3, 3.8, 0], [-3, 3.8, 0], [0, 3.8, 3], [0, 3.8, -3], [2.2, 5.8, 1.5], [-2.2, 5.8, -1.5], [0, 5.9, 0], [2.6, 1.8, -2.4], [-2.6, 1.8, 2.4], [1.8, 5.6, -2.2]].forEach(function (o) {
    var horizontal = Math.abs(o[0]) > Math.abs(o[2]);
    ENEMY_BOXES.push([o[0], o[1], o[2], horizontal ? 1.6 : 0.55, o[1] > 5 ? 1.6 : 0.55, horizontal ? 0.55 : 1.6, '#6b3e7a']);
    ENEMY_BOXES.push([o[0] * 1.18, o[1] + (o[1] > 5 ? 0.6 : 0), o[2] * 1.18, 0.4, 0.4, 0.4, '#b98ad0']);
  });
  var LANTERN_BOXES = [
    [0, 0.35, 0, 2.4, 0.7, 2.4, '#5a3a22'], [0, 2.2, 0, 1.9, 2.8, 1.9, '#ffd27a', true],
    [-1.05, 2.2, -1.05, 0.35, 2.8, 0.35, '#5a3a22'], [1.05, 2.2, -1.05, 0.35, 2.8, 0.35, '#5a3a22'],
    [-1.05, 2.2, 1.05, 0.35, 2.8, 0.35, '#5a3a22'], [1.05, 2.2, 1.05, 0.35, 2.8, 0.35, '#5a3a22'],
    [0, 3.9, 0, 2.7, 0.6, 2.7, '#5a3a22'], [0, 4.45, 0, 1.2, 0.5, 1.2, '#5a3a22'], [0, 4.95, 0, 0.45, 0.5, 0.45, '#c9a24a']
  ];
  var MODEL_HEIGHT = { hero: 9.2, enemy: 6.6, pickup: 5.2 };
  /** Every character's look in one place: the game and the studio's thumbnails both draw from here. */
  var MODELS = { hero: HERO_BOXES, enemy: ENEMY_BOXES, pickup: LANTERN_BOXES };
  var spriteTextures = {};
  function spriteTexture(slot) {
    if (!spriteTextures[slot]) {
      var texture = new THREE.TextureLoader().load(ASSETS[slot]);
      texture.colorSpace = THREE.SRGBColorSpace;
      spriteTextures[slot] = texture;
    }
    return spriteTextures[slot];
  }

  /** One character: a body (voxel model or sprite) on a holder that stands on the ground, with a blob shadow. */
  function makeCharacter(slot, size, boxes) {
    var holder = new THREE.Group();
    var body;
    if (customArt(slot)) {
      body = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture(slot), alphaTest: 0.08 }));
      body.center.set(0.5, 0.02);
      body.scale.set(size * 1.25, size * 1.25, 1);
      body.userData.sprite = true;
    } else {
      body = voxelModel(boxes);
      body.scale.setScalar(size / MODEL_HEIGHT[slot]);
    }
    holder.add(body);
    var shadow = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.9, size * 0.9), new THREE.MeshBasicMaterial({ map: BLOB, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    holder.add(shadow);
    holder.userData.body = body;
    scene.add(holder);
    return holder;
  }

  var hero = { x: 0, z: 0, y: groundAt(0, 0), vx: 0, vz: 0, facing: 0, node: makeCharacter('hero', R.heroSize, MODELS.hero) };
  var heroMode = customArt('hero') ? 'sprite' : 'voxel';
  var bubble = new THREE.Mesh(new THREE.SphereGeometry(R.heroSize * 0.78, 20, 14), new THREE.MeshBasicMaterial({ color: '#9fe8ff', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
  bubble.position.y = R.heroSize * 0.5;
  bubble.visible = false;
  hero.node.add(bubble);

  var enemies = [], pickups = [];

  // Pickup burst particles, pooled.
  var SPARKS = 72, sparks = [];
  var sparkMesh = new THREE.InstancedMesh(BOX, new THREE.MeshBasicMaterial({ color: R.palette.accent }), SPARKS);
  sparkMesh.frustumCulled = false;
  for (var sp = 0; sp < SPARKS; sp++) { sparks.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }); }
  scene.add(sparkMesh);
  function burst(x, y, z) {
    var made = 0;
    for (var i = 0; i < SPARKS && made < 16; i++) {
      var p = sparks[i];
      if (p.life > 0) continue;
      var a = Math.random() * Math.PI * 2, up = 2 + Math.random() * 3;
      p.life = 0.6 + Math.random() * 0.4; p.x = x; p.y = y; p.z = z;
      p.vx = Math.cos(a) * (1 + Math.random() * 2); p.vz = Math.sin(a) * (1 + Math.random() * 2); p.vy = up;
      made++;
    }
  }

  /* 6. AUDIO — tiny synthesized blips, started on the first gesture. */
  var audio = null, muted = false;
  function blip(freq, duration, type, volume, slideTo) {
    if (muted) return;
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      var now = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
      gain.gain.setValueAtTime(volume || 0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(audio.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch (e) { /* audio is optional */ }
  }

  /* 7. HUD — DOM layered over the canvas. */
  function el(tag, css, parent) {
    var node = document.createElement(tag);
    node.style.cssText = css;
    (parent || document.body).appendChild(node);
    return node;
  }
  var FONT = 'font-family:system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;';
  var hud = el('div', 'position:fixed;inset:0;pointer-events:none;user-select:none;color:#fff;' + FONT
    + 'font-size:clamp(14px,2.4vmin,22px);text-shadow:0 2px 6px rgba(0,0,0,.45)');
  var pillCss = 'position:absolute;top:2.2vmin;padding:.45em .9em;border-radius:999px;background:rgba(14,18,40,.42);'
    + 'border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(6px);display:flex;gap:.6em;align-items:center;font-weight:700';
  var leftPill = el('div', pillCss + ';left:2.2vmin', hud);
  var heartsEl = el('span', 'color:#ff8a9a;letter-spacing:.08em', leftPill);
  var scoreEl = el('span', '', leftPill);
  var timerEl = el('div', pillCss + ';right:2.2vmin;font-variant-numeric:tabular-nums', hud);
  var shieldEl = el('div', 'position:absolute;left:2.2vmin;top:calc(2.2vmin + 2.6em);padding:.3em .8em;border-radius:999px;'
    + 'background:rgba(120,220,255,.25);border:1px solid rgba(160,235,255,.5);font-size:.8em;font-weight:700;display:none', hud);
  var card = el('div', 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;width:min(86vw,560px);'
    + 'padding:1.4em 1.2em;border-radius:22px;background:rgba(14,16,38,.5);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(8px)', hud);
  var cardTitle = el('div', 'font-size:2.3em;font-weight:800;letter-spacing:.02em;color:#ffe2a8;line-height:1.15', card);
  var cardBody = el('div', 'margin-top:.55em;opacity:.95;line-height:1.5', card);
  var cardHint = el('div', 'margin-top:1em;font-weight:700;color:#fff3cf', card);
  function showCard(title, body, hint) {
    card.style.display = 'block';
    cardTitle.textContent = title;
    cardBody.textContent = body;
    cardHint.textContent = hint;
  }

  /* 8. GAME STATE */
  var phase = 'title', paused = false, score = 0, best = 0, hearts = R.hearts, timeLeft = R.duration;
  var elapsed = 0, spawnTimer = 0, invulnerable = 0, shield = 0, sinceShield = 0, endedAt = 0, fps = 60;
  try { best = Number(window.localStorage.getItem('dsh-game-studio:voxel:best')) || 0; } catch (e) { best = 0; }

  function randomLand(minFromHero, shoreOnly) {
    for (var tries = 0; tries < 400; tries++) {
      var index = Math.floor(Math.random() * N * N);
      if (!height[index] || solid[index] || (shoreOnly && !isShore(index))) continue;
      var p = cellCenter(index);
      if (Math.hypot(p.x - hero.x, p.z - hero.z) < minFromHero) continue;
      return p;
    }
    return null;
  }
  function addPickup() {
    var p = randomLand(4, false);
    if (!p) return;
    var node = makeCharacter('pickup', R.pickupSize, MODELS.pickup);
    var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: R.palette.accent, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(R.pickupSize * 2.4, R.pickupSize * 2.4, 1);
    glow.position.y = R.pickupSize * 0.5;
    node.add(glow);
    pickups.push({ x: p.x, z: p.z, phase: Math.random() * 6, node: node, glow: glow });
  }
  function addEnemy() {
    var p = randomLand(9, true) || randomLand(7, false);
    if (!p) return;
    enemies.push({ x: p.x, z: p.z, y: groundAt(p.x, p.z), wobble: Math.random() * 6, node: makeCharacter('enemy', R.enemySize, MODELS.enemy) });
  }
  function clearEntities() {
    enemies.concat(pickups).forEach(function (e) { scene.remove(e.node); });
    enemies = [];
    pickups = [];
  }

  function setPhase(next) {
    phase = next;
    endedAt = performance.now();
    if (next === 'title') showCard(TITLE, 'Collect the lanterns, dodge the thorn creatures!', 'Press any key / tap to start');
    else if (next === 'playing') card.style.display = 'none';
    else if (next === 'won') showCard('Night falls safely', 'You collected ' + score + ' lantern' + (score === 1 ? '' : 's') + '. Best: ' + best, 'Press any key / tap to play again');
    else if (next === 'lost') showCard('Caught!', 'Lanterns: ' + score + '. Best: ' + best, 'Press any key / tap to try again');
    post({ type: 'state', phase: phase, score: score });
  }
  function start() {
    clearEntities();
    score = 0; hearts = R.hearts; timeLeft = R.duration; elapsed = 0; spawnTimer = 0;
    invulnerable = 0; shield = 0; sinceShield = 0; paused = false;
    hero.x = 0; hero.z = 0; hero.vx = hero.vz = 0;
    for (var i = 0; i < R.maxPickups; i++) addPickup();
    addEnemy(); addEnemy();
    blip(520, 0.12, 'triangle', 0.07, 780);
    setPhase('playing');
  }
  function finish(won) {
    if (score > best) { best = score; try { window.localStorage.setItem('dsh-game-studio:voxel:best', String(best)); } catch (e) { /* sandboxed */ } }
    blip(won ? 660 : 220, 0.5, won ? 'triangle' : 'sawtooth', 0.06, won ? 990 : 110);
    setPhase(won ? 'won' : 'lost');
  }
  function canRestart() { return performance.now() - endedAt > 600; }

  /* 9. INPUT — screen-aligned: right is +x, up is -z (the camera never turns). */
  var keys = {};
  var KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  window.addEventListener('keydown', function (event) {
    if (event.code === 'KeyM') { muted = !muted; return; }
    if (phase === 'playing' && event.code === 'KeyP') { paused = !paused; showPause(); return; }
    if (KEYMAP[event.code]) { keys[KEYMAP[event.code]] = true; event.preventDefault(); }
    if (phase !== 'playing' && canRestart()) start();
  });
  window.addEventListener('keyup', function (event) { if (KEYMAP[event.code]) keys[KEYMAP[event.code]] = false; });
  window.addEventListener('blur', function () { keys = {}; });
  function showPause() {
    if (paused) showCard('Paused', 'Press P to continue', '');
    else card.style.display = 'none';
  }
  var drag = null;
  canvas.addEventListener('pointerdown', function (event) {
    canvas.focus();
    if (phase !== 'playing') { if (canRestart()) start(); return; }
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0 };
    try { canvas.setPointerCapture(event.pointerId); } catch (e) { /* not captured */ }
  });
  canvas.addEventListener('pointermove', function (event) {
    if (!drag || event.pointerId !== drag.id) return;
    drag.dx = event.clientX - drag.x;
    drag.dy = event.clientY - drag.y;
  });
  function endDrag(event) { if (drag && event.pointerId === drag.id) drag = null; }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  function inputDirection() {
    var x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), z = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (drag) {
      var length = Math.hypot(drag.dx, drag.dy);
      if (length > 10) { x = drag.dx / length; z = drag.dy / length; }
    }
    var magnitude = Math.hypot(x, z);
    return magnitude > 0 ? { x: x / magnitude, z: z / magnitude } : { x: 0, z: 0 };
  }

  /** Move with sliding: try each axis on its own, and keep a body radius clear of blocked cells. */
  function moveOnIsland(entity, dx, dz, radius) {
    var nx = entity.x + dx;
    if (walkable(nx + Math.sign(dx) * radius, entity.z) && walkable(nx, entity.z)) entity.x = nx;
    var nz = entity.z + dz;
    if (walkable(entity.x, nz + Math.sign(dz) * radius) && walkable(entity.x, nz)) entity.z = nz;
  }

  /* 10. UPDATE */
  function update(dt, now) {
    if (phase === 'playing' && !paused) {
      elapsed += dt;
      timeLeft = Math.max(0, timeLeft - dt);
      invulnerable = Math.max(0, invulnerable - dt);
      shield = Math.max(0, shield - dt);

      var dir = inputDirection();
      hero.vx = lerp(hero.vx, dir.x * R.heroSpeed, Math.min(1, dt * 12));
      hero.vz = lerp(hero.vz, dir.z * R.heroSpeed, Math.min(1, dt * 12));
      moveOnIsland(hero, hero.vx * dt, hero.vz * dt, 0.3);
      if (Math.abs(hero.vx) + Math.abs(hero.vz) > 0.4) hero.facing = Math.atan2(hero.vx, hero.vz);

      spawnTimer += dt;
      if (spawnTimer >= R.enemySpawnEvery && enemies.length < R.maxEnemies) { spawnTimer = 0; addEnemy(); }
      var speed = R.enemySpeed + R.enemySpeedGrowth * elapsed;
      for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i], tx = hero.x - e.x, tz = hero.z - e.z, dist = Math.hypot(tx, tz) || 1;
        var ax = tx / dist, az = tz / dist;
        for (var j = 0; j < enemies.length; j++) {
          if (i === j) continue;
          var ox = e.x - enemies[j].x, oz = e.z - enemies[j].z, od = Math.hypot(ox, oz);
          if (od > 0 && od < 1.6) { ax += ox / od * 0.8; az += oz / od * 0.8; }
        }
        var al = Math.hypot(ax, az) || 1;
        if (shield > 0 && dist < 3) { ax = -tx / dist; az = -tz / dist; al = 1; }
        moveOnIsland(e, ax / al * speed * dt, az / al * speed * dt, 0.3);
        if (dist < (R.heroSize + R.enemySize) * 0.36) {
          if (shield > 0) { moveOnIsland(e, -tx / dist * 1.2, -tz / dist * 1.2, 0.3); }
          else if (invulnerable <= 0) {
            hearts -= 1;
            invulnerable = 1.4;
            moveOnIsland(hero, -tx / dist * 1.4, -tz / dist * 1.4, 0.3);
            blip(180, 0.25, 'square', 0.05, 90);
            if (hearts <= 0) { finish(false); return; }
          }
        }
      }
      for (var k = pickups.length - 1; k >= 0; k--) {
        var p = pickups[k];
        if (Math.hypot(p.x - hero.x, p.z - hero.z) < (R.heroSize + R.pickupSize) * 0.38) {
          scene.remove(p.node);
          pickups.splice(k, 1);
          score += 1;
          burst(p.x, groundAt(p.x, p.z) + R.pickupSize * 0.6, p.z);
          blip(880, 0.1, 'triangle', 0.06, 1320);
          post({ type: 'state', phase: phase, score: score });
          if (R.shield.enabled && R.shield.every > 0 && ++sinceShield >= R.shield.every) {
            sinceShield = 0;
            shield = R.shield.seconds;
            blip(440, 0.35, 'sine', 0.06, 1100);
          }
        }
      }
      while (pickups.length < R.maxPickups) addPickup();
      if (timeLeft <= 0) finish(true);
    }

    // Animate everything, also behind the cards.
    var t = now / 1000;
    hero.y = lerp(hero.y, groundAt(hero.x, hero.z), Math.min(1, dt * 14));
    var moving = Math.hypot(hero.vx, hero.vz) > 0.5 && phase === 'playing';
    var heroBody = hero.node.userData.body;
    hero.node.position.set(hero.x, hero.y + (moving ? Math.abs(Math.sin(t * 12)) * 0.12 : Math.sin(t * 2.4) * 0.03), hero.z);
    if (heroBody.userData.sprite) heroBody.material.rotation = moving ? Math.sin(t * 12) * 0.06 : 0;
    else heroBody.rotation.y = lerp(heroBody.rotation.y, hero.facing, Math.min(1, dt * 10));
    hero.node.visible = invulnerable <= 0 || Math.floor(t * 12) % 2 === 0;
    bubble.visible = shield > 0;
    bubble.material.opacity = 0.16 + Math.sin(t * 8) * 0.06;

    for (var m = 0; m < enemies.length; m++) {
      var en = enemies[m], body = en.node.userData.body;
      en.y = lerp(en.y, groundAt(en.x, en.z), Math.min(1, dt * 10));
      en.node.position.set(en.x, en.y + Math.abs(Math.sin(t * 6 + en.wobble)) * 0.1, en.z);
      if (!body.userData.sprite) body.rotation.y = Math.atan2(hero.x - en.x, hero.z - en.z) + Math.sin(t * 5 + en.wobble) * 0.15;
    }
    for (var n = 0; n < pickups.length; n++) {
      var pk = pickups[n], pb = pk.node.userData.body;
      pk.node.position.set(pk.x, groundAt(pk.x, pk.z) + 0.15 + Math.sin(t * 2.6 + pk.phase) * 0.14, pk.z);
      if (!pb.userData.sprite) pb.rotation.y = t * 0.9 + pk.phase;
      var pulse = 1 + Math.sin(t * 4 + pk.phase) * 0.12;
      pk.glow.scale.set(R.pickupSize * 2.4 * pulse, R.pickupSize * 2.4 * pulse, 1);
    }
    for (var q = 0; q < SPARKS; q++) {
      var s = sparks[q];
      if (s.life > 0) {
        s.life -= dt; s.vy -= 9 * dt;
        s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      }
      dummy.position.set(s.x, s.y, s.z);
      dummy.rotation.set(t * 3 + q, t * 2, 0);
      dummy.scale.setScalar(s.life > 0 ? 0.16 * Math.min(1, s.life * 2) : 0);
      dummy.updateMatrix();
      sparkMesh.setMatrixAt(q, dummy.matrix);
    }
    sparkMesh.instanceMatrix.needsUpdate = true;
    var fp = flyGeo.attributes.position;
    for (var w = 0; w < FLY_COUNT; w++) {
      var b = w * 4;
      fp.setXYZ(w, flyBase[b] + Math.sin(t * 0.4 + flyBase[b + 3]) * 1.6, flyBase[b + 1] + Math.sin(t * 1.1 + flyBase[b + 3]) * 0.5, flyBase[b + 2] + Math.cos(t * 0.35 + flyBase[b + 3]) * 1.6);
    }
    fp.needsUpdate = true;
    water.material.color.set(R.palette.water).multiplyScalar(0.94 + Math.sin(t * 0.8) * 0.04);
  }

  /* 11. CAMERA — a fixed angle that follows the hero; portrait screens pull back. */
  var PITCH = 47 * Math.PI / 180;
  var focus = new THREE.Vector3(0, groundAt(0, 0), 0);
  function cameraDistance() {
    var aspect = camera.aspect;
    return aspect >= 1 ? 31 : 31 + (1 - aspect) * 34;
  }
  function placeCamera(dt) {
    // Follow the hero all the way to the shore; narrow portrait screens would otherwise lose it.
    focus.x = lerp(focus.x, hero.x, Math.min(1, dt * 5));
    focus.z = lerp(focus.z, hero.z, Math.min(1, dt * 5));
    focus.y = lerp(focus.y, hero.y, Math.min(1, dt * 4));
    var distance = cameraDistance();
    camera.position.set(focus.x, focus.y + Math.sin(PITCH) * distance, focus.z + Math.cos(PITCH) * distance);
    camera.lookAt(focus.x, focus.y + 0.6, focus.z);
    scene.fog.near = distance * 1.05;
    scene.fog.far = distance * 2.4;
    sun.position.set(focus.x - 18, focus.y + 15, focus.z + 8);
    sun.target.position.copy(focus);
    moon.position.set(camera.position.x + 60, camera.position.y + 30, camera.position.z - 150);
    stars.position.set(camera.position.x, 0, camera.position.z);
  }

  function resize() {
    var width = window.innerWidth || 1, heightPx = window.innerHeight || 1;
    renderer.setSize(width, heightPx, false);
    camera.aspect = width / heightPx;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  /* 12. LOOP */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (dt > 0) fps = lerp(fps, 1 / dt, 0.05);
    try {
      update(dt, now);
      placeCamera(dt);
      heartsEl.textContent = '♥'.repeat(Math.max(0, hearts)) + '♡'.repeat(Math.max(0, R.hearts - hearts));
      scoreEl.textContent = '✦ ' + score;
      var seconds = Math.ceil(timeLeft);
      timerEl.textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
      shieldEl.style.display = shield > 0 ? 'block' : 'none';
      shieldEl.textContent = 'Shield ' + Math.ceil(shield) + 's';
      renderer.render(scene, camera);
    } catch (error) {
      reportError(error && error.message || error);
      throw error;
    }
    requestAnimationFrame(frame);
  }
  setPhase('title');
  requestAnimationFrame(frame);

  /** Whether the hero is inside the visible frame, for the template's own checks. */
  function heroOnScreen() {
    var v = new THREE.Vector3(hero.x, hero.y + R.heroSize * 0.5, hero.z).project(camera);
    return Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1;
  }

  /* 12b. CHARACTER RENDERS — a transparent close-up of every code-drawn character,
   * for the studio's asset thumbnails and playtest reports. Slots holding the
   * user's own art are skipped: their file already shows how they look. */
  var renderer3 = null;
  function renderSlots(size) {
    size = size || 256;
    if (!renderer3) {
      var c = document.createElement('canvas');
      renderer3 = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer3.setClearColor(0x000000, 0);
      renderer3.toneMapping = renderer.toneMapping;
      renderer3.toneMappingExposure = renderer.toneMappingExposure;
    }
    renderer3.setPixelRatio(1);
    renderer3.setSize(size, size, false);
    var out = {};
    Object.keys(MODELS).forEach(function (slot) {
      if (!SLOTS[slot] || customArt(slot)) return; // dropped slots and the user's own art are skipped
      var stage = new THREE.Scene();
      stage.add(new THREE.HemisphereLight('#c9d2ff', '#5b4434', 1.6));
      var key = new THREE.DirectionalLight('#ffe2c4', 2.2);
      key.position.set(-3, 5, 4);
      stage.add(key);
      var model = voxelModel(MODELS[slot]);
      stage.add(model);
      var box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3()), extent = box.getSize(new THREE.Vector3());
      var cam = new THREE.PerspectiveCamera(30, 1, 0.1, 500);
      var distance = Math.max(extent.x, extent.y, extent.z) / (2 * Math.tan(15 * Math.PI / 180)) * 1.25;
      cam.position.copy(center).add(new THREE.Vector3(0.55, 0.45, 1).normalize().multiplyScalar(distance));
      cam.lookAt(center);
      renderer3.render(stage, cam);
      out[slot] = renderer3.domElement.toDataURL('image/png');
      model.traverse(function (node) { if (node.geometry) node.geometry.dispose(); if (node.material) node.material.dispose(); });
    });
    return out;
  }
  window.__renderSlots = renderSlots;
  // Tell the studio sidebar how the characters look in this build.
  setTimeout(function () {
    try { post({ type: 'renders', renders: renderSlots(256) }); } catch (error) { reportError('character renders failed: ' + (error && error.message || error)); }
  }, 400);

  /* 13. STATE — read by the studio's checks and preview; x is world x, y is world z. */
  window.__gameState = function () {
    return {
      phase: phase, paused: paused, score: score, best: best,
      time: Math.round(timeLeft * 100) / 100, hearts: hearts, shield: Math.round(shield * 100) / 100,
      hero: { x: Math.round(hero.x * 100) / 100, y: Math.round(hero.z * 100) / 100 },
      pickups: pickups.map(function (p) { return { x: p.x, y: p.z }; }),
      enemies: enemies.map(function (e) { return { x: Math.round(e.x * 100) / 100, y: Math.round(e.z * 100) / 100 }; }),
      fps: Math.round(fps), renderer: 'webgl', heroMode: heroMode, world: { size: N }, heroOnScreen: heroOnScreen()
    };
  };
})();
