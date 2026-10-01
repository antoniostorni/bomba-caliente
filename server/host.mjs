// Corre el mismo server/src/server.ts —escrito contra la API de PartyKit— en Node
// pelado: un único proceso que sirve dist/ y atiende el WebSocket en el mismo
// puerto, sin saltos intermedios. Hace falta porque el runtime de PartyKit
// (workerd) pide glibc >= 2.29 y el servidor donde corre esto tiene 2.27.
// La superficie que usa el juego es chica: broadcast, storage.get/put y
// conexiones con id/send/close, que es la misma que arman los tests.
import http from 'node:http';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, '..', 'dist');
const PORT = Number(process.env.PORT) || 3500;
const STORAGE_FILE = process.env.STORAGE_FILE || path.join(HERE, 'storage.json');
const { default: Room } = await import(pathToFileURL(path.join(HERE, 'build', 'server.mjs')).href);

// ---------- almacenamiento (lo que PartyKit persiste por sala) ----------
let disk = {};
try { disk = JSON.parse(await fsp.readFile(STORAGE_FILE, 'utf8')); } catch { disk = {}; }
let pendingSave = null;
function scheduleSave() {
  if (pendingSave) return;
  pendingSave = setTimeout(async () => {
    pendingSave = null;
    const tmp = `${STORAGE_FILE}.tmp`;
    try {
      await fsp.writeFile(tmp, JSON.stringify(disk));
      await fsp.rename(tmp, STORAGE_FILE); // atómico: nunca queda un JSON a medio escribir
    } catch (error) { console.error('no se pudo guardar el storage:', error.message); }
  }, 300);
}
function storageFor(roomName) {
  const bucket = (disk[roomName] ??= {});
  return {
    async get(key) { const v = bucket[key]; return v === undefined ? undefined : structuredClone(v); },
    async put(key, value) { bucket[key] = structuredClone(value); scheduleSave(); },
    async delete(key) { delete bucket[key]; scheduleSave(); },
  };
}

// ---------- salas ----------
const rooms = new Map();
function getRoom(name) {
  let entry = rooms.get(name);
  if (entry) return entry;
  const sockets = new Map(); // id -> ws
  const party = {
    id: name,
    storage: storageFor(name),
    broadcast(raw, without = []) {
      for (const [id, ws] of sockets) {
        if (without.includes(id) || ws.readyState !== ws.OPEN) continue;
        ws.send(raw);
      }
    },
    getConnections() { return sockets.keys(); },
  };
  entry = { sockets, server: new Room(party) };
  rooms.set(name, entry);
  return entry;
}

// ---------- archivos estáticos ----------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json',
};
async function serveStatic(request, response) {
  const { pathname } = new URL(request.url, 'http://local');
  if (pathname === '/health') {
    const players = [...rooms.values()].reduce((n, r) => n + r.sockets.size, 0);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size, players, uptime: Math.round(process.uptime()) }));
    return;
  }
  const wanted = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  const file = path.join(DIST, wanted);
  // Nada afuera de dist/, pase lo que pase en la URL.
  if (file !== DIST && !file.startsWith(DIST + path.sep)) { response.writeHead(403).end(); return; }
  try {
    const body = await fsp.readFile(file);
    response.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': path.basename(file) === 'index.html' ? 'no-cache' : 'public, max-age=3600',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('no está');
  }
}

const server = http.createServer((req, res) => {
  serveStatic(req, res).catch((error) => {
    console.error('error sirviendo', req.url, error.message);
    if (!res.headersSent) res.writeHead(500).end();
  });
});

// ---------- WebSocket: mismas rutas que PartyKit (/parties/<party>/<sala>) ----------
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, 'http://local');
  const match = url.pathname.match(/^\/parties\/([^/]+)\/([^/]+)\/?$/);
  if (!match) { socket.destroy(); return; }
  const roomName = decodeURIComponent(match[2]).slice(0, 64);
  wss.handleUpgrade(request, socket, head, (ws) => {
    const room = getRoom(roomName);
    let id = (url.searchParams.get('_pk') || randomUUID()).slice(0, 64);
    while (room.sockets.has(id)) id = randomUUID(); // dos pestañas no pueden compartir id
    room.sockets.set(id, ws);
    const conn = {
      id,
      send(raw) { if (ws.readyState === ws.OPEN) ws.send(raw); },
      close(...args) { ws.close(...args); },
    };
    const fail = (where) => (error) => console.error(`${where} en sala ${roomName}:`, error?.message || error);
    ws.on('message', (data) => {
      try { Promise.resolve(room.server.onMessage(String(data), conn)).catch(fail('onMessage')); }
      catch (error) { fail('onMessage')(error); }
    });
    ws.on('error', () => {}); // el close limpia igual
    ws.on('close', () => {
      room.sockets.delete(id);
      try { room.server.onClose?.(conn); } catch (error) { fail('onClose')(error); }
      // Sala vacía: onClose ya frenó sus timers; la soltamos para no acumular memoria.
      if (room.sockets.size === 0) rooms.delete(roomName);
    });
    try { room.server.onConnect(conn); } catch (error) { fail('onConnect')(error); }
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Bomba Caliente en http://localhost:${PORT}`));
