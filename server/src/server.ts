import type * as Party from 'partykit/server';

// El servidor es la autoridad: decide quién tiene la bomba, cuándo explota,
// las rondas y los modificadores. Los clientes solo mandan su posición.

const MAX_PLAYERS = 8;
const ARENA = { W: 1280, H: 720, MARGIN: 40 };
const RADIUS = 22;
const TAG_SLACK = 6;
const TICK_MS = 50;
const IMMUNE_MS = 1200;
const COUNTDOWN_MS = 3200;
const BETWEEN_ROUNDS_MS = 3800;
const GAMEOVER_MS = 10000;
const FUSE_MIN_MS = 12000;
const FUSE_MAX_MS = 24000;
const MAX_MESSAGE_BYTES = 48000;
const TOTAL_ROUNDS = 5;
const RATE_LIMIT_PER_SEC = 45;

const COLORS = [0xff4d4d, 0x3fa7ff, 0x4be37a, 0xffd23f, 0xc86bff, 0xff8c2e, 0x2ee6d6, 0xff6fb5];

// Dificultad fija por ronda, no aleatoria: 1ª normal, 2ª noche, 3ª invertido, 4ª y 5ª normal.
// El índice es la ronda - 1; si alguna vez hay más rondas que entradas, sigue en normal.
const ROUND_MODIFIERS = ['NORMAL', 'APAGON', 'INVERTIDOS', 'NORMAL', 'NORMAL'] as const;

const SPAWNS = [
  { x: 640, y: 110 }, { x: 640, y: 610 }, { x: 150, y: 360 }, { x: 1130, y: 360 },
  { x: 190, y: 120 }, { x: 1090, y: 600 }, { x: 1090, y: 120 }, { x: 190, y: 600 },
];

type Phase = 'lobby' | 'countdown' | 'playing' | 'boom' | 'gameover';

type Avatar = { color: number; head: string; hairColor: number; strokes: { w: number; points: [number, number][] }[] };

type Stats = { bombMs: number; passes: number; farts: number };

type Player = {
  id: string;
  name: string;
  color: number;
  x: number;
  y: number;
  alive: boolean; // participa en la ronda; nadie queda eliminado
  ready: boolean;
  avatar: Avatar | null;
  score: number;
  saving: boolean;
  loaded: boolean;
  wins: number;
  stats: Stats;
};

type ClientMsg =
  | { t: 'hello'; name: string; profileId: string; avatar?: Avatar }
  | { t: 'loadProfile'; profileId: string }
  | { t: 's'; x: number; y: number }
  | { t: 'start' }
  | { t: 'emote'; i: number }
  | { t: 'fart'; x: number; y: number; big: boolean };

export default class Room implements Party.Server {
  players = new Map<string, Player>();
  rates = new Map<string, { start: number; count: number }>();

  phase: Phase = 'lobby';
  round = 0;
  modifier = 'NORMAL';
  holder: string | null = null;
  holdingSince = 0;
  fuseEndsAt = 0;
  immune = new Map<string, number>();

