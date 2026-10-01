import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const requireServer = createRequire(new URL('../server/package.json', import.meta.url));
const ts = requireServer('typescript');
const source = readFileSync(new URL('../server/src/server.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { default: Room } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const avatar = {
  color: 0x92df71, head: 'hat', hairColor: 0x875136,
  strokes: [{ w: 40, points: [[-300, 400], [0, 550], [300, 400]] }],
};

function fixture(t, saved = new Map()) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: 100000 });
  const messages = [];
  const storage = { get: async (key) => saved.get(key), put: async (key, value) => saved.set(key, structuredClone(value)) };
  const room = new Room({ storage, broadcast: (raw) => messages.push(JSON.parse(raw)) });
  const connect = (id) => {
    const conn = { id, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); }, close() {} };
    room.onConnect(conn);
    return conn;
  };
  const send = (conn, message) => room.onMessage(JSON.stringify(message), conn);
  const ready = (conn, drawing = avatar) => send(conn, { t: 'hello', name: conn.id, profileId: `profile-${conn.id}`, avatar: drawing });
  return { room, saved, messages, connect, send, ready };
}

test('guarda la cara y accesorios antes de marcar listo; espera a todos para empezar', async (t) => {
  const f = fixture(t);
  const a = f.connect('Ana'); const b = f.connect('Beto');
  assert.equal(f.room.players.get(a.id).ready, false);
  await f.ready(a);
  assert.deepEqual(f.saved.get('avatar:profile-Ana'), avatar);
  assert.equal(f.room.players.get(a.id).name, 'Ana');
  assert.equal(f.room.players.get(a.id).ready, true);
  await f.send(a, { t: 'start' });
  assert.equal(f.room.phase, 'lobby');
  assert.match(a.messages.at(-1).text, /dibujar/);
  await f.ready(b);
  await f.send(a, { t: 'start' });
  assert.equal(f.room.phase, 'countdown');
  assert.equal(f.room.round, 1);
  // Las caras se mandan como eventos, no veinte veces por segundo.
  assert.ok(f.messages.some((m) => m.t === 'avatar' && m.avatar.head === 'hat'));
  f.room.tick();
  assert.equal('avatar' in f.messages.at(-1).p[0], false);
});

test('cinco rondas, ninguna eliminación, puntaje correcto y podio con el personaje ganador', async (t) => {
  const f = fixture(t);
  const players = ['Ana', 'Beto', 'Cami'].map(f.connect);
  for (const player of players) await f.ready(player);
  await f.send(players[0], { t: 'start' });
  for (let round = 1; round <= 5; round++) {
    assert.equal(f.room.round, round);
    t.mock.timers.tick(3200);
    assert.equal(f.room.phase, 'playing');
    // La misma persona pierde: aun así participa en las cinco rondas.
    f.room.holder = 'Ana';
    t.mock.timers.tick(f.room.fuseEndsAt - Date.now());
    assert.equal(f.room.phase, 'boom');
    assert.equal(f.room.alivePlayers().length, 3);
    assert.equal(f.room.players.get('Ana').score, 0);
    assert.equal(f.room.players.get('Beto').score, round);
    assert.equal(f.room.players.get('Cami').score, round);
    // Desempata quien tuvo menos tiempo con la bomba.
    f.room.players.get('Beto').stats.bombMs = 200;
    f.room.players.get('Cami').stats.bombMs = 500;
    t.mock.timers.tick(3800);
  }
  assert.equal(f.room.phase, 'gameover');
  const result = f.messages.find((m) => m.t === 'gameover');
  assert.equal(result.winner, 'Beto');
  assert.deepEqual(result.champion.avatar, avatar);
  assert.deepEqual(result.ranking.map((p) => p.score), [5, 5, 0]);
  for (const entry of result.ranking) {
    const stats = f.room.players.get(entry.id).stats;
    assert.equal(entry.bombMs, stats.bombMs);
    assert.equal(entry.passes, stats.passes);
    assert.equal(entry.farts, stats.farts);
  }
  t.mock.timers.tick(10000);
  assert.equal(f.room.phase, 'lobby');
  assert.ok([...f.room.players.values()].every((p) => p.ready && p.alive && p.score === 0));
});

