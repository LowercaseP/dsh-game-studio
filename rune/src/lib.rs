//! "rune" template: a 60-second collect-and-dodge game drawn by Rune (github.com/anomalyco/rune).
//!
//! The page defines `window.GAME = {title, rules, slots, assets}` exactly as for the JS
//! templates, so the agent changes gameplay by editing `rules` in game.json and art by
//! replacing slot files — no Rust rebuild. The `title` slot is shown on the start and end
//! screens. `window.__gameState()` reports the game for playtests.

use rune::{AppSpec, Cx, El, Image, ImageCache, Key, KeyEvent, Tx, col, el, text};
use serde_json::Value;

mod host {
    #[cfg(target_arch = "wasm32")]
    use wasm_bindgen::prelude::*;

    #[cfg(target_arch = "wasm32")]
    #[wasm_bindgen(inline_js = "
function game() { return (typeof window !== 'undefined' && window.GAME) || {}; }
export function gameJson() {
    const g = game();
    return JSON.stringify({ title: g.title, rules: g.rules || {}, slots: g.slots || {} });
}
export function assetMime(slot) {
    const url = (game().assets || {})[slot];
    const m = typeof url === 'string' && /^data:([^;,]+)/.exec(url);
    return m ? m[1] : '';
}
export function assetBytes(slot) {
    const url = (game().assets || {})[slot];
    if (typeof url !== 'string') return new Uint8Array(0);
    const comma = url.indexOf(',');
    const body = url.slice(comma + 1);
    if (/;base64$/.test(url.slice(0, comma))) {
        const bin = atob(body);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }
    return new TextEncoder().encode(decodeURIComponent(body));
}
let latest = '{}';
export function publish(json) {
    latest = json;
    window.__gameState = () => JSON.parse(latest);
}
export function random() { return Math.random(); }
")]
    extern "C" {
        #[wasm_bindgen(js_name = gameJson)]
        pub fn game_json() -> String;
        #[wasm_bindgen(js_name = assetMime)]
        pub fn asset_mime(slot: &str) -> String;
        #[wasm_bindgen(js_name = assetBytes)]
        pub fn asset_bytes(slot: &str) -> Vec<u8>;
        pub fn publish(json: &str);
        pub fn random() -> f64;
    }

    // Native builds (Rune's headless tooling: --snap, --script, --tree) read a project folder
    // named by RUNE_GAME_DIR (game.json plus its slot files), or run with defaults and no art.
    #[cfg(not(target_arch = "wasm32"))]
    fn manifest() -> Option<(std::path::PathBuf, serde_json::Value)> {
        let dir = std::path::PathBuf::from(std::env::var_os("RUNE_GAME_DIR")?);
        let json = std::fs::read_to_string(dir.join("game.json")).ok()?;
        Some((dir, serde_json::from_str(&json).ok()?))
    }
    #[cfg(not(target_arch = "wasm32"))]
    fn slot_file(slot: &str) -> Option<std::path::PathBuf> {
        let (dir, m) = manifest()?;
        Some(dir.join(m.get("slots")?.get(slot)?.get("file")?.as_str()?))
    }
    #[cfg(not(target_arch = "wasm32"))]
    pub fn game_json() -> String { manifest().map_or_else(|| String::from("{}"), |(_, m)| m.to_string()) }
    #[cfg(not(target_arch = "wasm32"))]
    pub fn asset_mime(slot: &str) -> String {
        let svg = slot_file(slot).is_some_and(|p| p.extension().is_some_and(|e| e == "svg"));
        String::from(if svg { "image/svg+xml" } else { "" })
    }
    #[cfg(not(target_arch = "wasm32"))]
    pub fn asset_bytes(slot: &str) -> Vec<u8> { slot_file(slot).and_then(|p| std::fs::read(p).ok()).unwrap_or_default() }
    #[cfg(not(target_arch = "wasm32"))]
    pub fn publish(json: &str) {
        // RUNE_GAME_STATE=path writes the latest __gameState() there, for native playtests.
        if let Some(path) = std::env::var_os("RUNE_GAME_STATE") { let _ = std::fs::write(path, json); }
    }
    #[cfg(not(target_arch = "wasm32"))]
    pub fn random() -> f64 {
        use std::cell::Cell;
        thread_local!(static SEED: Cell<u64> = const { Cell::new(0x2545_f491_4f6c_dd1d) });
        SEED.with(|s| {
            let mut x = s.get();
            x ^= x << 13; x ^= x >> 7; x ^= x << 17;
            s.set(x);
            (x >> 11) as f64 / (1u64 << 53) as f64
        })
    }
}

