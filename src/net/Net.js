import PartySocket from 'partysocket';
import { eventBus } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { NET } from '../core/Constants.js';

// Todo mensaje del servidor sale por el EventBus como `net:<tipo>`.
class Net {
  constructor() {
    this.socket = null;
  }

  connect(room, name, profileId, avatar) {
    if (name !== undefined) this.profile = { t: 'hello', name, profileId, avatar };
    this.draftProfileId = profileId;
    if (this.socket?.readyState === 1) {
      if (this.profile) this.socket.send(JSON.stringify(this.profile));
      return;
    }
    if (this.socket?.readyState === 0) return;
    this.socket?.close();
    // PartySocket fuerza wss/ para cualquier host que no sea local. Acá el juego y
    // el WebSocket los sirve el mismo server, así que seguimos el protocolo de la
    // página: http -> ws, https -> wss. Sin esto, servido por HTTP plano no conecta.
    const secure = typeof location !== 'undefined' && location.protocol === 'https:';
    this.socket = new PartySocket({ host: NET.SERVER_URL, room, protocol: secure ? 'wss' : 'ws' });
    this.socket.addEventListener('open', () => {
      gameState.connected = true;
      // Directo al socket: en el evento 'open' readyState todavía puede no ser 1.
      this.socket.send(JSON.stringify(this.profile || { t: 'loadProfile', profileId: this.draftProfileId }));
      eventBus.emit('net:open');
    });
    this.socket.addEventListener('close', () => {
      gameState.connected = false;
      eventBus.emit('net:close');
    });
    this.socket.addEventListener('message', (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (!msg?.t) return;
      if (msg.t === 'welcome') {
        gameState.you = msg.you;
        gameState.players.clear();
        gameState.avatars = new Map((msg.avatars || []).map(({ id, avatar }) => [id, avatar]));
      }
      if (msg.t === 'avatar') gameState.avatars.set(msg.id, msg.avatar);
      if (msg.t === 'full') this.socket.close();
      if (msg.t === 'w') this.applyWorld(msg);
      eventBus.emit(`net:${msg.t}`, msg);
    });
  }

  applyWorld(msg) {
    gameState.phase = msg.phase;
    gameState.holder = msg.holder;
    gameState.heat = msg.heat;
    gameState.modifier = msg.modifier;
    gameState.round = msg.round;
    gameState.totalRounds = msg.totalRounds ?? 5;
    const seen = new Set();
    for (const p of msg.p) {
      seen.add(p.id);
      gameState.players.set(p.id, p);
    }
    for (const id of gameState.players.keys()) {
      if (!seen.has(id)) {
        gameState.players.delete(id);
        gameState.avatars.delete(id);
      }
    }
  }

  send(msg) {
    if (this.socket?.readyState !== 1) return;
    this.socket.send(JSON.stringify(msg));
  }
}

export const net = new Net();