test('recupera el dibujo del almacenamiento al reconectar y lo muestra a nuevos jugadores', async (t) => {
  const f = fixture(t);
  const first = f.connect('Ana'); await f.ready(first);
  f.room.onClose(first);
  const next = f.connect('Ana2');
  await f.send(next, { t: 'loadProfile', profileId: 'profile-Ana' });
  assert.deepEqual(next.messages.at(-1).avatar, avatar);
  assert.equal(f.room.players.get('Ana2').ready, false);
  await f.send(next, { t: 'hello', name: 'Ana', profileId: 'profile-Ana' });
  assert.equal(f.room.players.get('Ana2').ready, true);
  const newcomer = f.connect('Beto');
  assert.deepEqual(newcomer.messages.find((m) => m.t === 'welcome').avatars[0].avatar, avatar);
});

test('entrada tardía se suma a la próxima ronda; desconexión no regala una victoria', async (t) => {
  const f = fixture(t);
  const a = f.connect('Ana'); const b = f.connect('Beto');
  await f.ready(a); await f.ready(b); await f.send(a, { t: 'start' });
  t.mock.timers.tick(3200);
  const c = f.connect('Cami'); await f.ready(c);
  assert.equal(f.room.players.get(c.id).alive, false);
  t.mock.timers.tick(f.room.fuseEndsAt - Date.now());
  assert.equal(f.room.players.get(c.id).score, 0);
  t.mock.timers.tick(3800);
  assert.equal(f.room.players.get(c.id).alive, true);
  f.room.onClose(b); f.room.onClose(c);
  assert.equal(f.room.phase, 'lobby');
  assert.equal(f.messages.some((m) => m.t === 'gameover'), false);
});

test('rechaza dibujos inválidos y no marca listo si falla el guardado', async (t) => {
  const f = fixture(t);
  const a = f.connect('Ana');
  const invalid = [
    { ...avatar, strokes: [] }, { ...avatar, head: 'unknown' }, { ...avatar, hairColor: -1 },
    { ...avatar, strokes: [{ w: 40, points: [[5000, 0]] }] },
    { ...avatar, strokes: [{ w: 40, points: Array.from({ length: 2001 }, () => [0, 400]) }] },
  ];
  for (const drawing of invalid) {
    await f.ready(a, drawing);
    assert.equal(f.room.players.get(a.id).ready, false);
    assert.equal(a.messages.at(-1).t, 'profileError');
  }
  f.room.room.storage.put = async () => { throw new Error('storage unavailable'); };
  await f.ready(a);
  assert.equal(f.room.players.get(a.id).ready, false);
  assert.equal(a.messages.at(-1).t, 'profileError');
});


test('reintentar un personaje ya guardado vuelve a confirmar sin repetir el ingreso', async (t) => {
  const f = fixture(t);
  const a = f.connect('Ana');
  await f.ready(a);
  a.messages.length = 0;
  const joined = f.messages.filter((m) => m.t === 'joined').length;
  await f.ready(a);
  assert.deepEqual(a.messages.at(-1), { t: 'profileSaved', avatar });
  assert.equal(f.messages.filter((m) => m.t === 'joined').length, joined);
});

test('la dificultad de cada ronda es fija: normal, noche, invertido, normal, normal', async (t) => {
  const f = fixture(t);
  const a = f.connect('Ana');
  const b = f.connect('Beto');
  await f.ready(a);
  await f.ready(b);

  const porRonda = [];
  for (let i = 0; i < 5; i += 1) {
    f.room.nextRound();
    porRonda.push([f.room.round, f.room.modifier]);
  }
  assert.deepEqual(porRonda, [
    [1, 'NORMAL'], [2, 'APAGON'], [3, 'INVERTIDOS'], [4, 'NORMAL'], [5, 'NORMAL'],
  ]);
});