/// Every gameplay value, read from `GAME.rules` with these defaults.
#[derive(Clone)]
struct Rules {
    duration: f32,
    hearts: u32,
    hero_speed: f32,
    enemy_speed: f32,
    enemy_speed_growth: f32,
    enemy_spawn_every: f32,
    max_enemies: usize,
    max_pickups: usize,
    hero_size: f32,
    enemy_size: f32,
    pickup_size: f32,
}

impl Rules {
    fn from(v: &Value) -> Self {
        let n = |k: &str, d: f32| v.get(k).and_then(Value::as_f64).map(|x| x as f32).filter(|x| x.is_finite()).unwrap_or(d);
        Rules {
            duration: n("duration", 60.0).max(5.0),
            hearts: n("hearts", 3.0).max(1.0) as u32,
            hero_speed: n("heroSpeed", 320.0),
            enemy_speed: n("enemySpeed", 120.0),
            enemy_speed_growth: n("enemySpeedGrowth", 3.0),
            enemy_spawn_every: n("enemySpawnEvery", 4.0).max(0.5),
            max_enemies: n("maxEnemies", 8.0).max(0.0) as usize,
            max_pickups: n("maxPickups", 5.0).max(1.0) as usize,
            hero_size: n("heroSize", 76.0),
            enemy_size: n("enemySize", 68.0),
            pickup_size: n("pickupSize", 44.0),
        }
    }
}

#[derive(Clone, Copy, PartialEq)]
enum Phase { Title, Playing, Over }

impl Phase {
    fn name(self) -> &'static str {
        match self { Phase::Title => "title", Phase::Playing => "playing", Phase::Over => "over" }
    }
}

#[derive(Clone, Copy)]
struct Thing { x: f32, y: f32, vx: f32, vy: f32 }

const SLOTS: [&str; 5] = ["hero", "enemy", "pickup", "background", "title"];

struct State {
    title: String,
    rules: Rules,
    art: Vec<(&'static str, Image)>,
    cache: Option<ImageCache>,
    phase: Phase,
    w: f32,
    h: f32,
    last: Option<f64>,
    time_left: f32,
    since_spawn: f32,
    hurt: f32,
    score: u32,
    best: u32,
    hearts: u32,
    hero: Thing,
    target: (f32, f32),
    enemies: Vec<Thing>,
    pickups: Vec<Thing>,
}

impl Default for State {
    fn default() -> Self {
        let game: Value = serde_json::from_str(&host::game_json()).unwrap_or(Value::Null);
        let rules = Rules::from(game.get("rules").unwrap_or(&Value::Null));
        State {
            title: game.get("title").and_then(Value::as_str).unwrap_or("Rune Game").to_string(),
            hearts: rules.hearts,
            time_left: rules.duration,
            rules,
            art: Vec::new(),
            cache: None,
            phase: Phase::Title,
            w: 390.0,
            h: 700.0,
            last: None,
            since_spawn: 0.0,
            hurt: 0.0,
            score: 0,
            best: 0,
            hero: Thing { x: 195.0, y: 350.0, vx: 0.0, vy: 0.0 },
            target: (195.0, 350.0),
            enemies: Vec::new(),
            pickups: Vec::new(),
        }
    }
}

fn rgba(r: f32, g: f32, b: f32, a: f32) -> rune::Color {
    let c = |v: f32| (v.clamp(0.0, 1.0) * 255.0).round() as u8;
    rune::color::hex(&format!("#{:02x}{:02x}{:02x}", c(r), c(g), c(b))).expect("valid hex").alpha(a)
}

fn rand() -> f32 { host::random() as f32 }

impl State {
    fn image(&self, slot: &str) -> Option<&Image> {
        self.art.iter().find(|(s, i)| *s == slot && i.is_ready()).map(|(_, i)| i)
    }

