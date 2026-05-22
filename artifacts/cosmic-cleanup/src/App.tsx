import { useEffect, useRef, useState, useCallback } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── types ────────────────────────────────────────────────────────────────────
interface Vec2 { x: number; y: number }
interface Bullet { x: number; y: number; vy: number; friendly: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; r: number; color: string }
interface Star { x: number; y: number; r: number; speed: number; alpha: number }

interface Player {
  x: number; y: number;
  w: number; h: number;
  hp: number; maxHp: number;
  iframes: number;
  fireTimer: number;
}

type DebrisShape = { pts: Vec2[]; rot: number; rotSpeed: number; color: string; craterColor: string };
interface Debris {
  x: number; y: number;
  vx: number; vy: number;
  r: number; hp: number;
  shape: DebrisShape;
}

type EnemyKind = "fighter" | "brute" | "raider";
interface Enemy {
  x: number; y: number;
  vx: number; vy: number;
  w: number; h: number;
  hp: number; maxHp: number;
  kind: EnemyKind;
  fireTimer: number;
  fireInterval: number;
  rot: number;
  bobOffset: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function randInt(a: number, b: number) { return Math.floor(rand(a, b + 1)); }
function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// ─── asset generators (canvas drawing functions) ──────────────────────────────

/** Player ship — sleek, arrow-shaped, cyan/white with engine glow */
function drawPlayerShip(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, iframes: number) {
  const flickering = iframes > 0 && Math.floor(Date.now() / 80) % 2 === 0;
  if (flickering) return;

  ctx.save();
  ctx.translate(cx, cy);

  const hw = w / 2, hh = h / 2;

  // Engine glow (back)
  const engineGlow = ctx.createRadialGradient(0, hh * 0.6, 0, 0, hh * 0.6, hw * 1.2);
  engineGlow.addColorStop(0, "rgba(80,220,255,0.9)");
  engineGlow.addColorStop(0.4, "rgba(50,100,255,0.5)");
  engineGlow.addColorStop(1, "rgba(0,0,80,0)");
  ctx.fillStyle = engineGlow;
  ctx.beginPath();
  ctx.ellipse(0, hh * 0.6, hw * 1.2, hh * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Engine flame
  const flameH = hh * 0.6 + Math.sin(Date.now() / 60) * 4;
  const flameGrad = ctx.createLinearGradient(0, hh * 0.4, 0, hh + flameH);
  flameGrad.addColorStop(0, "rgba(255,255,255,1)");
  flameGrad.addColorStop(0.3, "rgba(80,180,255,0.95)");
  flameGrad.addColorStop(0.7, "rgba(30,60,255,0.7)");
  flameGrad.addColorStop(1, "rgba(0,0,100,0)");
  ctx.fillStyle = flameGrad;
  ctx.beginPath();
  ctx.moveTo(-hw * 0.28, hh * 0.4);
  ctx.quadraticCurveTo(-hw * 0.5, hh * 0.75, -hw * 0.1, hh + flameH);
  ctx.quadraticCurveTo(0, hh + flameH + 6, hw * 0.1, hh + flameH);
  ctx.quadraticCurveTo(hw * 0.5, hh * 0.75, hw * 0.28, hh * 0.4);
  ctx.closePath();
  ctx.fill();

  // Main hull (dark metallic body)
  const hullGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
  hullGrad.addColorStop(0, "#1a3a5c");
  hullGrad.addColorStop(0.35, "#2e6a9e");
  hullGrad.addColorStop(0.5, "#5ab4e8");
  hullGrad.addColorStop(0.65, "#2e6a9e");
  hullGrad.addColorStop(1, "#1a3a5c");
  ctx.fillStyle = hullGrad;
  ctx.beginPath();
  ctx.moveTo(0, -hh);               // nose
  ctx.lineTo(hw * 0.35, -hh * 0.3); // right shoulder
  ctx.lineTo(hw * 0.28, hh * 0.4);  // right engine
  ctx.lineTo(-hw * 0.28, hh * 0.4); // left engine
  ctx.lineTo(-hw * 0.35, -hh * 0.3);// left shoulder
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#7de8ff";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Wings
  const wingGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
  wingGrad.addColorStop(0, "#0d2a45");
  wingGrad.addColorStop(0.5, "#1e5080");
  wingGrad.addColorStop(1, "#0d2a45");
  ctx.fillStyle = wingGrad;

  // Left wing
  ctx.beginPath();
  ctx.moveTo(-hw * 0.35, -hh * 0.3);
  ctx.lineTo(-hw, hh * 0.15);
  ctx.lineTo(-hw * 0.85, hh * 0.45);
  ctx.lineTo(-hw * 0.28, hh * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#4ab0d8";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Right wing
  ctx.beginPath();
  ctx.moveTo(hw * 0.35, -hh * 0.3);
  ctx.lineTo(hw, hh * 0.15);
  ctx.lineTo(hw * 0.85, hh * 0.45);
  ctx.lineTo(hw * 0.28, hh * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#4ab0d8";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Wing accent lines (cyan glow strips)
  ctx.strokeStyle = "rgba(80,220,255,0.7)";
  ctx.lineWidth = 2;
  ctx.shadowColor = "#00eeff";
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(-hw * 0.32, -hh * 0.15);
  ctx.lineTo(-hw * 0.78, hh * 0.22);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hw * 0.32, -hh * 0.15);
  ctx.lineTo(hw * 0.78, hh * 0.22);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Cockpit canopy
  const cockpitGrad = ctx.createRadialGradient(-hw * 0.08, -hh * 0.25, 1, 0, -hh * 0.1, hw * 0.22);
  cockpitGrad.addColorStop(0, "rgba(200,240,255,0.95)");
  cockpitGrad.addColorStop(0.5, "rgba(80,180,255,0.7)");
  cockpitGrad.addColorStop(1, "rgba(0,60,120,0.9)");
  ctx.fillStyle = cockpitGrad;
  ctx.beginPath();
  ctx.moveTo(0, -hh * 0.85);
  ctx.bezierCurveTo(hw * 0.18, -hh * 0.6, hw * 0.18, -hh * 0.1, 0, -hh * 0.05);
  ctx.bezierCurveTo(-hw * 0.18, -hh * 0.1, -hw * 0.18, -hh * 0.6, 0, -hh * 0.85);
  ctx.fill();
  ctx.strokeStyle = "rgba(160,230,255,0.8)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Gun barrels
  ctx.fillStyle = "#3a8ab8";
  ctx.fillRect(-hw * 0.5 - 2, -hh * 0.08, 5, hh * 0.3);
  ctx.fillRect(hw * 0.5 - 3, -hh * 0.08, 5, hh * 0.3);
  ctx.fillStyle = "#7dd4f5";
  ctx.fillRect(-hw * 0.5 - 1, -hh * 0.15, 3, 6);
  ctx.fillRect(hw * 0.5 - 1, -hh * 0.15, 3, 6);

  ctx.restore();
}

/** Build a debris shape (jagged asteroid-like polygon with craters) */
function makeDebrisShape(r: number): DebrisShape {
  const pts: Vec2[] = [];
  const sides = randInt(7, 12);
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    const len = r * rand(0.55, 1.0);
    pts.push({ x: Math.cos(angle) * len, y: Math.sin(angle) * len });
  }
  const grays = ["#6b6b6b", "#787878", "#5a5a5a", "#8e8e8e", "#4a4a55"];
  const craters = ["#3a3a3a", "#484848", "#2e2e38"];
  return {
    pts,
    rot: rand(0, Math.PI * 2),
    rotSpeed: rand(-0.012, 0.012),
    color: grays[randInt(0, grays.length - 1)],
    craterColor: craters[randInt(0, craters.length - 1)],
  };
}

function drawDebris(ctx: CanvasRenderingContext2D, d: Debris) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.shape.rot);

