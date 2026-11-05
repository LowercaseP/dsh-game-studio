/* Lantern Meadow — "collector" starter. Vanilla JS, one classic
 * script. The page defines window.GAME = {title, rules, slots, assets}. */
(function () {
  'use strict';

  /* 1. SETUP — canvas, host config, defaults */
  var GAME = (typeof window !== 'undefined' && window.GAME) || {};

  // Fallback rules. Production/dev always pass these, but keep safe.
  var DEFAULTS = {
    duration: 60,
    hearts: 3,
    heroSpeed: 320,
    enemySpeed: 120,
    enemySpeedGrowth: 3,
    enemySpawnEvery: 4,
    maxEnemies: 8,
    maxPickups: 5,
    heroSize: 76,
    enemySize: 68,
    pickupSize: 44,
    shield: { enabled: false, every: 3, seconds: 4 }
  };

  /* 2. RULES — every gameplay value lives here, read from GAME.rules
   *    (falling back to DEFAULTS). Edit this section to change gameplay. */
  var R = resolveRules(GAME.rules || {}, DEFAULTS);
  function resolveRules(rules, def) {
    var out = {};
    var key;
    for (key in def) out[key] = def[key];
    for (key in rules) {
      if (key === 'shield') {
        if (rules[key] && typeof rules[key] === 'object') {
          out.shield = {
            enabled: !!rules[key].enabled,
            every: num(rules[key].every, def.shield.every),
            seconds: num(rules[key].seconds, def.shield.seconds)
          };
        }
        // Non-object shield values are ignored in favour of defaults.
      } else if (key in def) {
        out[key] = num(rules[key], def[key]);
      }
    }
    out.shield.every = Math.max(1, out.shield.every);
    out.shield.seconds = Math.max(0.5, out.shield.seconds);
    return out;
  }
  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  // Canvas: reuse an existing #game canvas, otherwise create one.
  var canvas = document.getElementById('game');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'game';
    canvas.tabIndex = 0;
    canvas.style.display = 'block';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.touchAction = 'none';
    canvas.style.webkitTapHighlightColor = 'transparent';
    canvas.style.outline = 'none';
    canvas.style.background = '#000';
    (document.body || document.documentElement).appendChild(canvas);
  }
  var ctx = canvas.getContext('2d');

  var ASSETS = GAME.assets || {};
  var SLOTS = GAME.slots || {};
  var TITLE = GAME.title || 'Lantern Meadow';

  var TAU = Math.PI * 2;
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };

  // World size: landscape 1280x720, portrait 720x1280.
  var world = { w: 1280, h: 720 };
  var dpr = 1;
  var fitScale = 1;
  var ox = 0;
  var oy = 0;

  /* 3. STATE */
  var phase = 'title';
  var time = 0;            // seconds remaining in "playing"
  var elapsed = 0;         // seconds since the round started
  var score = 0;
  var hearts = R.hearts;
  var shield = 0;          // seconds of shield remaining
  var shieldCount = 0;     // pickups collected since last shield grant
  var invuln = 0;          // seconds of post-hit invulnerability
  var shake = 0;           // screen shake amount (seconds remaining)
  var paused = false;
  var muted = false;
  var restartGuard = 0;    // guard after won/lost before restart allowed
  var spawnTimer = 0;
  var lastTime = 0;
  var fps = 0;
  var fpsAccum = 0;
  var fpsFrames = 0;

  var hero = { x: 0, y: 0, dir: 1, vx: 0, vy: 0 };
  var enemies = [];
  var pickups = [];
  var particles = [];
  var floaters = [];
  var joystick = null;     // { id, ox, oy, dx, dy } in CSS px

  var keys = Object.create(null);

  /* 4. ASSET LOADING + FALLBACKS */
  var images = { hero: null, enemy: null, pickup: null, background: null };
  var loading = { hero: false, enemy: false, pickup: false, background: false };
  var bgPattern = null;
  var assetsReady = 0;
  var SLOTS = GAME.slots || {};
  // The slot holds the user's own art (generated, imported or edited), not the template's.
  function customArt(key) { return !!(SLOTS[key] && SLOTS[key].custom && ASSETS[key]); }

  function loadImage(key, url) {
    if (!url) return;
    var img = new Image();
    loading[key] = true;
    img.onload = function () {
      images[key] = img;
      loading[key] = false;
      assetsReady++;
      if (key === 'background') buildBackground();
      imageSettled();
    };
    img.onerror = function () {
      // Never break: fallback shapes are drawn when images[key] is null.
      loading[key] = false;
      assetsReady++;
      imageSettled();
    };
    img.src = url;
  }

  function buildBackground() {
    bgPattern = null;
    if (!images.background) return;
    if (SLOTS.background && SLOTS.background.tile) {
      var tile = document.createElement('canvas');
      tile.width = images.background.naturalWidth || 512;
      tile.height = images.background.naturalHeight || 512;
      var tctx = tile.getContext('2d');
      tctx.drawImage(images.background, 0, 0, tile.width, tile.height);
      bgPattern = ctx.createPattern(tile, 'repeat');
    }
  }

  /* 5. AUDIO — WebAudio bleeps created on first gesture */
  var audio = null;
  function ensureAudio() {
    if (audio) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio = new AC();
      if (audio.state === 'suspended') { var p = audio.resume(); if (p && p.catch) p.catch(function () {}); }
    } catch (e) { audio = null; }
  }
  function tone(freq, dur, type, vol, slide) {
    if (!audio || muted) return;
    try {
      var t0 = audio.currentTime;
      var osc = audio.createOscillator();
      var gain = audio.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t0);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol || 0.08, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (e) { /* never throw */ }
  }
  var sfx = {
    blip: function () { tone(880, 0.08, 'sine', 0.06, 1320); },
    hurt: function () { tone(180, 0.22, 'sawtooth', 0.09, 70); },
    win: function () { tone(660, 0.1, 'sine', 0.07); setTimeout(function () { tone(880, 0.16, 'sine', 0.07); }, 90); },
    lose: function () { tone(300, 0.3, 'sawtooth', 0.08, 90); }
  };

  /* 6. INPUT */
  var MOVE_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'];

  document.addEventListener('keydown', function (e) {
    ensureAudio();
    var lower = (e.key || '').toLowerCase();
    if (lower === 'arrowup' || lower === 'arrowdown' || lower === 'arrowleft' || lower === 'arrowright' ||
        lower === ' ' || lower === 'spacebar' || lower === 'tab') {
      e.preventDefault();
    }

    // Global toggles.
    if (lower === 'm') { muted = !muted; return; }
    if ((lower === 'p' || lower === 'escape') && phase === 'playing') { paused = !paused; return; }

    // Any key starts / restarts (won & lost have a short guard).
    if (phase === 'title') { startGame(); return; }
    if (phase === 'won' || phase === 'lost') {
      if (restartGuard <= 0) startGame();
      return;
    }

    if (MOVE_KEYS.indexOf(lower) >= 0) keys[lower] = true;
  });
  document.addEventListener('keyup', function (e) {
    var lower = (e.key || '').toLowerCase();
    if (MOVE_KEYS.indexOf(lower) >= 0) keys[lower] = false;
  });

  function startGame() {
    phase = 'playing';
    time = R.duration;
    elapsed = 0;
    score = 0;
    hearts = R.hearts;
    shield = 0;
    shieldCount = 0;
    invuln = 0;
    shake = 0;
    paused = false;
    restartGuard = 0;
    spawnTimer = R.enemySpawnEvery * 0.5;
    enemies.length = 0;
    particles.length = 0;
    floaters.length = 0;
    hero.x = world.w / 2;
    hero.y = world.h / 2;
    hero.dir = 1;
    hero.vx = 0;
    hero.vy = 0;
    pickups.length = 0;
    while (pickups.length < R.maxPickups) spawnPickup();
    emitPhase();
  }

  function endGame(won) {
    phase = won ? 'won' : 'lost';
    paused = false;
    joystick = null;
    restartGuard = 0.5;
    if (won) sfx.win(); else sfx.lose();
    emitPhase();
  }

  /* 7. SPAWNING + HELPERS */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }

  function spawnPickup() {
    var p, tries = 0;
    do {
      p = { x: rand(R.pickupSize, world.w - R.pickupSize), y: rand(R.pickupSize, world.h - R.pickupSize) };
      tries++;
    } while (tries < 40 && dist(p.x, p.y, hero.x, hero.y) < R.pickupSize * 3 + R.heroSize);
    p.age = 0;
    pickups.push(p);
  }

  function spawnEnemy() {
    if (enemies.length >= R.maxEnemies) return;
    var side = Math.floor(rand(0, 4));
    var x, y;
    if (side === 0) { x = -R.enemySize; y = rand(0, world.h); }
    else if (side === 1) { x = world.w + R.enemySize; y = rand(0, world.h); }
    else if (side === 2) { x = rand(0, world.w); y = -R.enemySize; }
    else { x = rand(0, world.w); y = world.h + R.enemySize; }
    enemies.push({ x: x, y: y, vx: 0, vy: 0, wob: rand(0, TAU), hurt: 0 });
  }

  function addParticles(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = rand(0, TAU);
      var sp = rand(40, 160);
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.3, 0.7), age: 0, color: color, r: rand(2, 5) });
    }
  }

  function addFloater(x, y, text, color) {
    floaters.push({ x: x, y: y, text: text, color: color || '#ffffff', age: 0, life: 0.9 });
  }

  function collectPickup(i) {
    var p = pickups[i];
    pickups.splice(i, 1);
    score++;
    shieldCount++;
    if (R.shield.enabled && shieldCount >= R.shield.every) {
      shieldCount = 0;
      shield = R.shield.seconds;
    }
    addParticles(p.x, p.y, '#ffd66b', 14);
    addFloater(p.x, p.y - 20, '+1', '#fff3c4');
    sfx.blip();
    spawnPickup();
  }

  function hurtHero(fromX, fromY) {
    if (invuln > 0 || shield > 0) {
      knockEnemy(fromX, fromY);
      return;
    }
    hearts--;
    invuln = 1.2;
    shake = 0.35;
    sfx.hurt();
    knockEnemy(fromX, fromY);
    addParticles(hero.x, hero.y, '#ff8a6e', 10);
    if (hearts <= 0) {
      hearts = 0;
      endGame(false);
    }
  }

  function knockEnemy(ex, ey) {
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (dist(e.x, e.y, hero.x, hero.y) < R.enemySize + R.heroSize + 8) {
        var dx = e.x - hero.x, dy = e.y - hero.y;
        var d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        e.x += (dx / d) * 90;
        e.y += (dy / d) * 90;
        e.hurt = 0.3;
        e.vx = (dx / d) * 420;
        e.vy = (dy / d) * 420;
      }
    }
  }

  /* 8. UPDATE */
  function update(dt) {
    if (restartGuard > 0) restartGuard -= dt;

    updateParticles(dt);
    updateFloaters(dt);
    for (var i = 0; i < pickups.length; i++) pickups[i].age += dt;

    if (phase !== 'playing') return;

    time -= dt;
    elapsed += dt;
    if (time <= 0) { time = 0; endGame(true); return; }

    // --- Movement input: WASD/arrows + virtual joystick ----------
    var mx = 0, my = 0;
    if (keys['arrowleft'] || keys['a']) mx -= 1;
    if (keys['arrowright'] || keys['d']) mx += 1;
    if (keys['arrowup'] || keys['w']) my -= 1;
    if (keys['arrowdown'] || keys['s']) my += 1;

    if (joystick) {
      var jd = Math.sqrt(joystick.dx * joystick.dx + joystick.dy * joystick.dy);
      if (jd > 10) {
        var jp = clamp((jd - 10) / 60, 0, 1);
        mx += (joystick.dx / jd) * jp;
        my += (joystick.dy / jd) * jp;
      }
    }
    var ml = Math.sqrt(mx * mx + my * my);
    if (ml > 1) { mx /= ml; my /= ml; } // normalized diagonals

    if (mx !== 0) hero.dir = mx > 0 ? 1 : -1;
    hero.x += mx * R.heroSpeed * dt;
    hero.y += my * R.heroSpeed * dt;
    hero.x = clamp(hero.x, R.heroSize * 0.5, world.w - R.heroSize * 0.5);
    hero.y = clamp(hero.y, R.heroSize * 0.5, world.h - R.heroSize * 0.5);

    if (invuln > 0) invuln -= dt;
    if (shake > 0) shake -= dt;
    if (shield > 0) shield = Math.max(0, shield - dt);

    // --- Pickups --------------------------------------------------
    var collectR = R.pickupSize * 0.5 + R.heroSize * 0.42;
    for (i = pickups.length - 1; i >= 0; i--) {
      var p = pickups[i];
      if (dist(p.x, p.y, hero.x, hero.y) < collectR) collectPickup(i);
    }

    // --- Enemies --------------------------------------------------
    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnEnemy(); spawnTimer = R.enemySpawnEvery; }

    var eSpeed = R.enemySpeed + R.enemySpeedGrowth * elapsed;
    var sepR = R.enemySize * 1.5;
    var k = 1 - Math.exp(-dt * 4);

    for (i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      e.wob += dt;
      if (e.hurt > 0) e.hurt -= dt;

      var dx = hero.x - e.x;
      var dy = hero.y - e.y;
      var d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      var dvx = (dx / d) * eSpeed;
      var dvy = (dy / d) * eSpeed;

      // Separation so enemies never stack.
      var sx = 0, sy = 0;
      for (var j = 0; j < enemies.length; j++) {
        if (j === i) continue;
        var o = enemies[j];
        var sdx = e.x - o.x, sdy = e.y - o.y;
        var sd = Math.max(1, Math.sqrt(sdx * sdx + sdy * sdy));
        if (sd < sepR) {
          var push = (sepR - sd) * 90;
          sx += (sdx / sd) * push;
          sy += (sdy / sd) * push;
        }
      }

      if (e.hurt > 0) {
        // Knockback: let the push from a hit decay quickly.
        e.vx *= Math.exp(-dt * 7);
        e.vy *= Math.exp(-dt * 7);
      } else {
        e.vx += ((dvx + sx) - e.vx) * k;
        e.vy += ((dvy + sy) - e.vy) * k;
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.x = clamp(e.x, -R.enemySize, world.w + R.enemySize);
      e.y = clamp(e.y, -R.enemySize, world.h + R.enemySize);

      // Collision with the hero.
      var hitR = (R.enemySize + R.heroSize) * 0.44;
      if (dist(e.x, e.y, hero.x, hero.y) < hitR) {
        if (shield > 0) {
          bounceEnemy(e);
        } else if (invuln <= 0) {
          hurtHero(e.x, e.y);
        }
      }
    }
  }

  function bounceEnemy(e) {
    var dx = e.x - hero.x, dy = e.y - hero.y;
    var d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    var nx = dx / d, ny = dy / d;
    var pushOut = (R.enemySize + R.heroSize) * 0.44 + 8 - d;
    e.x += nx * pushOut;
    e.y += ny * pushOut;
    e.vx = nx * 520;
    e.vy = ny * 520;
    addParticles(e.x, e.y, '#9fe8ff', 6);
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-dt * 3);
      p.vy *= Math.exp(-dt * 3);
    }
  }

  function updateFloaters(dt) {
    for (var i = floaters.length - 1; i >= 0; i--) {
      var f = floaters[i];
      f.age += dt;
      f.y -= 40 * dt;
      if (f.age >= f.life) floaters.splice(i, 1);
    }
  }

  /* 9. RENDER */
  function render() {
    // Letterbox: fill the whole canvas, then draw the world in a
    // uniform scale, centered. HUD is drawn in CSS pixels afterwards.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var shX = shake > 0 ? rand(-1, 1) * shake * 12 * dpr : 0;
    var shY = shake > 0 ? rand(-1, 1) * shake * 12 * dpr : 0;
    ctx.setTransform(dpr * fitScale, 0, 0, dpr * fitScale, dpr * ox + shX, dpr * oy + shY);

    drawBackground();

    var i;
    for (i = 0; i < pickups.length; i++) drawPickup(pickups[i]);
    drawHero();
    for (i = 0; i < enemies.length; i++) drawEnemy(enemies[i]);
    drawParticles();
    drawFloaters();

    // Screen-space overlays.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawJoystick();
    drawHUD();
    drawOverlay();
  }

  function drawBackground() {
    if (bgPattern) {
      ctx.fillStyle = bgPattern;
      ctx.fillRect(0, 0, world.w, world.h);
    } else if (images.background) {
      // Cover: scale to fill, centered crop.
      var img = images.background;
      var iw = img.naturalWidth || 512, ih = img.naturalHeight || 512;
      var sc = Math.max(world.w / iw, world.h / ih);
      ctx.drawImage(img, (world.w - iw * sc) / 2, (world.h - ih * sc) / 2, iw * sc, ih * sc);
    } else {
      // Fallback meadow.
      ctx.fillStyle = '#7fbf5a';
      ctx.fillRect(0, 0, world.w, world.h);
      ctx.fillStyle = '#76b352';
      ctx.beginPath();
      ctx.arc(world.w * 0.3, world.h * 0.3, 140, 0, TAU);
      ctx.arc(world.w * 0.7, world.h * 0.7, 170, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(world.w * 0.2, world.h * 0.5, 12, 0, TAU);
      ctx.arc(world.w * 0.8, world.h * 0.25, 12, 0, TAU);
      ctx.fill();
    }
    // Very subtle vignette keeps edges soft in cover mode.
    var g = ctx.createLinearGradient(0, 0, 0, world.h);
    g.addColorStop(0, 'rgba(20,40,20,0.10)');
    g.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(20,40,20,0.10)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, world.w, world.h);
  }

  function drawSprite(key, x, y, size, flip, alpha) {
    ctx.save();
    if (alpha) ctx.globalAlpha = alpha;
    // Soft elliptical shadow under the fitted sprite.
    ctx.fillStyle = 'rgba(16,42,20,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.34, size * 0.34, size * 0.10, 0, 0, TAU);
    ctx.fill();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    drawCharacter(ctx, key, size);
    ctx.restore();
  }

  /* The one place a character's look is drawn, centred on (0, 0) and about
   * `size` across, on any 2D context `g`. The game and the studio's close-ups
   * (sidebar thumbnails, playtest) both call it, so to draw a character in
   * code, draw it here and both stay in step. Slots holding the user's own
   * art (customArt) should keep drawing their image. */
  function drawCharacter(g, key, size) {
    if (images[key]) {
      var img = images[key];
      var iw = img.naturalWidth || img.width || size;
      var ih = img.naturalHeight || img.height || size;
      var ar = iw / ih;
      var dw, dh;
      if (ar >= 1) { dw = size; dh = size / ar; }
      else { dh = size; dw = size * ar; }
      g.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    } else {
      fallbackShape(g, key, size);
    }
  }

  function fallbackShape(g, key, size) {
    var colors = { hero: '#e85d3d', enemy: '#8a74d6', pickup: '#ffc94d' };
    g.fillStyle = colors[key] || '#cccccc';
    g.strokeStyle = '#2b1b12';
    g.lineWidth = Math.max(3, size * 0.05);
    g.beginPath();
    g.arc(0, 0, size * 0.42, 0, TAU);
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.arc(-size * 0.12, -size * 0.12, size * 0.12, 0, TAU);
    g.fill();
  }

  function drawHero() {
    var blink = invuln > 0 && Math.floor(invuln * 10) % 2 === 0;
    drawSprite('hero', hero.x, hero.y, R.heroSize, hero.dir === -1, blink ? 0.4 : 1);
    if (shield > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(140,220,255,0.9)';
      ctx.lineWidth = 5;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.arc(hero.x, hero.y, R.heroSize * 0.72, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawPickup(p) {
    var bob = Math.sin(p.age * 3) * 4;
    var s = R.pickupSize * (1 + Math.sin(p.age * 3 + 1) * 0.05);
    drawSprite('pickup', p.x, p.y + bob, s, false, 1);
  }

  function drawEnemy(e) {
    var squish = 1 + Math.sin(e.wob * 5) * 0.04;
    drawSprite('enemy', e.x, e.y, R.enemySize * squish, false, 1);
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var a = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < floaters.length; i++) {
      var f = floaters[i];
      var a = 1 - f.age / f.life;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function drawJoystick() {
    if (!joystick || phase !== 'playing') return;
    var r = 46;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(joystick.ox, joystick.oy, r, 0, TAU);
    ctx.stroke();
    var dx = joystick.dx, dy = joystick.dy;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d > r) { dx = dx / d * r; dy = dy / d * r; }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(joystick.ox + dx, joystick.oy + dy, 20, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawHUD() {
    var cssW = canvas.width / dpr, cssH = canvas.height / dpr;
    var s = clamp(Math.min(cssW, cssH) / 520, 0.85, 1.5);
    var pad = 14 * s;
    var fontSize = Math.round(22 * s);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'bold ' + fontSize + 'px system-ui, sans-serif';

    // Hearts (left) + score.
    var hx = pad;
    var hy = pad + fontSize * 0.5;
    for (var i = 0; i < R.hearts; i++) {
      drawHeart(hx, hy, fontSize * 0.55, i < hearts);
      hx += fontSize * 1.15;
    }
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 4;
    ctx.strokeText('Score ' + score, hx + 8, hy + 1);
    ctx.fillText('Score ' + score, hx + 8, hy);

    // Timer + shield (right).
    ctx.textAlign = 'right';
    var tx = cssW - pad;
    ctx.fillStyle = '#ffffff';
    ctx.strokeText(fmtTime(time), tx, hy + 1);
    ctx.fillText(fmtTime(time), tx, hy);
    if (shield > 0 && phase === 'playing') {
      var sy = hy + fontSize * 1.5;
      ctx.fillStyle = '#9fe8ff';
      ctx.strokeText('Shield ' + Math.ceil(shield) + 's', tx, sy + 1);
      ctx.fillText('Shield ' + Math.ceil(shield) + 's', tx, sy);
    }
    ctx.textAlign = 'left';
  }

  function drawHeart(x, y, r, full) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = full ? '#ff5d6c' : 'rgba(255,255,255,0.25)';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = Math.max(1.5, r * 0.18);
    ctx.beginPath();
    ctx.moveTo(0, r * 0.35);
    ctx.bezierCurveTo(r * 1.1, -r * 0.6, r * 0.6, -r * 1.15, 0, -r * 0.4);
    ctx.bezierCurveTo(-r * 0.6, -r * 1.15, -r * 1.1, -r * 0.6, 0, r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function fmtTime(t) {
    var total = Math.max(0, Math.ceil(t));
    var m = Math.floor(total / 60);
    var sec = total - m * 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function fitFont(text, size, maxWidth, weight) {
    var s = size;
    var w = weight || 'normal';
    ctx.font = w + ' ' + Math.round(s) + 'px system-ui, sans-serif';
    while (s > 8 && ctx.measureText(text).width > maxWidth) {
      s -= 1;
      ctx.font = w + ' ' + Math.round(s) + 'px system-ui, sans-serif';
    }
  }

  function drawOverlay() {
    var cssW = canvas.width / dpr, cssH = canvas.height / dpr;
    var s = clamp(Math.min(cssW, cssH) / 520, 0.85, 1.6);
    var maxW = cssW - 28;

    if (phase === 'title') {
      ctx.fillStyle = 'rgba(10,20,12,0.62)';
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffe9a8';
      fitFont(TITLE, 54 * s, maxW, 'bold');
      ctx.fillText(TITLE, cssW / 2, cssH * 0.34);
      ctx.fillStyle = '#ffffff';
      fitFont('Collect lanterns, avoid the spiky blobs!', 24 * s, maxW);
      ctx.fillText('Collect lanterns, avoid the spiky blobs!', cssW / 2, cssH * 0.46);
      ctx.fillStyle = '#d6f0d0';
      fitFont('WASD / arrows or drag to move  \u00b7  P to pause  \u00b7  M to mute', 19 * s, maxW);
      ctx.fillText('WASD / arrows or drag to move  \u00b7  P to pause  \u00b7  M to mute', cssW / 2, cssH * 0.56);
      ctx.fillStyle = '#ffffff';
      fitFont('Press any key / tap to start', 22 * s, maxW, 'bold');
      ctx.fillText('Press any key / tap to start', cssW / 2, cssH * 0.68);
      ctx.textAlign = 'left';
    } else if (phase === 'won' || phase === 'lost') {
      ctx.fillStyle = 'rgba(10,20,12,0.6)';
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = phase === 'won' ? '#ffe9a8' : '#ff9d8a';
      fitFont(phase === 'won' ? 'Time!' : 'Caught!', 52 * s, maxW, 'bold');
      ctx.fillText(phase === 'won' ? 'Time!' : 'Caught!', cssW / 2, cssH * 0.42);
      ctx.fillStyle = '#ffffff';
      fitFont('Score ' + score, 34 * s, maxW, 'bold');
      ctx.fillText('Score ' + score, cssW / 2, cssH * 0.54);
      ctx.fillStyle = '#d6f0d0';
      fitFont('Press any key / tap to restart', 20 * s, maxW);
      ctx.fillText('Press any key / tap to restart', cssW / 2, cssH * 0.66);
      ctx.textAlign = 'left';
    } else if (paused) {
      ctx.fillStyle = 'rgba(10,20,12,0.55)';
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      fitFont('Paused', 46 * s, maxW, 'bold');
      ctx.fillText('Paused', cssW / 2, cssH * 0.5);
      ctx.textAlign = 'left';
    }
  }

  /* 10. MAIN LOOP */
  function frame(now) {
    requestAnimationFrame(frame);
    if (!lastTime) lastTime = now;
    var dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    fpsFrames++;
    fpsAccum += dt;
    if (fpsAccum >= 0.5) { fps = Math.round(fpsFrames / fpsAccum); fpsFrames = 0; fpsAccum = 0; }
    if (!paused) update(dt);
    render();
  }

  /* 11. INTROSPECTION + HOST MESSAGES */
  function emitPhase() {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ source: 'dsh-game-studio', type: 'state', phase: phase, score: score }, '*');
      }
    } catch (e) { /* ignore */ }
  }

  /* 11b. CHARACTER CLOSE-UPS — a transparent close-up of every character,
   * drawn by drawCharacter(), for the studio's sidebar thumbnails and playtest
   * reports. Slots holding the user's own art are skipped: their file already
   * shows how they look. Keep this (and drawCharacter) when you rewrite the game. */
  var CHARACTERS = ['hero', 'enemy', 'pickup'];
  function renderSlots(size) {
    size = size || 256;
    var out = {};
    CHARACTERS.forEach(function (key) {
      if (!SLOTS[key] || customArt(key) || loading[key]) return; // dropped slots and the user's own art are skipped
      var c = document.createElement('canvas');
      c.width = size; c.height = size;
      var g = c.getContext('2d');
      g.translate(size / 2, size / 2);
      drawCharacter(g, key, size * 0.86);
      out[key] = c.toDataURL('image/png');
    });
    return out;
  }
  window.__renderSlots = renderSlots;
  // Tell the studio sidebar how the characters look in this build, once every image has loaded.
  var rendersPosted = false;
  function imageSettled() {
    if (rendersPosted) return;
    for (var key in loading) if (loading[key]) return;
    rendersPosted = true;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ source: 'dsh-game-studio', type: 'renders', renders: renderSlots(256) }, '*');
      }
    } catch (e) { postError('character renders failed: ' + (e && e.message || e)); }
  }

  window.__gameState = function () {
    function round(v) {
      if (typeof v !== 'number') return v;
      if (isNaN(v)) return 0;
      var r = Math.round(v * 100) / 100;
      return r === 0 ? 0 : r; // never -0
    }
    return {
      phase: phase,
      time: round(time),
      score: round(score),
      hearts: round(hearts),
      shield: round(shield),
      hero: { x: round(hero.x), y: round(hero.y) },
      enemies: enemies.map(function (e) { return { x: round(e.x), y: round(e.y) }; }),
      pickups: pickups.map(function (p) { return { x: round(p.x), y: round(p.y) }; }),
      world: { w: round(world.w), h: round(world.h) },
      fps: round(fps)
    };
  };

  window.addEventListener('error', function (e) {
    postError(e && e.message ? e.message : 'Unknown error');
  });
  window.addEventListener('unhandledrejection', function (e) {
    var m = (e && e.reason && e.reason.message) ? e.reason.message : String(e && e.reason);
    postError(m);
  });
  function postError(message) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ source: 'dsh-game-studio', type: 'error', message: String(message).slice(0, 300) }, '*');
      }
    } catch (e) { /* ignore */ }
  }

  /* 12. RESIZE / BOOT */
  function resize() {
    var cssW = window.innerWidth || canvas.clientWidth || 1280;
    var cssH = window.innerHeight || canvas.clientHeight || 720;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';

    var oldW = world.w, oldH = world.h;
    var landscape = cssW >= cssH;
    world.w = landscape ? 1280 : 720;
    world.h = landscape ? 720 : 1280;

    if (world.w !== oldW || world.h !== oldH) {
      keepInBounds();
      buildBackground();
    }

    // fitScale/ox/oy are in CSS pixels; render() multiplies by dpr.
    fitScale = Math.min(cssW / world.w, cssH / world.h);
    ox = (cssW - world.w * fitScale) / 2;
    oy = (cssH - world.h * fitScale) / 2;
  }

  function keepInBounds() {
    hero.x = clamp(hero.x, R.heroSize * 0.5, world.w - R.heroSize * 0.5);
    hero.y = clamp(hero.y, R.heroSize * 0.5, world.h - R.heroSize * 0.5);
    for (var i = 0; i < enemies.length; i++) {
      enemies[i].x = clamp(enemies[i].x, -R.enemySize, world.w + R.enemySize);
      enemies[i].y = clamp(enemies[i].y, -R.enemySize, world.h + R.enemySize);
    }
    for (var j = 0; j < pickups.length; j++) {
      pickups[j].x = clamp(pickups[j].x, R.pickupSize * 0.5, world.w - R.pickupSize * 0.5);
      pickups[j].y = clamp(pickups[j].y, R.pickupSize * 0.5, world.h - R.pickupSize * 0.5);
    }
  }

  /* Pointer / touch: press-and-drag = virtual joystick. */
  canvas.addEventListener('pointerdown', function (e) {
    ensureAudio();
    if (canvas.focus) canvas.focus();
    if (phase === 'title') { startGame(); return; }
    if (phase === 'won' || phase === 'lost') { if (restartGuard <= 0) startGame(); return; }
    if (phase === 'playing') {
      joystick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
      e.preventDefault();
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!joystick || e.pointerId !== joystick.id) return;
    joystick.dx = e.clientX - joystick.ox;
    joystick.dy = e.clientY - joystick.oy;
    e.preventDefault();
  });
  function releasePointer(e) {
    if (joystick && e.pointerId === joystick.id) joystick = null;
  }
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);

  window.addEventListener('blur', function () {
    keys = Object.create(null);
    joystick = null;
    if (phase === 'playing') paused = true;
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      keys = Object.create(null);
      joystick = null;
      if (phase === 'playing') paused = true;
    }
  });

  // Boot
  loadImage('hero', ASSETS.hero);
  loadImage('enemy', ASSETS.enemy);
  loadImage('pickup', ASSETS.pickup);
  loadImage('background', ASSETS.background);
  imageSettled();
  resize();
  window.addEventListener('resize', resize);
  hero.x = world.w / 2;
  hero.y = world.h / 2;
  requestAnimationFrame(frame);
})();