    fn start(&mut self) {
        self.phase = Phase::Playing;
        self.score = 0;
        self.hearts = self.rules.hearts;
        self.time_left = self.rules.duration;
        self.since_spawn = 0.0;
        self.hurt = 0.0;
        self.hero = Thing { x: self.w / 2.0, y: self.h / 2.0, vx: 0.0, vy: 0.0 };
        self.target = (self.hero.x, self.hero.y);
        self.enemies.clear();
        self.pickups.clear();
        self.spawn_enemy();
    }

    fn edge_point(&self) -> (f32, f32) {
        match (rand() * 4.0) as u32 {
            0 => (rand() * self.w, -40.0),
            1 => (self.w + 40.0, rand() * self.h),
            2 => (rand() * self.w, self.h + 40.0),
            _ => (-40.0, rand() * self.h),
        }
    }

    fn spawn_enemy(&mut self) {
        if self.enemies.len() >= self.rules.max_enemies { return; }
        let (x, y) = self.edge_point();
        self.enemies.push(Thing { x, y, vx: 0.0, vy: 0.0 });
    }

    fn spawn_pickup(&mut self) {
        let m = self.rules.pickup_size;
        self.pickups.push(Thing {
            x: m + rand() * (self.w - 2.0 * m).max(1.0),
            y: m + rand() * (self.h - 2.0 * m).max(1.0),
            vx: 0.0, vy: 0.0,
        });
    }

    fn step(&mut self, dt: f32) {
        let r = self.rules.clone();
        self.time_left -= dt;
        self.hurt = (self.hurt - dt).max(0.0);
        self.since_spawn += dt;
        if self.since_spawn >= r.enemy_spawn_every { self.since_spawn = 0.0; self.spawn_enemy(); }
        while self.pickups.len() < r.max_pickups { self.spawn_pickup(); }

        // Hero eases toward the pointer or keyboard target at most heroSpeed.
        let (dx, dy) = (self.target.0 - self.hero.x, self.target.1 - self.hero.y);
        let d = (dx * dx + dy * dy).sqrt();
        let step = (r.hero_speed * dt).min(d);
        if d > 0.5 { self.hero.x += dx / d * step; self.hero.y += dy / d * step; }
        let half = r.hero_size / 2.0;
        self.hero.x = self.hero.x.clamp(half, (self.w - half).max(half));
        self.hero.y = self.hero.y.clamp(half, (self.h - half).max(half));

        let elapsed = r.duration - self.time_left;
        let speed = r.enemy_speed + r.enemy_speed_growth * elapsed;
        let hit_enemy = (r.hero_size + r.enemy_size) * 0.4;
        let hero = self.hero;
        let mut hit = false;
        for e in &mut self.enemies {
            let (dx, dy) = (hero.x - e.x, hero.y - e.y);
            let d = (dx * dx + dy * dy).sqrt().max(0.001);
            e.vx = dx / d * speed;
            e.vy = dy / d * speed;
            e.x += e.vx * dt;
            e.y += e.vy * dt;
            if d < hit_enemy { hit = true; }
        }
        if hit && self.hurt <= 0.0 {
            self.hearts = self.hearts.saturating_sub(1);
            self.hurt = 1.2;
            // Knock the nearest enemies back to the edge so a hit is survivable.
            let edges: Vec<(f32, f32)> = (0..self.enemies.len()).map(|_| self.edge_point()).collect();
            for (e, (x, y)) in self.enemies.iter_mut().zip(edges) {
                let (dx, dy) = (hero.x - e.x, hero.y - e.y);
                if (dx * dx + dy * dy).sqrt() < hit_enemy * 2.0 { e.x = x; e.y = y; }
            }
        }
        let hit_pickup = (r.hero_size + r.pickup_size) * 0.45;
        let before = self.pickups.len();
        self.pickups.retain(|p| {
            let (dx, dy) = (hero.x - p.x, hero.y - p.y);
            (dx * dx + dy * dy).sqrt() >= hit_pickup
        });
        self.score += (before - self.pickups.len()) as u32;

        if self.hearts == 0 || self.time_left <= 0.0 {
            self.time_left = self.time_left.max(0.0);
            self.best = self.best.max(self.score);
            self.phase = Phase::Over;
        }
    }

