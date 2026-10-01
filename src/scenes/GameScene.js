import Phaser from 'phaser';
import { GAME, PLAYER, MODIFIERS, NET } from '../core/Constants.js';
import { eventBus } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { net } from '../net/Net.js';
import { play, setMuted } from '../audio/Sfx.js';
import { drawArena, collide } from '../systems/Arena.js';
import { Effects } from '../systems/Effects.js';
import { Blob } from '../entities/Blob.js';
import { Hud } from '../ui/Hud.js';
import * as F from '../content/frases.js';

const BEEP_MS = [850, 520, 270, 120];

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    drawArena(this);
    this.effects = new Effects(this);
    this.hud = new Hud(this);
    this.blobs = new Map();

    // Yo: la posición local manda para mi gotita; el servidor solo la valida.
    this.me = { x: GAME.W / 2, y: GAME.H / 2, vx: 0, vy: 0, dirX: 0, dirY: 1 };
    this.dashCd = 0;
    this.slide = 0;
    this.emoteCd = 0;
    this.sendAcc = 0;
    this.beepAcc = 0;
    this.trailAcc = 0;
    this.touch = { pointer: null, x: 0, y: 0, dx: 0, dy: 0 };

    // Apagón: capa oscura con agujeros de luz alrededor de cada jugador.
    this.dark = this.add.rectangle(0, 0, GAME.W, GAME.H, 0x000000, 0.94).setOrigin(0).setDepth(50).setVisible(false);
    this.lights = this.make.graphics();
    const mask = this.lights.createGeometryMask();
    mask.setInvertAlpha(true);
    this.dark.setMask(mask);

    this.danger = this.add.rectangle(0, 0, GAME.W, GAME.H, 0xff2020, 0).setOrigin(0).setDepth(60);
    this.cooldownBar = this.add.graphics().setDepth(12);

    this.setupInput();
    this.input.keyboard.enabled = !document.getElementById('overlay');
    if (!this.input.keyboard.enabled) this.input.keyboard.disableGlobalCapture();
    this.setupTouch();
    this.setupNet();
  }

  // ---------- input ----------

  setupInput() {
    const kb = this.input.keyboard;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ENTER,M');
    kb.on('keydown-SPACE', () => this.action());
    kb.on('keydown-ENTER', () => net.send({ t: 'start' }));
    kb.on('keydown-M', () => setMuted(!gameState.muted));
    kb.addCapture(['SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT']);
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'].forEach((k, i) => kb.on(`keydown-${k}`, () => this.emote(i)));
  }

  setupTouch() {
    this.touchEnabled = window.matchMedia('(pointer: coarse)').matches;
    if (!this.touchEnabled) return;
    this.input.addPointer(2);
    this.touchUi = this.add.graphics().setDepth(75);
    this.touchLabel = this.add.text(GAME.W - 128, GAME.H - 94, '💨', {
      fontFamily: 'system-ui', fontSize: '46px',
    }).setOrigin(0.5).setDepth(76);
    this.input.on('pointerdown', (p) => {
      if (document.getElementById('overlay')) return;
      if (gameState.phase === 'lobby' && p.y < 300 && p.x > 380 && p.x < 900) {
        net.send({ t: 'start' });
        return;
      }
      if (p.x > GAME.W * 0.62) { this.action(); return; }
      if (this.touch.pointer !== null) return;
      this.touch.pointer = p.id;
      this.touch.x = p.x;
      this.touch.y = p.y;
      this.updateTouch(p);
    });
    this.input.on('pointermove', (p) => {
      if (p.id === this.touch.pointer) this.updateTouch(p);
    });
    const release = (p) => {
      if (p.id === this.touch.pointer) Object.assign(this.touch, { pointer: null, dx: 0, dy: 0 });
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  updateTouch(p) {
    const dx = p.x - this.touch.x;
    const dy = p.y - this.touch.y;
    const len = Math.hypot(dx, dy);
    const amount = Math.min(1, len / 65);
    this.touch.dx = len ? dx / len * amount : 0;
    this.touch.dy = len ? dy / len * amount : 0;
  }

  drawTouch() {
    if (!this.touchEnabled) return;
    const g = this.touchUi.clear();
    const x = this.touch.pointer === null ? 125 : this.touch.x;
    const y = this.touch.pointer === null ? GAME.H - 116 : this.touch.y;
    g.fillStyle(0x120b25, 0.58).fillCircle(x, y, 76);
    g.lineStyle(4, 0xe5d3ff, 0.6).strokeCircle(x, y, 70);
    g.fillStyle(0xb899ee, 0.65).fillCircle(x + this.touch.dx * 46, y + this.touch.dy * 46, 30);
    const self = gameState.players.get(gameState.you);
    const ready = !!self?.a && this.dashCd <= 0;
    g.fillStyle(ready ? 0xff693f : 0x50415d, 0.83).fillCircle(GAME.W - 128, GAME.H - 116, 69);
    g.lineStyle(4, ready ? 0xffe19b : 0xa18fac, 0.9).strokeCircle(GAME.W - 128, GAME.H - 116, 69);
    this.touchLabel.setText('💨').setAlpha(ready ? 1 : 0.45).setY(GAME.H - 116);
  }

  emote(i) {
    if (this.emoteCd > 0) return;
    this.emoteCd = PLAYER.EMOTE_COOLDOWN_MS;
    net.send({ t: 'emote', i });
  }

  // ESPACIO: impulso. Todos vuelven a jugar en la siguiente ronda.
  action() {
    const self = gameState.players.get(gameState.you);
    if (!self?.ready || !self.a || !['lobby', 'playing'].includes(gameState.phase)) return;
    if (this.dashCd > 0) return;
    const big = Math.random() < PLAYER.NUKE_CHANCE;
    const force = big ? PLAYER.NUKE_IMPULSE : PLAYER.DASH_IMPULSE;
    this.me.vx += this.me.dirX * force;
    this.me.vy += this.me.dirY * force;
    this.slide = PLAYER.DASH_SLIDE_MS * (big ? 2 : 1);
    this.dashCd = PLAYER.DASH_COOLDOWN_MS;
    const r = this.radius();
    const fx = this.me.x - this.me.dirX * r;
    const fy = this.me.y - this.me.dirY * r;
    this.effects.fartCloud(fx, fy, big);
    play('fart', { big });
    if (big) {
      this.hud.toast(F.fill(F.pick(F.PEDO_NUCLEAR), { name: self.n }));
      this.effects.shake(250, 0.006);
    }
    net.send({ t: 'fart', x: Math.round(fx), y: Math.round(fy), big });
  }

  // ---------- red ----------

  setupNet() {
    const on = (t, fn) => eventBus.on(`net:${t}`, fn);
    const nameOf = (id) => gameState.players.get(id)?.n ?? 'Alguien';

    on('welcome', ({ spawn, phase }) => {
      this.me.x = spawn.x;
      this.me.y = spawn.y;
      if (phase !== 'lobby') this.hud.shout('PARTIDA EN CURSO', 'Te sumás a la próxima ronda', 2500);
    });

    on('joined', ({ id, name }) => {
      this.hud.toast(id === gameState.you ? `👋 Entraste como ${name}` : `👋 ${name} entró a la sala`);
      if (id !== gameState.you) play('pop');
    });
    on('left', ({ name }) => this.hud.toast(`🚪 ${name} se fue`));
    on('toast', ({ text }) => this.hud.toast(text));
    on('full', () => this.hud.shout('😬 SALA LLENA', 'Probá con otra sala: ?sala=otra', 99999));
    on('close', () => this.hud.toast('🔌 Se cortó la conexión, reintentando...'));

    on('round', ({ round, modifier, spawns }) => {
      this.hud.hideGameOver();
      this.dashCd = 0;
      this.slide = 0;
      const s = spawns[gameState.you];
      if (s) Object.assign(this.me, { x: s.x, y: s.y, vx: 0, vy: 0 });
      for (const [id, pos] of Object.entries(spawns)) {
        const b = this.blobs.get(id);
        if (b) Object.assign(b, { x: pos.x, y: pos.y });
      }
      gameState.modifier = modifier;
      gameState.round = round;
      this.hud.roundBanner(round, modifier);
      play('round');
      [3, 2, 1].forEach((n, i) => this.time.delayedCall(1700 + i * 500, () => {
        this.effects.popText(GAME.W / 2, GAME.H / 2 + 110, String(n), { size: 60, rise: 20, life: 380, depth: 91 });
        play('count');
      }));
    });

    on('go', ({ holder }) => {
      gameState.holder = holder;
      play('count', { final: true });
      const mine = holder === gameState.you;
      this.hud.shout(mine ? '¡LA TENÉS VOS! 💣' : '¡YA!', mine ? '¡Pasala, pasala!' : `💣 Arranca ${nameOf(holder)}`, 1000, mine ? '#ff5a3c' : '#ffffff');
      if (mine) this.effects.shake(200, 0.006);
    });

    on('pass', ({ from, to, heat, coward }) => {
      gameState.holder = to;
      const toB = this.blobs.get(to);
      const fromB = from ? this.blobs.get(from) : null;
      if (coward) {
        this.hud.toast(F.fill(F.COBARDE, { name: coward, to: nameOf(to) }));
        return;
      }
      play('slap');
      if (toB) {
        this.effects.popText(toB.x, toB.y - 40, F.pick(F.POP_PASE), { color: '#ffd23f', size: 38 });
        if (fromB) this.effects.sparks((toB.x + fromB.x) / 2, (toB.y + fromB.y) / 2);
      }
      const lines = heat >= 3 ? F.PASE_ULTIMO_SEGUNDO : F.PASE;
      this.hud.toast(F.fill(F.pick(lines), { from: nameOf(from), to: nameOf(to) }));
      // Cachetazo: los dos salen despedidos
      const other = gameState.you === from ? toB : gameState.you === to ? fromB : null;
      if (other) {
        const dx = this.me.x - other.x;
        const dy = this.me.y - other.y;
        const d = Math.hypot(dx, dy) || 1;
        this.me.vx += (dx / d) * PLAYER.PASS_KNOCKBACK;
        this.me.vy += (dy / d) * PLAYER.PASS_KNOCKBACK;
        this.slide = 160;
        this.effects.shake(140, 0.005);
      }
      if (gameState.you === to) this.hud.shout('¡LA TENÉS VOS!', '', 700, '#ff5a3c');
    });

    on('boom', ({ id, x, y }) => {
      const b = this.blobs.get(id);
      gameState.holder = null;

      this.effects.explosion(x, y, b?.color ?? 0xffffff);
      this.effects.popText(x, y - 30, F.pick(F.POP_BOOM), { size: 64, color: '#ff5a3c', life: 1300 });
      this.effects.shake(450, 0.02);
      this.effects.flash(150);
      play('boom');
      this.hud.toast(F.fill(F.pick(F.BOOM), { name: nameOf(id) }));
      const player = gameState.players.get(id) || { n: nameOf(id) };
      const avatar = gameState.avatars.get(id);
      this.time.delayedCall(300, () => {
        if (gameState.phase === 'boom') this.hud.showRoundLoser(player, avatar);
      });
    });

    on('gameover', ({ winner, champion, ranking }) => {
      this.hud.showGameOver(champion, ranking);
      play(winner === gameState.you ? 'fanfare' : 'sad');
      const wb = winner ? this.blobs.get(winner) : null;
      if (wb) {
        this.effects.confetti(wb.x, wb.y);
        this.time.delayedCall(700, () => this.effects.confetti(GAME.W / 2, 120));
      }
    });

    on('lobby', () => {
      this.hud.hideGameOver();
      this.hud.hideRoundLoser();
      this.hud.toast('🔁 De vuelta al lobby. ENTER para la revancha');
    });

    on('emote', ({ id, i }) => {
      const text = F.EMOTES[i];
      if (!text) return;
      this.blobs.get(id)?.say(text);
      play(i === 0 ? 'honk' : i === 1 ? 'laugh' : 'pop');
    });

    on('fart', ({ id, x, y, big }) => {
      if (id === gameState.you) return; // El impulso local ya reprodujo este efecto.
      this.effects.fartCloud(x, y, big);
      play('fart', { big });
      if (big) this.hud.toast(F.fill(F.pick(F.PEDO_NUCLEAR), { name: nameOf(id) }));
    });


  }

  // ---------- loop ----------

  update(_time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.05);
    const oldDashCd = this.dashCd;
    this.dashCd = Math.max(0, this.dashCd - deltaMs);
    if (gameState.phase === 'playing' && oldDashCd > 0 && this.dashCd === 0) play('ready');
    this.emoteCd = Math.max(0, this.emoteCd - deltaMs);
    this.slide = Math.max(0, this.slide - deltaMs);

    this.syncBlobs();
    this.moveLocal(dt);
    this.moveRemotes(dt);
    for (const b of this.blobs.values()) b.draw(dt);
    this.drawCooldown();
    this.drawTouch();
    this.drawDarkness();
    this.tickBeeps(deltaMs);
    this.tickTrail(deltaMs);
    this.effects.update(dt);
    this.hud.update();

    this.sendAcc += deltaMs;
    if (this.sendAcc >= 1000 / NET.SEND_HZ) {
      this.sendAcc = 0;
      net.send({ t: 's', x: Math.round(this.me.x), y: Math.round(this.me.y) });
    }
  }

  mod() {
    const inRound = ['countdown', 'playing', 'boom'].includes(gameState.phase);
    return MODIFIERS[inRound ? gameState.modifier : 'NORMAL'] ?? MODIFIERS.NORMAL;
  }

  radius() {
    return PLAYER.RADIUS * this.mod().radius;
  }

  syncBlobs() {
    for (const [id, p] of gameState.players) {
      let b = this.blobs.get(id);
      if (!b) {
        b = new Blob(this, id);
        b.x = p.x;
        b.y = p.y;
        b.isLocal = id === gameState.you;
        this.blobs.set(id, b);
      }
      b.name = p.n;
      b.color = p.c;
      b.wins = p.w;
      b.alive = p.a;
      b.setAvatar(gameState.avatars.get(id));
      b.holder = id === gameState.holder;
      b.heat = gameState.heat;
      b.radius = this.radius();
      b.target = p;
    }
    for (const [id, b] of this.blobs) {
      if (!gameState.players.has(id)) {
        b.destroy();
        this.blobs.delete(id);
      }
    }
  }

  moveLocal(dt) {
    const self = gameState.players.get(gameState.you);
    const b = this.blobs.get(gameState.you);
    if (!self || !b) return;
    if (!self.a || !self.ready) return;
    const mod = this.mod();
    const k = this.keys;

    let dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0) + this.touch.dx;
    let dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0) + this.touch.dy;
    if (mod.inverted) { dx = -dx; dy = -dy; }
    if (gameState.phase !== 'playing' && gameState.phase !== 'lobby') { dx = 0; dy = 0; }
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
      this.me.dirX = dx;
      this.me.dirY = dy;
    }

    const speed = PLAYER.SPEED * mod.speed * (b.holder ? PLAYER.HOLDER_SPEED_MULT : 1);
    let response = PLAYER.RESPONSE * mod.response;
    if (this.slide > 0) response *= 0.2;
    const blend = 1 - Math.exp(-response * dt);
    this.me.vx += (dx * speed - this.me.vx) * blend;
    this.me.vy += (dy * speed - this.me.vy) * blend;
    this.me.x += this.me.vx * dt;
    this.me.y += this.me.vy * dt;

    const r = this.radius();
    {
      // Los vivos se chocan entre sí (solo me corro yo; cada uno resuelve lo suyo)
      for (const o of this.blobs.values()) {
        if (o === b || !o.alive) continue;
        const ox = this.me.x - o.x;
        const oy = this.me.y - o.y;
        const d = Math.hypot(ox, oy);
        if (d > 0 && d < r * 2) {
          this.me.x = o.x + (ox / d) * r * 2;
          this.me.y = o.y + (oy / d) * r * 2;
        }
      }
      collide(this.me, r);
    }

    b.x = this.me.x;
    b.y = this.me.y;
    b.vx = this.me.vx;
    b.vy = this.me.vy;
  }

  moveRemotes(dt) {
    const blend = 1 - Math.exp(-15 * dt);
    for (const b of this.blobs.values()) {
      if (b.isLocal || !b.target) continue;
      const nx = b.x + (b.target.x - b.x) * blend;
      const ny = b.y + (b.target.y - b.y) * blend;
      b.vx = (nx - b.x) / dt;
      b.vy = (ny - b.y) / dt;
      b.x = nx;
      b.y = ny;
    }
  }

  drawCooldown() {
    const g = this.cooldownBar.clear();
    const self = gameState.players.get(gameState.you);
    const b = this.blobs.get(gameState.you);
    if (!self || !b) return;
    const left = this.dashCd / PLAYER.DASH_COOLDOWN_MS;
    if (left <= 0) return;
    const w = 40;
    const x = b.x - w / 2;
    const y = b.y + b.radius + 28;
    g.fillStyle(0x000000, 0.5).fillRect(x, y, w, 5);
    g.fillStyle(0x9bd35a).fillRect(x, y, w * (1 - left), 5);
  }

  drawDarkness() {
    const on = this.mod().dark === true;
    this.dark.setVisible(on);
    if (!on) return;
    const g = this.lights.clear().fillStyle(0xffffff);
    for (const b of this.blobs.values()) {
      if (!b.alive) continue;
      const flicker = Math.random() * 6;
      g.fillCircle(b.x, b.y, (b.holder ? 170 + gameState.heat * 25 : b.isLocal ? 120 : 75) + flicker);
    }
  }

  tickBeeps(deltaMs) {
    const mine = gameState.holder === gameState.you;
    const pulse = gameState.phase === 'playing' ? gameState.heat : -1;
    // Pantalla roja cuando la tenés vos
    const base = mine ? 0.05 + pulse * 0.04 : pulse === 3 ? 0.04 : 0;
    this.danger.setAlpha(base > 0 ? base * (0.6 + 0.4 * Math.sin(this.time.now / (140 - pulse * 25))) : 0);
    if (pulse < 0) return;
    this.beepAcc += deltaMs;
    if (this.beepAcc >= BEEP_MS[pulse]) {
      this.beepAcc = 0;
      play('beep', { heat: pulse, loud: mine });
    }
  }

  tickTrail(deltaMs) {
    if (gameState.phase !== 'playing') { this.trailAcc = 0; return; }
    const holder = this.blobs.get(gameState.holder);
    if (!holder) return;
    this.trailAcc += deltaMs;
    const interval = gameState.heat >= 2 ? 70 : 130;
    if (this.trailAcc < interval) return;
    this.trailAcc = 0;
    const color = gameState.heat >= 2 ? 0xff6544 : 0xffd065;
    this.effects.burst(holder.x + (Math.random() - 0.5) * 22, holder.y + 12, {
      count: 1, colors: [color], speed: 35, life: 0.4, size: 4, alpha: 0.65, depth: 7,
    });
  }
}