  const { pts, color, craterColor } = d.shape;
  const r = d.r;

  // Shadow/depth
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 6;

  // Main body
  const bodyGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.05, 0, 0, r);
  bodyGrad.addColorStop(0, lighten(color, 30));
  bodyGrad.addColorStop(0.5, color);
  bodyGrad.addColorStop(1, darken(color, 25));
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Edge outline
  ctx.strokeStyle = darken(color, 20);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Craters
  const numCraters = Math.floor(r / 8);
  for (let i = 0; i < numCraters; i++) {
    const angle = (i / numCraters) * Math.PI * 2 + 0.3;
    const dist2 = r * rand(0.15, 0.55);
    const cr = r * rand(0.08, 0.2);
    const cx2 = Math.cos(angle) * dist2;
    const cy2 = Math.sin(angle) * dist2;
    ctx.fillStyle = craterColor;
    ctx.beginPath();
    ctx.arc(cx2, cy2, cr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = lighten(craterColor, 15);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Surface scratch lines
  ctx.strokeStyle = darken(color, 35);
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 3; i++) {
    const ax = rand(-r * 0.5, r * 0.5), ay = rand(-r * 0.5, r * 0.5);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + rand(-r * 0.3, r * 0.3), ay + rand(-r * 0.3, r * 0.3));
    ctx.stroke();
  }

  ctx.restore();
}

