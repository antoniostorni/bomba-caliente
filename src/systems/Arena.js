import { GAME, ARENA } from '../core/Constants.js';

export function drawArena(scene) {
  const g = scene.add.graphics().setDepth(0);
  const { MARGIN: m } = ARENA;

  g.fillStyle(0x0d0a18).fillRect(0, 0, GAME.W, GAME.H);
  // La pista tiene un borde luminoso y marcas que ayudan a leer la velocidad.
  g.fillStyle(0x35234f).fillRoundedRect(m - 13, m - 13, GAME.W - m * 2 + 26, GAME.H - m * 2 + 26, 22);
  g.fillStyle(ARENA.FLOOR).fillRect(m, m, GAME.W - m * 2, GAME.H - m * 2);
  // Piso a cuadros, para que se note el movimiento
  const tile = 60;
  g.fillStyle(ARENA.FLOOR_TILE);
  for (let x = m; x < GAME.W - m; x += tile) {
    for (let y = m; y < GAME.H - m; y += tile) {
      if (((x - m) / tile + (y - m) / tile) % 2 === 0) {
        g.fillRect(x, y, Math.min(tile, GAME.W - m - x), Math.min(tile, GAME.H - m - y));
      }
    }
  }
  g.lineStyle(1, 0x8267af, 0.17);
  for (let x = m + 30; x < GAME.W - m; x += tile) g.lineBetween(x, m, x, GAME.H - m);
  for (let y = m + 30; y < GAME.H - m; y += tile) g.lineBetween(m, y, GAME.W - m, y);
  g.lineStyle(3, 0x9872d0, 0.45).strokeCircle(GAME.W / 2, GAME.H / 2, 145);
  g.lineStyle(2, 0xffca68, 0.22).strokeCircle(GAME.W / 2, GAME.H / 2, 118);
  g.fillStyle(0xffd67c, 0.24).fillCircle(GAME.W / 2, GAME.H / 2, 7);
  g.lineStyle(6, ARENA.WALL_TOP).strokeRect(m - 3, m - 3, GAME.W - m * 2 + 6, GAME.H - m * 2 + 6);
  g.lineStyle(2, 0xffcb78, 0.45).strokeRect(m + 4, m + 4, GAME.W - m * 2 - 8, GAME.H - m * 2 - 8);
  for (let i = 0; i < 16; i++) {
    const x = m + 27 + i * 76;
    g.fillStyle(i % 2 ? 0xffbd69 : 0x8c6cbd, 0.45).fillRoundedRect(x, m - 12, 38, 4, 2);
    g.fillRoundedRect(x, GAME.H - m + 8, 38, 4, 2);
  }

  for (const o of ARENA.OBSTACLES) {
    g.fillStyle(0x080511, 0.5).fillRoundedRect(o.x + 8, o.y + 12, o.w, o.h, 14);
    g.fillStyle(0x392453).fillRoundedRect(o.x, o.y, o.w, o.h, 14);
    g.fillStyle(0x79569f).fillRoundedRect(o.x + 2, o.y + 2, o.w - 4, o.h - 12, 12);
    g.lineStyle(2, 0xb590d2, 0.65).strokeRoundedRect(o.x + 5, o.y + 5, o.w - 10, o.h - 19, 10);
    g.lineStyle(3, 0x2b1a43, 0.7).lineBetween(o.x + 18, o.y + 20, o.x + o.w - 18, o.y + o.h - 30);
    g.fillStyle(0xffd06b, 0.8).fillCircle(o.x + 13, o.y + 13, 3);
    g.fillCircle(o.x + o.w - 13, o.y + 13, 3);
  }
  return g;
}

// Empuja un círculo fuera de paredes y obstáculos. Anula la velocidad
// contra la superficie para que no "tiemble" pegado a la pared.
export function collide(body, r) {
  const { MARGIN: m } = ARENA;
  if (body.x < m + r) { body.x = m + r; body.vx = Math.abs(body.vx) * 0.3; }
  if (body.x > GAME.W - m - r) { body.x = GAME.W - m - r; body.vx = -Math.abs(body.vx) * 0.3; }
  if (body.y < m + r) { body.y = m + r; body.vy = Math.abs(body.vy) * 0.3; }
  if (body.y > GAME.H - m - r) { body.y = GAME.H - m - r; body.vy = -Math.abs(body.vy) * 0.3; }

  for (const o of ARENA.OBSTACLES) {
    const cx = Math.max(o.x, Math.min(body.x, o.x + o.w));
    const cy = Math.max(o.y, Math.min(body.y, o.y + o.h));
    let dx = body.x - cx;
    let dy = body.y - cy;
    let d = Math.hypot(dx, dy);
    if (d >= r) continue;
    if (d === 0) {
      // Centro adentro del obstáculo: salir por el lado más cercano
      dx = body.x < o.x + o.w / 2 ? -1 : 1;
      dy = 0;
      d = 1;
    }
    const nx = dx / d;
    const ny = dy / d;
    body.x = cx + nx * r;
    body.y = cy + ny * r;
    const vn = body.vx * nx + body.vy * ny;
    if (vn < 0) {
      body.vx -= vn * nx * 1.3;
      body.vy -= vn * ny * 1.3;
    }
  }
}

export function clampToArena(body, r) {
  const { MARGIN: m } = ARENA;
  body.x = Math.max(m + r, Math.min(GAME.W - m - r, body.x));
  body.y = Math.max(m + r, Math.min(GAME.H - m - r, body.y));
}