  tickTimer: ReturnType<typeof setInterval> | null = null;
  phaseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly room: Party.Room) {}

  // ---------- conexión ----------

  onConnect(conn: Party.Connection) {
    if (this.players.size >= MAX_PLAYERS) {
      conn.send(JSON.stringify({ t: 'full' }));
      conn.close();
      return;
    }
    const spawn = SPAWNS[this.players.size % SPAWNS.length];
    const player: Player = {
      id: conn.id,
      name: 'Anónimo',
      color: this.freeColor(),
      x: spawn.x,
      y: spawn.y,
      // El personaje queda listo después de guardar su dibujo.
      alive: false,
      ready: false,
      avatar: null,
      score: 0,
      saving: false,
      loaded: false,
      wins: 0,
      stats: { bombMs: 0, passes: 0, farts: 0 },
    };
    this.players.set(conn.id, player);
    conn.send(JSON.stringify({
      t: 'welcome',
      you: conn.id,
      phase: this.phase,
      round: this.round,
      modifier: this.modifier,
      spawn,
      avatars: [...this.players.values()].filter((p) => p.avatar).map((p) => ({ id: p.id, avatar: p.avatar })),
    }));
    this.ensureTick();
  }

  onClose(conn: Party.Connection) {
    const p = this.players.get(conn.id);
    if (!p) return;
    this.players.delete(conn.id);
    this.rates.delete(conn.id);
    this.immune.delete(conn.id);
    this.broadcast({ t: 'left', id: conn.id, name: p.name });

    if (this.players.size === 0) {
      this.resetToLobby(false);
      this.stopTick();
      return;
    }
    if (this.phase === 'lobby' || this.phase === 'gameover') return;

    const alive = this.alivePlayers();
    if (alive.length <= 1) {
      this.clearPhaseTimer();
      this.resetToLobby(true);
      this.broadcast({ t: 'toast', text: 'La partida se pausó: hace falta al menos 2. Todos vuelven al lobby.' });
      return;
    }
    if (this.holder === conn.id && this.phase === 'playing') {
      // El que tenía la bomba huyó: se la damos a otro al azar.
      const next = pick(alive);
      this.holder = next.id;
      this.holdingSince = Date.now();
      this.broadcast({ t: 'pass', from: null, to: next.id, heat: this.heat(), coward: p.name });
    }
  }

  async onMessage(raw: string, sender: Party.Connection) {
    if (raw.length > MAX_MESSAGE_BYTES || !this.rateOk(sender.id)) return;
    let msg: ClientMsg;
    try { msg = JSON.parse(raw); } catch { return; }
    const p = this.players.get(sender.id);
    if (!p || !msg || typeof msg !== 'object') return;

    switch (msg.t) {
      case 'loadProfile': {
        if (p.loaded || p.ready || typeof msg.profileId !== 'string' || !/^[a-zA-Z0-9-]{8,64}$/.test(msg.profileId)) return;
        p.loaded = true;
        try {
          const avatar = validateAvatar(await this.room.storage.get<Avatar>(`avatar:${msg.profileId}`));
          sender.send(JSON.stringify({ t: 'profileDraft', avatar }));
        } catch { /* Puede dibujar un personaje nuevo si no hay copia. */ }
        return;
      }
      case 'hello': {
        if (p.ready) {
          sender.send(JSON.stringify({ t: 'profileSaved', avatar: p.avatar }));
          return;
        }
        if (p.saving) return;
        if (typeof msg.profileId !== 'string' || !/^[a-zA-Z0-9-]{8,64}$/.test(msg.profileId)) return;
        p.saving = true;
        try {
          const avatar = validateAvatar(msg.avatar ?? await this.room.storage.get<Avatar>(`avatar:${msg.profileId}`));
          if (!avatar) {
            sender.send(JSON.stringify({ t: 'profileError', text: 'Dibujá tu cara antes de marcarte listo.' }));
            return;
          }
          await this.room.storage.put(`avatar:${msg.profileId}`, avatar);
          if (this.players.get(sender.id) !== p) return;
          p.name = cleanName(msg.name);
          p.avatar = avatar;
          p.color = avatar.color;
          p.ready = true;
          p.alive = this.phase === 'lobby';
          this.broadcast({ t: 'avatar', id: p.id, avatar });
          sender.send(JSON.stringify({ t: 'profileSaved', avatar }));
          this.broadcast({ t: 'joined', id: p.id, name: p.name });
          this.tick();
        } catch {
          sender.send(JSON.stringify({ t: 'profileError', text: 'No se pudo guardar tu dibujo. Intentá de nuevo.' }));
        } finally { p.saving = false; }
        return;
      }
      case 's': {
        if (!p.ready || !isNum(msg.x) || !isNum(msg.y)) return;
        if (!p.alive && this.phase !== 'lobby') return;
        p.x = clamp(msg.x, 0, ARENA.W);
        p.y = clamp(msg.y, 0, ARENA.H);
        if (this.phase === 'playing') this.checkTag();
        return;
      }
      case 'start': {
        if (this.phase !== 'lobby' || !p.ready) return;
        if (this.players.size < 2) {
          sender.send(JSON.stringify({ t: 'toast', text: 'Hace falta al menos 2 para jugar. Invitá a alguien 🙃' }));
          return;
        }
        if ([...this.players.values()].some((player) => !player.ready)) {
          sender.send(JSON.stringify({ t: 'toast', text: 'Esperá a que todos terminen de dibujar su personaje.' }));
          return;
        }
        this.startGame(p.name);
        return;
      }
      case 'emote': {
        if (!p.ready) return;
        const i = Number(msg.i);
        if (!Number.isInteger(i) || i < 0 || i > 9) return;
        this.broadcast({ t: 'emote', id: p.id, i });
        return;
      }
      case 'fart': {
        if (!p.ready || !p.alive || !['lobby', 'playing'].includes(this.phase)) return;
        if (!isNum(msg.x) || !isNum(msg.y)) return;
        p.stats.farts += 1;
        this.broadcast({ t: 'fart', id: p.id, x: msg.x, y: msg.y, big: !!msg.big }, [p.id]);
        return;
      }

    }
  }

  // ---------- flujo de partida ----------

  startGame(byName: string) {
    this.clearPhaseTimer();
    for (const p of this.players.values()) {
      p.alive = p.ready;
      p.score = 0;
      p.stats = { bombMs: 0, passes: 0, farts: 0 };
    }
    this.round = 0;
    this.broadcast({ t: 'toast', text: `🎬 ${byName} arrancó la partida` });
    this.nextRound();
  }

  nextRound() {
    if ([...this.players.values()].filter((p) => p.ready).length < 2) return this.resetToLobby(true);
    for (const p of this.players.values()) p.alive = p.ready;
    this.round += 1;
    this.modifier = ROUND_MODIFIERS[this.round - 1] ?? 'NORMAL';
    this.holder = null;
    this.immune.clear();
    const alive = shuffle(this.alivePlayers());
    const spawns: Record<string, { x: number; y: number }> = {};
    alive.forEach((p, i) => {
      const s = SPAWNS[i % SPAWNS.length];
      p.x = s.x;
      p.y = s.y;
      spawns[p.id] = s;
    });
    this.phase = 'countdown';
    this.broadcast({ t: 'round', round: this.round, modifier: this.modifier, spawns, ms: COUNTDOWN_MS });
    this.phaseTimer = setTimeout(() => this.beginPlay(), COUNTDOWN_MS);
  }

  beginPlay() {
    const alive = this.alivePlayers();
    if (alive.length <= 1) return this.resetToLobby(true);
    this.phase = 'playing';
    const first = pick(alive);
    this.holder = first.id;
    this.holdingSince = Date.now();
    // Con menos gente, mecha más corta: que no se haga eterno.
    const scale = 0.7 + 0.3 * Math.min(1, alive.length / 6);
    const fuse = (FUSE_MIN_MS + Math.random() * (FUSE_MAX_MS - FUSE_MIN_MS)) * scale;
    this.fuseEndsAt = Date.now() + fuse;
    this.broadcast({ t: 'go', holder: first.id });
    this.phaseTimer = setTimeout(() => this.explode(), fuse);
  }

  checkTag() {
    if (!this.holder) return;
    const h = this.players.get(this.holder);
    if (!h || !h.alive) return;
    const r = RADIUS * (this.modifier === 'CABEZONES' ? 1.6 : 1);
    const reach = r * 2 + TAG_SLACK;
    const now = Date.now();
    for (const p of this.players.values()) {
      if (p.id === h.id || !p.alive) continue;
      if ((this.immune.get(p.id) ?? 0) > now) continue;
      if (Math.hypot(p.x - h.x, p.y - h.y) <= reach) {
        this.pass(h, p);
        return;
      }
    }
  }

  pass(from: Player, to: Player) {
    const now = Date.now();
    from.stats.bombMs += now - this.holdingSince;
    from.stats.passes += 1;
    this.holder = to.id;
    this.holdingSince = now;
    this.immune.set(from.id, now + IMMUNE_MS);
    this.broadcast({ t: 'pass', from: from.id, to: to.id, heat: this.heat() });
  }

  explode() {
    const victim = this.holder ? this.players.get(this.holder) : null;
    this.holder = null;
    this.phase = 'boom';
    if (victim) {
      victim.stats.bombMs += Date.now() - this.holdingSince;
      this.broadcast({ t: 'boom', id: victim.id, x: victim.x, y: victim.y });
    }
    for (const player of this.alivePlayers()) {
      if (victim && player.id !== victim.id) player.score += 1;
    }
    this.tick();
    this.phaseTimer = setTimeout(
      () => (this.round >= TOTAL_ROUNDS ? this.finishGame() : this.nextRound()),
      BETWEEN_ROUNDS_MS,
    );
  }

  finishGame() {
    this.clearPhaseTimer();
    this.holder = null;
    this.phase = 'gameover';
    const ranking = this.alivePlayers().sort((a, b) => b.score - a.score || a.stats.bombMs - b.stats.bombMs || b.stats.passes - a.stats.passes || a.id.localeCompare(b.id));
    const winner = ranking[0] ?? null;
    if (winner) winner.wins += 1;
    const all = [...this.players.values()];
    const best = (key: keyof Stats) => {
      const top = all.slice().sort((a, b) => b.stats[key] - a.stats[key])[0];
      return top && top.stats[key] > 0 ? { name: top.name, value: top.stats[key] } : null;
    };
    this.broadcast({
      t: 'gameover',
      winner: winner?.id ?? null,
      champion: winner ? { id: winner.id, n: winner.name, c: winner.color, score: winner.score, avatar: winner.avatar } : null,
      ranking: ranking.map((p) => ({ id: p.id, name: p.name, score: p.score, bombMs: p.stats.bombMs, passes: p.stats.passes, farts: p.stats.farts })),
      stats: { bombMs: best('bombMs'), passes: best('passes'), farts: best('farts') },
      ms: GAMEOVER_MS,
    });
    this.phaseTimer = setTimeout(() => this.resetToLobby(true), GAMEOVER_MS);
  }

  resetToLobby(notify: boolean) {
    this.clearPhaseTimer();
    this.phase = 'lobby';
    this.round = 0;
    this.modifier = 'NORMAL';
    this.holder = null;
    this.immune.clear();
    for (const p of this.players.values()) { p.alive = p.ready; p.score = 0; }
    if (notify) this.broadcast({ t: 'lobby' });
  }

  // ---------- tick ----------

  ensureTick() {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick(), TICK_MS);
  }

  stopTick() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  tick() {
    const p = [...this.players.values()].map((pl) => ({
      id: pl.id,
      n: pl.name,
      c: pl.color,
      x: Math.round(pl.x),
      y: Math.round(pl.y),
      a: pl.alive,
      w: pl.wins,
      ready: pl.ready,
      score: pl.score,
    }));
    this.broadcast({
      t: 'w',
      p,
      phase: this.phase,
      holder: this.holder,
      heat: this.phase === 'playing' ? this.heat() : 0,
      modifier: this.modifier,
      round: this.round,
      totalRounds: TOTAL_ROUNDS,
    });
  }

  // Nadie sabe cuánto dura la mecha, solo lo "caliente" que está.
  heat() {
    const left = this.fuseEndsAt - Date.now();
    if (left > 8000) return 0;
    if (left > 4000) return 1;
    if (left > 1500) return 2;
    return 3;
  }

  // ---------- utilidades ----------

  alivePlayers() {
    return [...this.players.values()].filter((p) => p.alive);
  }

  freeColor() {
    const used = new Set([...this.players.values()].map((p) => p.color));
    return COLORS.find((c) => !used.has(c)) ?? pick(COLORS);
  }

  clearPhaseTimer() {
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = null;
  }

  broadcast(msg: unknown, without: string[] = []) {
    this.room.broadcast(JSON.stringify(msg), without);
  }

  rateOk(id: string) {
    const now = Date.now();
    const r = this.rates.get(id);
    if (!r || now - r.start > 1000) {
      this.rates.set(id, { start: now, count: 1 });
      return true;
    }
    r.count += 1;
    return r.count <= RATE_LIMIT_PER_SEC;
  }
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cleanName(raw: unknown) {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return name || 'Anónimo';
}