/** Enemy ships — angular, aggressive, red/dark palette */
function drawEnemyShip(ctx: CanvasRenderingContext2D, e: Enemy, t: number) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const bob = Math.sin(t * 0.003 + e.bobOffset) * 3;
  ctx.translate(0, bob);

  const hw = e.w / 2, hh = e.h / 2;
  const { kind } = e;

  if (kind === "fighter") {
    drawFighterEnemy(ctx, hw, hh);
  } else if (kind === "brute") {
    drawBruteEnemy(ctx, hw, hh);
  } else {
    drawRaiderEnemy(ctx, hw, hh);
  }

  // HP bar (only if damaged)
  if (e.hp < e.maxHp) {
    const barW = e.w * 1.2;
    const barH = 4;
    const bx = -barW / 2;
    const by = -hh - 12;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(bx, by, barW, barH);
    const ratio = e.hp / e.maxHp;
    ctx.fillStyle = ratio > 0.5 ? "#ff4444" : "#ff0000";
    ctx.fillRect(bx, by, barW * ratio, barH);
    ctx.strokeStyle = "#ff8888";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(bx, by, barW, barH);
  }

  ctx.restore();
}

function drawFighterEnemy(ctx: CanvasRenderingContext2D, hw: number, hh: number) {
  // Engine glow (facing down = moving toward player)
  const egGrad = ctx.createRadialGradient(0, -hh * 0.5, 0, 0, -hh * 0.5, hw * 0.8);
  egGrad.addColorStop(0, "rgba(255,60,0,0.85)");
  egGrad.addColorStop(0.5, "rgba(200,20,0,0.4)");
  egGrad.addColorStop(1, "rgba(80,0,0,0)");
  ctx.fillStyle = egGrad;
  ctx.beginPath();
  ctx.ellipse(0, -hh * 0.5, hw * 0.8, hh * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main hull — sharp pointed downward wedge (threats point at player)
  const hullGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
  hullGrad.addColorStop(0, "#2a0a0a");
  hullGrad.addColorStop(0.4, "#6b1414");
  hullGrad.addColorStop(0.5, "#c23030");
  hullGrad.addColorStop(0.6, "#6b1414");
  hullGrad.addColorStop(1, "#2a0a0a");
  ctx.fillStyle = hullGrad;
  ctx.beginPath();
  ctx.moveTo(0, hh);               // nose pointing DOWN toward player
  ctx.lineTo(hw * 0.4, hh * 0.2);
  ctx.lineTo(hw * 0.3, -hh * 0.4);
  ctx.lineTo(-hw * 0.3, -hh * 0.4);
  ctx.lineTo(-hw * 0.4, hh * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#ff5555";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Side wings with spikes
  ctx.fillStyle = "#3d0d0d";
  // Left wing
  ctx.beginPath();
  ctx.moveTo(-hw * 0.3, -hh * 0.4);
  ctx.lineTo(-hw, hh * 0.1);
  ctx.lineTo(-hw * 1.15, hh * 0.35); // spike tip
  ctx.lineTo(-hw * 0.9, hh * 0.15);
  ctx.lineTo(-hw * 0.4, hh * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#cc3333";
  ctx.lineWidth = 1;
  ctx.stroke();
  // Right wing
  ctx.beginPath();
  ctx.moveTo(hw * 0.3, -hh * 0.4);
  ctx.lineTo(hw, hh * 0.1);
  ctx.lineTo(hw * 1.15, hh * 0.35);
  ctx.lineTo(hw * 0.9, hh * 0.15);
  ctx.lineTo(hw * 0.4, hh * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#cc3333";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Red glow strips on wings
  ctx.shadowColor = "#ff2200";
  ctx.shadowBlur = 8;
  ctx.strokeStyle = "rgba(255,80,30,0.8)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-hw * 0.28, hh * 0.05);
  ctx.lineTo(-hw * 0.85, hh * 0.18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hw * 0.28, hh * 0.05);
  ctx.lineTo(hw * 0.85, hh * 0.18);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Menacing "eye" sensor
  ctx.fillStyle = "#ff0000";
  ctx.shadowColor = "#ff4400";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(0, hh * 0.3, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,180,0,0.9)";
  ctx.beginPath();
  ctx.arc(0, hh * 0.3, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Gun barrels pointing down
  ctx.fillStyle = "#1a0505";
  ctx.fillRect(-hw * 0.5 - 2, hh * 0.35, 4, hh * 0.4);
  ctx.fillRect(hw * 0.5 - 2, hh * 0.35, 4, hh * 0.4);
  ctx.fillStyle = "#cc2200";
  ctx.fillRect(-hw * 0.5 - 1, hh * 0.7, 2, 6);
  ctx.fillRect(hw * 0.5 - 1, hh * 0.7, 2, 6);
}

function drawBruteEnemy(ctx: CanvasRenderingContext2D, hw: number, hh: number) {
  // Glowing purple/dark engine top
  const eg = ctx.createRadialGradient(0, -hh * 0.6, 0, 0, -hh * 0.6, hw);
  eg.addColorStop(0, "rgba(160,0,200,0.8)");
  eg.addColorStop(1, "rgba(60,0,80,0)");
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.ellipse(0, -hh * 0.6, hw, hh * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Massive blocky hull
  const hullGrad = ctx.createLinearGradient(-hw, -hh, hw, hh);
  hullGrad.addColorStop(0, "#1a001a");
  hullGrad.addColorStop(0.3, "#4a0a6a");
  hullGrad.addColorStop(0.6, "#7a1a9a");
  hullGrad.addColorStop(1, "#2a0040");
  ctx.fillStyle = hullGrad;
  ctx.beginPath();
  ctx.moveTo(0, hh);
  ctx.lineTo(hw * 0.6, hh * 0.7);
  ctx.lineTo(hw, hh * 0.3);
  ctx.lineTo(hw * 0.9, -hh * 0.3);
  ctx.lineTo(hw * 0.5, -hh);
  ctx.lineTo(-hw * 0.5, -hh);
  ctx.lineTo(-hw * 0.9, -hh * 0.3);
  ctx.lineTo(-hw, hh * 0.3);
  ctx.lineTo(-hw * 0.6, hh * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#cc44ff";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Spine plates
  ctx.fillStyle = "#350045";
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.rect(i * hw * 0.22 - 5, -hh * 0.8, 10, hh * 1.4);
    ctx.fill();
  }

  // Triple barrel cannons
  for (let dx of [-hw * 0.5, 0, hw * 0.5]) {
    ctx.fillStyle = "#200028";
    ctx.fillRect(dx - 4, hh * 0.5, 8, hh * 0.7);
    ctx.fillStyle = "#aa00cc";
    ctx.shadowColor = "#dd44ff";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(dx, hh * 1.15, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Multi eye array
  const eyeY = hh * 0.1;
  for (let ex of [-hw * 0.4, 0, hw * 0.4]) {
    ctx.fillStyle = "#ff00ff";
    ctx.shadowColor = "#ff55ff";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(ex, eyeY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex, eyeY, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shoulder spikes
  ctx.fillStyle = "#3a0050";
  ctx.strokeStyle = "#bb33ff";
  ctx.lineWidth = 1;
  [[-1, -0.3], [1, -0.3]].forEach(([sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(sx * hw, sy * hh);
    ctx.lineTo(sx * hw * 1.3, sy * hh - 18);
    ctx.lineTo(sx * hw * 1.3 + sx * 8, sy * hh);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
}

function drawRaiderEnemy(ctx: CanvasRenderingContext2D, hw: number, hh: number) {
  // Orange/dark engine
  const eg = ctx.createRadialGradient(0, -hh * 0.4, 0, 0, -hh * 0.4, hw * 0.9);
  eg.addColorStop(0, "rgba(255,120,0,0.85)");
  eg.addColorStop(1, "rgba(80,30,0,0)");
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.ellipse(0, -hh * 0.4, hw * 0.9, hh * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Asymmetric raider hull — feels chaotic
  const hullGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
  hullGrad.addColorStop(0, "#1a0c00");
  hullGrad.addColorStop(0.35, "#7a3500");
  hullGrad.addColorStop(0.5, "#c45a00");
  hullGrad.addColorStop(0.65, "#7a3500");
  hullGrad.addColorStop(1, "#1a0c00");
  ctx.fillStyle = hullGrad;
  ctx.beginPath();
  ctx.moveTo(hw * 0.15, hh);    // offset nose
  ctx.lineTo(hw * 0.65, hh * 0.5);
  ctx.lineTo(hw, -hh * 0.1);
  ctx.lineTo(hw * 0.6, -hh);
  ctx.lineTo(-hw * 0.4, -hh);
  ctx.lineTo(-hw, -hh * 0.2);
  ctx.lineTo(-hw * 0.7, hh * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#ff8800";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Jagged side blades
  ctx.fillStyle = "#2a1000";
  // Right blade
  ctx.beginPath();
  ctx.moveTo(hw, -hh * 0.1);
  ctx.lineTo(hw * 1.35, -hh * 0.4);
  ctx.lineTo(hw * 1.4, hh * 0.2);
  ctx.lineTo(hw * 1.1, hh * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#ff6600";
  ctx.lineWidth = 1;
  ctx.stroke();
  // Left blade (smaller, ragged)
  ctx.beginPath();
  ctx.moveTo(-hw, -hh * 0.2);
  ctx.lineTo(-hw * 1.2, -hh * 0.6);
  ctx.lineTo(-hw * 1.25, 0);
  ctx.lineTo(-hw * 0.9, hh * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Glow strips
  ctx.shadowColor = "#ff6600";
  ctx.shadowBlur = 8;
  ctx.strokeStyle = "rgba(255,140,0,0.8)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-hw * 0.4, -hh * 0.5);
  ctx.lineTo(hw * 0.5, -hh * 0.5);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Single menacing slit eye
  const eyeGrad = ctx.createLinearGradient(-hw * 0.35, 0, hw * 0.35, 0);
  eyeGrad.addColorStop(0, "rgba(255,80,0,0)");
  eyeGrad.addColorStop(0.5, "rgba(255,200,0,1)");
  eyeGrad.addColorStop(1, "rgba(255,80,0,0)");
  ctx.fillStyle = eyeGrad;
  ctx.shadowColor = "#ffaa00";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.ellipse(0, hh * 0.15, hw * 0.35, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Jagged front teeth/spikes
  ctx.fillStyle = "#3a1500";
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(hw * 0.15 + i * hw * 0.22 - 5, hh * 0.95);
    ctx.lineTo(hw * 0.15 + i * hw * 0.22, hh * 1.25);
    ctx.lineTo(hw * 0.15 + i * hw * 0.22 + 5, hh * 0.95);
    ctx.closePath();
    ctx.fillStyle = i === 0 ? "#ff4400" : "#aa2200";
    ctx.fill();
  }
}

// Color helpers
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = clamp(((n >> 16) & 0xff) + amt, 0, 255);
  const g = clamp(((n >> 8) & 0xff) + amt, 0, 255);
  const b = clamp((n & 0xff) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}
function darken(hex: string, amt: number): string { return lighten(hex, -amt); }

// ─── constants ────────────────────────────────────────────────────────────────
const CANVAS_W = 800;
const CANVAS_H = 600;
const PLAYER_W = 52;
const PLAYER_H = 64;
const PLAYER_SPEED = 5;
const BULLET_SPEED = 12;
const ENEMY_BULLET_SPEED = 5;
const DEBRIS_SPAWN_INTERVAL = 1800;
const ENEMY_SPAWN_INTERVAL = 4000;
const MAX_DEBRIS = 14;
const MAX_ENEMIES = 8;

// ─── spawners ─────────────────────────────────────────────────────────────────
function spawnDebris(w: number): Debris {
  const r = rand(14, 36);
  return {
    x: rand(r, w - r),
    y: -r * 2,
    vx: rand(-0.6, 0.6),
    vy: rand(0.8, 2.0),
    r,
    hp: Math.ceil(r / 12),
    shape: makeDebrisShape(r),
  };
}

function spawnEnemy(w: number, score: number): Enemy {
  const kinds: EnemyKind[] = ["fighter", "raider", "brute"];
  const bruteUnlock = score > 500;
  const pool = bruteUnlock ? kinds : ["fighter", "raider"] as EnemyKind[];
  const kind = pool[randInt(0, pool.length - 1)];
  let ew = 56, eh = 52, ehp = 2, fi = 2200;
  if (kind === "brute") { ew = 72; eh = 68; ehp = 5; fi = 1600; }
  if (kind === "raider") { ew = 60; eh = 55; ehp = 3; fi = 2800; }
  return {
    x: rand(ew, w - ew),
    y: -eh,
    vx: rand(-0.6, 0.6),
    vy: rand(0.5, 1.2),
    w: ew, h: eh,
    hp: ehp, maxHp: ehp,
    kind,
    fireTimer: rand(800, fi),
    fireInterval: fi,
    rot: 0,
    bobOffset: rand(0, Math.PI * 2),
  };
}

function spawnParticles(
  particles: Particle[],
  x: number, y: number,
  color: string,
  count = 12,
  speed = 3
) {
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const s = rand(0.5, speed);
    particles.push({
      x, y,
      vx: Math.cos(angle) * s,
      vy: Math.sin(angle) * s,
      life: 1, maxLife: 1,
      r: rand(2, 5),
      color,
    });
  }
}

// ─── Game component ──────────────────────────────────────────────────────────
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    player: {
      x: CANVAS_W / 2, y: CANVAS_H - 90,
      w: PLAYER_W, h: PLAYER_H,
      hp: 5, maxHp: 5,
      iframes: 0, fireTimer: 0,
    } as Player,
    bullets: [] as Bullet[],
    debris: [] as Debris[],
    enemies: [] as Enemy[],
    particles: [] as Particle[],
    stars: [] as Star[],
    keys: {} as Record<string, boolean>,
    score: 0,
    phase: "playing" as "playing" | "dead" | "paused",
    debrisTimer: 0,
    enemyTimer: 0,
    lastTime: 0,
    animFrame: 0,
    bossWarning: 0,
  });
  const [displayScore, setDisplayScore] = useState(0);
  const [displayHp, setDisplayHp] = useState(5);
  const [phase, setPhase] = useState<"playing" | "dead" | "paused">("playing");

  const resetGame = useCallback(() => {
    const s = stateRef.current;
    s.player = {
      x: CANVAS_W / 2, y: CANVAS_H - 90,
      w: PLAYER_W, h: PLAYER_H,
      hp: 5, maxHp: 5,
      iframes: 0, fireTimer: 0,
    };
    s.bullets = [];
    s.debris = [];
    s.enemies = [];
    s.particles = [];
    s.score = 0;
    s.debrisTimer = 0;
    s.enemyTimer = 0;
    s.phase = "playing";
    setDisplayScore(0);
    setDisplayHp(5);
    setPhase("playing");
  }, []);

  useEffect(() => {
    const s = stateRef.current;
    // Init stars
    s.stars = Array.from({ length: 130 }, () => ({
      x: rand(0, CANVAS_W),
      y: rand(0, CANVAS_H),
      r: rand(0.5, 2.2),
      speed: rand(0.2, 1.1),
      alpha: rand(0.3, 1),
    }));

    const onKey = (e: KeyboardEvent) => {
      s.keys[e.code] = e.type === "keydown";
      if (e.code === "Space") e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const s = stateRef.current;

    function gameLoop(ts: number) {
      const dt = Math.min(ts - s.lastTime, 50);
      s.lastTime = ts;

      if (s.phase !== "playing") {
        drawFrame(ctx, ts);
        s.animFrame = requestAnimationFrame(gameLoop);
        return;
      }

      // ── update ──────────────────────────────────────────────────────────────
      const { player, keys } = s;

      // Player movement
      if (keys["ArrowLeft"] || keys["KeyA"]) player.x -= PLAYER_SPEED;
      if (keys["ArrowRight"] || keys["KeyD"]) player.x += PLAYER_SPEED;
      if (keys["ArrowUp"] || keys["KeyW"]) player.y -= PLAYER_SPEED;
      if (keys["ArrowDown"] || keys["KeyS"]) player.y += PLAYER_SPEED;
      player.x = clamp(player.x, player.w / 2, CANVAS_W - player.w / 2);
      player.y = clamp(player.y, player.h / 2, CANVAS_H - player.h / 2);

      if (player.iframes > 0) player.iframes -= dt;

      // Auto-fire
      player.fireTimer -= dt;
      if (player.fireTimer <= 0) {
        player.fireTimer = 260;
        s.bullets.push({ x: player.x - player.w * 0.48, y: player.y - player.h * 0.1, vy: -BULLET_SPEED, friendly: true });
        s.bullets.push({ x: player.x + player.w * 0.48, y: player.y - player.h * 0.1, vy: -BULLET_SPEED, friendly: true });
      }

      // Spawning
      s.debrisTimer -= dt;
      if (s.debrisTimer <= 0 && s.debris.length < MAX_DEBRIS) {
        s.debrisTimer = DEBRIS_SPAWN_INTERVAL - clamp(s.score * 2, 0, 1200);
        s.debris.push(spawnDebris(CANVAS_W));
      }
      s.enemyTimer -= dt;
      if (s.enemyTimer <= 0 && s.enemies.length < MAX_ENEMIES) {
        s.enemyTimer = ENEMY_SPAWN_INTERVAL - clamp(s.score * 3, 0, 2500);
        s.enemies.push(spawnEnemy(CANVAS_W, s.score));
      }

      // Move bullets
      s.bullets = s.bullets.filter(b => {
        b.y += b.vy;
        return b.y > -20 && b.y < CANVAS_H + 20;
      });

      // Move debris + rotate
      s.debris = s.debris.filter(d => {
        d.x += d.vx;
        d.y += d.vy;
        d.shape.rot += d.shape.rotSpeed;
        return d.y < CANVAS_H + d.r * 2;
      });

      // Move enemies + enemy fire
      s.enemies = s.enemies.filter(e => {
        e.x += e.vx;
        e.y += e.vy;
        if (e.x < e.w / 2 || e.x > CANVAS_W - e.w / 2) e.vx *= -1;
        if (e.y > CANVAS_H + e.h) return false;

        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = e.fireInterval;
          const num = e.kind === "brute" ? 3 : 1;
          for (let i = 0; i < num; i++) {
            const spread = (i - (num - 1) / 2) * 0.3;
            s.bullets.push({
              x: e.x + spread * 20,
              y: e.y + e.h / 2,
              vy: ENEMY_BULLET_SPEED + spread * 0.5,
              friendly: false,
            });
          }
        }
        return true;
      });

      // Move particles
      s.particles = s.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.life -= 0.025;
        return p.life > 0;
      });

      // Stars scroll
      for (const star of s.stars) {
        star.y += star.speed;
        if (star.y > CANVAS_H) { star.y = 0; star.x = rand(0, CANVAS_W); }
      }

      // ── collisions ──────────────────────────────────────────────────────────
      const bulletsToRemove = new Set<number>();

      // Player bullets vs debris
      s.bullets.forEach((b, bi) => {
        if (!b.friendly) return;
        s.debris.forEach((d, di) => {
          if (dist(b.x, b.y, d.x, d.y) < d.r) {
            bulletsToRemove.add(bi);
            d.hp--;
            spawnParticles(s.particles, d.x, d.y, "#aaa", 6, 2);
            if (d.hp <= 0) {
              spawnParticles(s.particles, d.x, d.y, "#888", 18, 3.5);
              s.score += 10;
              s.debris.splice(di, 1);
            }
          }
        });
      });

      // Player bullets vs enemies
      s.bullets.forEach((b, bi) => {
        if (!b.friendly) return;
        s.enemies.forEach((e, ei) => {
          if (Math.abs(b.x - e.x) < e.w / 2 && Math.abs(b.y - e.y) < e.h / 2) {
            bulletsToRemove.add(bi);
            e.hp--;
            spawnParticles(s.particles, b.x, b.y, e.kind === "brute" ? "#cc44ff" : e.kind === "raider" ? "#ff8800" : "#ff4444", 8, 2.5);
            if (e.hp <= 0) {
              spawnParticles(s.particles, e.x, e.y, "#ff3300", 30, 5);
              spawnParticles(s.particles, e.x, e.y, "#ffaa00", 20, 3.5);
              const pts = e.kind === "brute" ? 150 : e.kind === "raider" ? 80 : 50;
              s.score += pts;
              s.enemies.splice(ei, 1);
            }
          }
        });
      });

      // Enemy bullets / debris vs player
      if (player.iframes <= 0) {
        s.bullets.forEach((b, bi) => {
          if (b.friendly) return;
          if (Math.abs(b.x - player.x) < player.w * 0.38 && Math.abs(b.y - player.y) < player.h * 0.42) {
            bulletsToRemove.add(bi);
            player.hp--;
            player.iframes = 1400;
            spawnParticles(s.particles, player.x, player.y, "#00ddff", 14, 3);
            if (player.hp <= 0) {
              spawnParticles(s.particles, player.x, player.y, "#00aaff", 40, 6);
              spawnParticles(s.particles, player.x, player.y, "#ffffff", 20, 4);
              s.phase = "dead";
              setPhase("dead");
            }
          }
        });
        // Debris collision
        s.debris.forEach((d, di) => {
          if (dist(player.x, player.y, d.x, d.y) < d.r + player.w * 0.3) {
            player.hp--;
            player.iframes = 1400;
            spawnParticles(s.particles, player.x, player.y, "#00ddff", 14, 3);
            d.hp = 0;
            spawnParticles(s.particles, d.x, d.y, "#888", 20, 3.5);
            s.debris.splice(di, 1);
            if (player.hp <= 0) {
              spawnParticles(s.particles, player.x, player.y, "#00aaff", 40, 6);
              s.phase = "dead";
              setPhase("dead");
            }
          }
        });
      }

      s.bullets = s.bullets.filter((_, i) => !bulletsToRemove.has(i));

      setDisplayScore(s.score);
      setDisplayHp(player.hp);

      drawFrame(ctx, ts);
      s.animFrame = requestAnimationFrame(gameLoop);
    }

    function drawFrame(ctx: CanvasRenderingContext2D, t: number) {
      const { player, bullets, debris, enemies, particles, stars, score, phase } = s;

      // Background
      ctx.fillStyle = "#050510";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Nebula
      const nebGrad = ctx.createRadialGradient(CANVAS_W * 0.6, CANVAS_H * 0.35, 40, CANVAS_W * 0.6, CANVAS_H * 0.35, 280);
      nebGrad.addColorStop(0, "rgba(15,8,40,0.7)");
      nebGrad.addColorStop(1, "rgba(5,5,16,0)");
      ctx.fillStyle = nebGrad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const nebGrad2 = ctx.createRadialGradient(CANVAS_W * 0.25, CANVAS_H * 0.7, 20, CANVAS_W * 0.25, CANVAS_H * 0.7, 200);
      nebGrad2.addColorStop(0, "rgba(5,20,40,0.5)");
      nebGrad2.addColorStop(1, "rgba(5,5,16,0)");
      ctx.fillStyle = nebGrad2;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Stars
      for (const star of stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(t * 0.003 * star.speed + star.x);
        ctx.globalAlpha = star.alpha * twinkle;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Particles
      for (const p of particles) {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Debris
      for (const d of debris) drawDebris(ctx, d);

      // Enemies
      for (const e of enemies) drawEnemyShip(ctx, e, t);

      // Player bullets (cyan beams)
      for (const b of bullets) {
        if (!b.friendly) continue;
        const bGrad = ctx.createLinearGradient(b.x, b.y + 16, b.x, b.y - 4);
        bGrad.addColorStop(0, "rgba(0,220,255,0)");
        bGrad.addColorStop(1, "rgba(180,255,255,1)");
        ctx.strokeStyle = bGrad;
        ctx.lineWidth = 3;
        ctx.shadowColor = "#00eeff";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y + 16);
        ctx.lineTo(b.x, b.y - 4);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Enemy bullets (orange/red plasma bolts)
      for (const b of bullets) {
        if (b.friendly) continue;
        ctx.fillStyle = "#ff4400";
        ctx.shadowColor = "#ff8800";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, 4, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Player ship
      if (phase !== "dead") {
        drawPlayerShip(ctx, player.x, player.y, player.w, player.h, player.iframes);
      }

      // ── HUD ─────────────────────────────────────────────────────────────────
      // Score
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(10, 10, 160, 34);
      ctx.fillStyle = "#7dfff5";
      ctx.font = "bold 18px 'Courier New', monospace";
      ctx.textAlign = "left";
      ctx.fillText(`SCORE  ${score}`, 20, 32);

      // HP bar
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(CANVAS_W - 150, 10, 140, 34);
      ctx.fillStyle = "#555";
      ctx.fillRect(CANVAS_W - 140, 16, 120, 14);
      const hpRatio = player.hp / player.maxHp;
      const hpColor = hpRatio > 0.5 ? "#00ddff" : hpRatio > 0.25 ? "#ffcc00" : "#ff2200";
      ctx.fillStyle = hpColor;
      ctx.shadowColor = hpColor;
      ctx.shadowBlur = 6;
      ctx.fillRect(CANVAS_W - 140, 16, 120 * hpRatio, 14);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#3af0ff";
      ctx.lineWidth = 1;
      ctx.strokeRect(CANVAS_W - 140, 16, 120, 14);
      ctx.fillStyle = "#7dfff5";
      ctx.font = "11px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText("HULL", CANVAS_W - 80, 37);

      // Controls hint
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = "#aaeeff";
      ctx.font = "11px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText("WASD / Arrow Keys to move  •  Auto-fire active", CANVAS_W / 2, CANVAS_H - 10);
      ctx.globalAlpha = 1;

      // Overlay screens
      if (phase === "dead") {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.textAlign = "center";
        ctx.fillStyle = "#ff4444";
        ctx.font = "bold 54px 'Courier New', monospace";
        ctx.shadowColor = "#ff0000";
        ctx.shadowBlur = 20;
        ctx.fillText("SHIP DESTROYED", CANVAS_W / 2, CANVAS_H / 2 - 50);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffcc44";
        ctx.font = "bold 28px 'Courier New', monospace";
        ctx.fillText(`FINAL SCORE: ${score}`, CANVAS_W / 2, CANVAS_H / 2 + 10);
        ctx.fillStyle = "#aaeeff";
        ctx.font = "18px 'Courier New', monospace";
        ctx.fillText("Press R to restart", CANVAS_W / 2, CANVAS_H / 2 + 55);
      }
    }

    s.lastTime = performance.now();
    s.animFrame = requestAnimationFrame(gameLoop);

    const onR = (e: KeyboardEvent) => {
      if (e.code === "KeyR" && s.phase === "dead") resetGame();
    };
    window.addEventListener("keydown", onR);

    return () => {
      cancelAnimationFrame(s.animFrame);
      window.removeEventListener("keydown", onR);
    };
  }, [resetGame]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020208",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Courier New', monospace",
        userSelect: "none",
      }}
    >
      <div style={{ marginBottom: 12, display: "flex", gap: 32, alignItems: "center" }}>
        <span style={{ color: "#7dfff5", fontSize: 22, fontWeight: "bold", letterSpacing: 3 }}>
          COSMIC CLEANUP
        </span>
        <span style={{ color: "#aaa", fontSize: 13 }}>
          Fighters <span style={{ color: "#ff5555" }}>■</span>&nbsp;
          Raiders <span style={{ color: "#ff8800" }}>■</span>&nbsp;
          Brutes <span style={{ color: "#cc44ff" }}>■</span>&nbsp;
          Debris <span style={{ color: "#888" }}>■</span>
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{
          border: "2px solid #1a4a6a",
          borderRadius: 6,
          boxShadow: "0 0 40px rgba(0,180,255,0.2), 0 0 80px rgba(0,60,120,0.3)",
          display: "block",
        }}
      />
      {phase === "dead" && (
        <button
          onClick={resetGame}
          style={{
            marginTop: 16,
            padding: "10px 32px",
            background: "linear-gradient(135deg,#003355,#006699)",
            color: "#7dfff5",
            border: "2px solid #3af0ff",
            borderRadius: 6,
            fontSize: 16,
            fontFamily: "'Courier New', monospace",
            fontWeight: "bold",
            cursor: "pointer",
            letterSpacing: 2,
            boxShadow: "0 0 16px rgba(0,180,255,0.4)",
          }}
        >
          RESTART MISSION
        </button>
      )}
    </div>
  );
}