    fn publish(&self) {
        let v = serde_json::json!({
            "phase": self.phase.name(),
            "score": self.score,
            "best": self.best,
            "hearts": self.hearts,
            "timeLeft": self.time_left,
            "hero": { "x": self.hero.x, "y": self.hero.y },
            "enemies": self.enemies.iter().map(|e| serde_json::json!({ "x": e.x, "y": e.y })).collect::<Vec<_>>(),
            "pickups": self.pickups.iter().map(|p| serde_json::json!({ "x": p.x, "y": p.y })).collect::<Vec<_>>(),
            "size": { "w": self.w, "h": self.h },
            "engine": "rune",
        });
        host::publish(&v.to_string());
    }
}

fn press(s: &mut State, tx: &mut Tx) {
    if s.phase != Phase::Playing { s.start(); s.last = None; tx.wake_after(std::time::Duration::ZERO); }
}

fn key(s: &mut State, e: &KeyEvent, tx: &mut Tx) -> bool {
    let nudge = 60.0;
    let (dx, dy) = match &e.key {
        Key::Left => (-nudge, 0.0),
        Key::Right => (nudge, 0.0),
        Key::Up => (0.0, -nudge),
        Key::Down => (0.0, nudge),
        Key::Text(t) => match t.to_ascii_lowercase().as_str() {
            "a" => (-nudge, 0.0), "d" => (nudge, 0.0), "w" => (0.0, -nudge), "s" => (0.0, nudge),
            " " => { press(s, tx); return true; }
            _ => return false,
        },
        Key::Enter => { press(s, tx); return true; }
        _ => return false,
    };
    if s.phase != Phase::Playing { return false; }
    let base = if (s.target.0 - s.hero.x).abs() + (s.target.1 - s.hero.y).abs() > 2.0 * nudge { (s.hero.x, s.hero.y) } else { s.target };
    s.target = ((base.0 + dx).clamp(0.0, s.w), (base.1 + dy).clamp(0.0, s.h));
    true
}

fn poll(s: &mut State, clock: f64, tx: &mut Tx) -> bool {
    let dt = s.last.map_or(0.0, |l| (clock - l) as f32).clamp(0.0, 0.05);
    s.last = Some(clock);
    let playing = s.phase == Phase::Playing;
    if playing {
        s.step(dt);
        // Keep frames coming while the round runs; start and end screens rest.
        tx.wake_after(std::time::Duration::ZERO);
    }
    s.publish();
    playing
}

fn sprite(s: &State, slot: &str, t: Thing, size: f32, fallback: [f32; 4], round: bool) -> El {
    let e = el().size(size, size).absolute(t.x - size / 2.0, t.y - size / 2.0);
    match s.image(slot) {
        Some(img) => e.pixels(img.pixels()),
        None => e.radius(if round { size / 2.0 } else { 8.0 }).fill(rgba(fallback[0], fallback[1], fallback[2], fallback[3])),
    }
}

fn label(s: impl Into<String>, size: f32) -> El {
    text(s.into()).font(rune::TextStyle::new(size, 700.0)).color(rgba(1.0, 1.0, 1.0, 1.0))
}

fn view(s: &State, _: &mut Cx<State>) -> El {
    let mut world = el().key("world").w_full().h_full().clip_rounded(0.0)
        .on_layout(|s: &mut State, [_, _, w, h]| { if w > 0.0 && h > 0.0 { s.w = w; s.h = h; } })
        .on_pointer_move_local(|s: &mut State, p, _| { s.target = (p.x, p.y); })
        .on_drag(|s: &mut State, d, _| { s.target = (d.x, d.y); })
        .on_press_tx(press);
    world = match s.image("background") {
        Some(bg) => world.child(el().w_full().h_full().absolute(0.0, 0.0).pixels(bg.pixels())),
        None => world.fill(rgba(0.11, 0.16, 0.13, 1.0)),
    };

    if s.phase == Phase::Playing {
        for p in &s.pickups { world = world.child(sprite(s, "pickup", *p, s.rules.pickup_size, [1.0, 0.8, 0.2, 1.0], true)); }
        for e in &s.enemies { world = world.child(sprite(s, "enemy", *e, s.rules.enemy_size, [0.75, 0.1, 0.15, 1.0], false)); }
        let blink = s.hurt > 0.0 && ((s.hurt * 10.0) as i32) % 2 == 0;
        world = world.child(sprite(s, "hero", s.hero, s.rules.hero_size, [0.95, 0.95, 0.95, 1.0], true).opacity(if blink { 0.3 } else { 1.0 }));
        let hud = format!("★ {}   ♥ {}   {}s", s.score, s.hearts, s.time_left.ceil() as i32);
        world = world.child(el().absolute(12.0, 12.0).px(12.0).py(6.0).radius(10.0)
            .fill(rgba(0.0, 0.0, 0.0, 0.55)).child(label(hud, 18.0)));
        return world;
    }

    // Start and end screens: the title art, then the call to action.
    let side = (s.w.min(s.h) * 0.62).max(80.0);
    let mut card = col().center().gap(14.0).padding(20.0).radius(18.0).fill(rgba(0.0, 0.0, 0.0, 0.6));
    match s.image("title") {
        Some(img) => {
            let [iw, ih] = img.size().unwrap_or([1, 1]);
            let ratio = ih.max(1) as f32 / iw.max(1) as f32;
            let (w, h) = if ratio >= 1.0 { (side / ratio, side) } else { (side, side * ratio) };
            card = card.child(el().size(w, h).radius(12.0).pixels(img.pixels()));
        }
        None => card = card.child(label(s.title.clone(), 30.0)),
    }
    card = match s.phase {
        Phase::Over => card.child(label(format!("Score {}  ·  Best {}", s.score, s.best), 22.0)).child(label("Tap or press Space to play again", 16.0)),
        _ => card.child(label("Tap or press Space to start", 18.0)),
    };
    world.child(col().w_full().h_full().absolute(0.0, 0.0).center().child(card))
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen::prelude::wasm_bindgen(start))]
pub fn start() {
    let mut spec = AppSpec::new("Rune Game", (390.0, 700.0), State::default, view);
    spec.setup = Some(|s, waker| {
        let cache = ImageCache::new(waker);
        for slot in SLOTS {
            let bytes = host::asset_bytes(slot);
            if bytes.is_empty() { continue; }
            let mime = host::asset_mime(slot);
            // Vector art rasterizes at the largest size it draws, at 2× for sharp edges.
            let image = if mime.contains("svg") { cache.load_mime(bytes, &mime, 1024.0, 2.0) } else { cache.load(bytes) };
            s.art.push((slot, image));
        }
        s.cache = Some(cache);
    });
    spec.poll = Some(poll);
    spec.on_key = Some(key);
    // Mount on the page's own <canvas id="game">, as the JS templates do.
    #[cfg(target_arch = "wasm32")]
    rune::App::new(spec).canvas_id("game").full_viewport().run();
    #[cfg(not(target_arch = "wasm32"))]
    rune::run(spec);
}