function validateAvatar(raw: unknown): Avatar | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Avatar;
  if (!Number.isInteger(a.color) || a.color < 0 || a.color > 0xffffff) return null;
  if (!Array.isArray(a.strokes) || a.strokes.length < 1 || a.strokes.length > 96) return null;
  let count = 0;
  const strokes: Avatar['strokes'] = [];
  for (const stroke of a.strokes) {
    if (!stroke || ![20, 40, 65].includes(stroke.w) || !Array.isArray(stroke.points) || !stroke.points.length) return null;
    count += stroke.points.length;
    if (count > 2000) return null;
    const points: [number, number][] = [];
    for (const point of stroke.points) {
      if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isInteger) || Math.hypot(point[0], point[1]) > 952) return null;
      points.push([point[0], point[1]]);
    }
    strokes.push({ w: stroke.w, points });
  }
  const head = a.head ?? 'none';
  const hairColor = a.hairColor ?? 0x33202b;
  if (!['none', 'tuft', 'curls', 'mohawk', 'pigtails', 'bowl', 'cap', 'hat'].includes(head)) return null;
  if (!Number.isInteger(hairColor) || hairColor < 0 || hairColor > 0xffffff) return null;
  return { color: a.color, head, hairColor, strokes };
}

Room satisfies Party.Worker;
