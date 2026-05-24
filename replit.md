# Cosmic Cleanup: The Space Janitor

A 2D arcade browser game built with Phaser 3. The player pilots a janitor spaceship to collect orbital debris across 5 levels before the timer runs out, while avoiding rogue enemy satellites and collecting power-ups.

## Run & Operate

- `pnpm --filter @workspace/cosmic-cleanup run dev` — run the game frontend (port 5000)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 3001, currently unused by game)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: Phaser 3.88.2 (loaded from CDN), Web Audio API — no React in game runtime
- Backend: Express 5 (API server, ready for future features)
- DB: PostgreSQL + Drizzle ORM (ready for leaderboards etc.)
- Build: Vite (serves game as static HTML, no bundling of game code)

## Where things live

- `artifacts/cosmic-cleanup/index.html` — complete self-contained game (Phaser 3 + Web Audio)
- `artifacts/cosmic-cleanup/vite.config.ts` — Vite config (serves index.html on port 5000)
- `artifacts/api-server/src/` — Express API server (health route, ready to extend)
- `lib/db/src/schema/` — Drizzle schema (add tables here for leaderboards etc.)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (run codegen to generate client hooks)

## Architecture decisions

- Game lives entirely in `index.html` as a single self-contained file per spec — Phaser from CDN, all audio via Web Audio API, all graphics via Phaser Graphics API (no external assets)
- Vite is used purely as a dev server / static file host; it does not bundle the game JS
- Phaser game registry is the state bus between scenes (`currentLevel`, `score`, `health`)
- Health carries over between levels but resets to 3 at level 1 / on restart
- Audio context is unlocked lazily on first user gesture to comply with browser autoplay policy

## Product

- 5 levels of increasing difficulty (more debris, enemies, faster enemy speed)
- Player ship with animated engine flame (idle flicker, thrust plume, boost mode)
- Enemy rogue satellites with pulsing danger beacon and seek AI
- Two power-ups: Shield (invincibility) and Super Vacuum (extended collect radius + magnet)
- Combo system: 3+ collects in 4 seconds activates ×2 score multiplier for 5s
- Full HUD: score, level, debris counter, timer (with colour warnings), hearts, power-up countdown
- Four scenes: MenuScene → GameScene → LevelCompleteScene → GameOverScene
- All Web Audio API music and SFX — no external audio files

### v2 additions
- **Player shooting**: SPACE fires cyan laser bolts (520px/s, 0.35s rate limit, max 6 on screen); bolt tails drawn in fxGfx each frame
- **Enemy HP system**: L1-2 = 3 HP, L3-4 = 4 HP, L5 = 5 HP; white flash on hit; +50 pts + explosion particles on kill
- **Enemy respawning**: destroyed enemies respawn at a screen edge after a level-based delay (12s→4s); active cap per level (3→8)
- **Debris splitting**: 70% large (10 pts) / 30% small (5 pts) at spawn; large → 2 smalls at ±60° when hit by enemy; small just scatters
- **Off-screen enemy indicators**: red arrows on screen edges every frame pointing toward off-screen or near-edge enemies; duplicates within 30px suppressed
- **Level intro card**: 2.2s overlay (0.3s fade-in, 1.6s hold, 0.3s fade-out) before gameplay begins; blocks movement and timer
- **Local leaderboard**: top-5 scores in localStorage; shown on MenuScene; "NEW HIGH SCORE!" flash on GameOverScene

### v3 additions
- **Screen shake**: camera shake on player hit, enemy kill, dash, EMP, boss hit, boss phase 2 trigger, boss death, combo activation
- **3 new power-ups**: Speed Boost (green, 8s, +59% max speed), Time Freeze (ice blue, 5s, slows all enemies to 8%), EMP (yellow, instant pushback + stun on all enemies + 2.2s boss stun + shockwave ring)
- **Power-up pool unlocks by level**: L1=shield+vacuum, L2+=speed, L3+=freeze, L4-5+=emp; shuffled each spawn
- **Player dash/dodge**: SHIFT key fires a 580px/s impulse in the ship's facing direction; 2.5s cooldown shown as a filling arc ring around the player
- **3 enemy types**: Seeker (red, direct seek — existing), Bomber (purple hexagon, slow seek + drops debris every 4-7s), Patrol (green octagon, orbits a fixed center point with solar panels)
- **Enemy type distribution by level**: L1 seekers only; L2 adds bombers; L3 adds patrol; L4 all three; L5 mixes all three
- **Level 5 Boss**: 30 HP; phase 1 = slow seek (72px/s); phase 2 triggered at 50% HP = faster (115px/s) + fires magenta enemy bolts at player every 2.4s; +10 pts per hit, +500 pts on kill; boss HP bar in HUD; big death explosion + screen flash; win requires both all debris collected AND boss dead
- **Debris particle trails**: each frame draws 4 fading velocity-direction dots behind every moving debris piece on fxGfx
- **Improved pause menu**: dark panel with "PAUSED" title + animated RESUME button + MAIN MENU button + controls reference; both buttons fully interactive
- **Mobile/touch controls**: virtual joystick (left half, dynamic placement on touch), FIRE button (right side, shows pressed state), DASH button (right side, shows cooldown arc); always rendered at low opacity so keyboard players are unaffected

## User preferences

- Game spec: single index.html, Phaser 3 CDN, Web Audio API, all graphics drawn programmatically
- GameOverScene restart always goes to MenuScene (never directly to GameScene)
- Health persists between levels; score persists between levels

## Gotchas

- The `index.html` does not use `<script type="module">` — it loads Phaser synchronously from CDN. Vite serves it as a plain HTML file.
- AudioContext must be created after a user gesture — the `AM._getCtx()` call in button handlers handles this.
- `buildTextures(scene)` is guarded with `if (!scene.textures.exists(...))` so it's safe to call in preload() of any scene.
- The 404 in browser devtools on load is from a Vite plugin pinging the API server, not a game error.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
