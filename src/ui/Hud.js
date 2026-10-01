import { GAME, FONT } from '../core/Constants.js';
import { gameState } from '../core/GameState.js';
import { MODIFICADORES } from '../content/frases.js';
import { avatarTexture } from '../avatar/Avatar.js';
import { net } from '../net/Net.js';
import { DisasterPhoto } from './DisasterPhoto.js';

const txt = (scene, x, y, size, opts = {}) => scene.add.text(x, y, '', {
  fontFamily: FONT, fontSize: `${size}px`, fontStyle: '800', color: '#ffffff',
  stroke: '#120a22', strokeThickness: Math.max(4, size / 7), align: 'center', ...opts,
}).setDepth(90);

export class Hud {
  constructor(scene) {
    this.scene = scene;
    this.toasts = [];

    this.chip = txt(scene, 52, 50, 20, { align: 'left' }).setOrigin(0, 0);
    this.status = txt(scene, 54, 83, 17, { align: 'left', fontStyle: '700' }).setOrigin(0, 0);
    this.help = txt(scene, GAME.W / 2, GAME.H - 12, 17, { fontStyle: '700', color: '#d9ccff' }).setOrigin(0.5, 1);
    this.board = txt(scene, GAME.W - 52, 50, 17, { align: 'right', fontStyle: '700' }).setOrigin(1, 0);
    this.heatTitle = txt(scene, GAME.W / 2, 48, 17, { color: '#ffd982' }).setOrigin(0.5, 0);
    this.heatBar = scene.add.graphics().setDepth(89);

    this.big = txt(scene, GAME.W / 2, GAME.H / 2 - 40, 84).setOrigin(0.5).setVisible(false);
    this.sub = txt(scene, GAME.W / 2, GAME.H / 2 + 30, 28, { fontStyle: '700' }).setOrigin(0.5).setVisible(false);

    this.lobbyPanel = scene.add.rectangle(GAME.W / 2, 385, 720, 460, 0x130c22, 0.88).setStrokeStyle(2, 0x795695).setDepth(85);
    this.lobby = txt(scene, GAME.W / 2, 168, 22, { fontStyle: '700', lineSpacing: 4 }).setOrigin(0.5, 0);
    this.startButton = txt(scene, GAME.W / 2, 566, 22, { backgroundColor: '#e97959', padding: { x: 22, y: 8 } }).setOrigin(0.5).setText('¡EMPEZAR LAS 5 RONDAS!').setInteractive({ useHandCursor: true });
    this.startButton.on('pointerdown', () => net.send({ t: 'start' }));
    this.gallery = new Map();
    this.boardFaces = new Map();

    this.overDim = scene.add.rectangle(0, 0, GAME.W, GAME.H, 0x0d0a18, 0.78).setOrigin(0).setDepth(100).setVisible(false);
    this.overTitle = txt(scene, GAME.W / 2, 102, 46).setOrigin(0.5).setDepth(102).setVisible(false);
    this.overHint = txt(scene, GAME.W / 2, 633, 21, { color: '#e2c5ee' }).setOrigin(0.5).setDepth(102).setVisible(false);
    this.disasterPhoto = null;
    this.lossDim = scene.add.rectangle(GAME.W / 2, GAME.H / 2, GAME.W, GAME.H, 0x190d20, 0.78).setDepth(96).setVisible(false);
    this.lossTitle = txt(scene, GAME.W / 2, 158, 42, { color: '#ffb28e' }).setOrigin(0.5).setDepth(98).setVisible(false);
    this.lossHint = txt(scene, GAME.W / 2, 553, 24).setOrigin(0.5).setDepth(98).setVisible(false);
    this.lossImage = null;
    this.lossTimer = null;
  }

  update() {
    const phase = gameState.phase;
    const me = gameState.players.get(gameState.you);
    const waiting = me && !me.a && phase !== 'lobby';

    // Chip de ronda
    if (phase === 'lobby' || !gameState.round) {
      this.chip.setText('💣 BOMBA CALIENTE');
    } else {
      const m = MODIFICADORES[gameState.modifier] ?? MODIFICADORES.NORMAL;
      this.chip.setText(`Ronda ${gameState.round}/${gameState.totalRounds}  ${m.emoji} ${m.titulo}`);
    }
    const holder = gameState.players.get(gameState.holder);
    const heat = Math.max(0, Math.min(3, gameState.heat));
    const active = phase === 'playing' && holder;
    this.heatTitle.setText(active ? (holder.id === gameState.you ? '¡PASALA YA!' : `💣 ${holder.n} tiene la bomba`) : '').setVisible(!!active);
    this.heatBar.clear();
    if (active) {
      const x = GAME.W / 2 - 145;
      this.heatBar.fillStyle(0x10091d, 0.8).fillRoundedRect(x - 5, 82, 300, 20, 10);
      this.heatBar.fillStyle(heat >= 2 ? 0xff5a3c : 0xffcc58).fillRoundedRect(x, 87, 72 + heat * 72, 10, 5);
      for (let i = 1; i < 4; i++) this.heatBar.fillStyle(0x10091d, 0.55).fillRect(x + i * 72, 87, 3, 10);
    }
    const cd = this.scene.dashCd;
    const ready = cd <= 0;
    this.status.setText(me ? (waiting ? 'Entrás en la próxima ronda' : `💨 IMPULSO: ${ready ? 'LISTO' : `${(cd / 1000).toFixed(1)}s`}`) : '');
    this.status.setColor(ready ? '#a9efaa' : '#d9ccff');

    const players = [...gameState.players.values()].sort((a, b) => b.score - a.score || a.n.localeCompare(b.n));
    const rows = players.map((p) => {
      const state = phase === 'lobby' ? (p.ready ? '✓ LISTO' : 'DIBUJANDO…') : `${p.score} pts${p.id === gameState.holder ? ' 💣' : ''}`;
      return `${p.n}${p.id === gameState.you ? ' (vos)' : ''}  ${state}`;
    });
    this.board.setText(rows.join('\n')).setLineSpacing(9).setFontSize(16);
    const lobbyOn = phase === 'lobby' && gameState.connected;
    this.updatePortraits(players, lobbyOn);

    // Ayuda contextual
    let help = this.scene.touchEnabled
      ? 'Arrastrá el control izquierdo para moverte · Tocá 💨 para impulsarte'
      : 'WASD / Flechas: moverse · ESPACIO: pedo-propulsión 💨 · 1-6: burlas · M: mute';
    if (phase === 'lobby') help = `ENTER: arrancar partida · ${help}`;
    if (phase === 'lobby' && this.scene.touchEnabled) help = 'Tocá la sala de espera para empezar · Arrastrá el control izquierdo para moverte';
    if (waiting) help = 'La próxima ronda también es tuya. ¡Entrás cuando termine esta!';
    if (!gameState.connected) help = '🔌 Conectando con el servidor...';
    this.help.setText(help);

    this.lobbyPanel.setVisible(lobbyOn);
    this.startButton.setVisible(lobbyOn);
    if (lobbyOn) {
      const readyCount = players.filter((p) => p.ready).length;
      const canStart = readyCount >= 2 && readyCount === players.length;
      this.startButton.setAlpha(canStart ? 1 : 0.45);
      const link = `${location.origin}${location.pathname}?sala=${encodeURIComponent(window.__SALA__ || 'lobby')}`;
      this.lobby.setText(`SALA DE CARITAS · ${readyCount}/${players.length} LISTOS\n` +
        (players.length < 2 ? 'Invitá a alguien para jugar' : canStart ? 'Todos listos. ¡Que empiece el lío!' : 'Esperando a que todos terminen de dibujar…') +
        `\n${link}`).setVisible(true);
    } else this.lobby.setVisible(false);
  }

  updatePortraits(players, lobbyOn) {
    const seen = new Set(players.map((p) => p.id));
    for (const [id, portrait] of this.gallery) {
      if (!seen.has(id)) { portrait.image?.destroy(); portrait.label.destroy(); this.gallery.delete(id); }
    }
    for (const [id, image] of this.boardFaces) {
      if (!seen.has(id)) { image.destroy(); this.boardFaces.delete(id); }
    }
    players.forEach((p, i) => {
      const key = this.scene.blobs.get(p.id)?.portraitKey;
      let portrait = this.gallery.get(p.id);
      if (!portrait) {
        portrait = { image: null, label: txt(this.scene, 0, 0, 16, { fontStyle: '700' }).setOrigin(0.5).setDepth(90) };
        this.gallery.set(p.id, portrait);
      }
      const x = GAME.W / 2 + ((i % 4) - 1.5) * 160;
      const y = 318 + Math.floor(i / 4) * 130;
      if (key && this.scene.textures.exists(key)) {
        if (!portrait.image) portrait.image = this.scene.add.image(x, y, key).setDepth(89).setDisplaySize(104, 104);
        portrait.image.setPosition(x, y).setVisible(lobbyOn);
        let small = this.boardFaces.get(p.id);
        if (!small) { small = this.scene.add.image(0, 0, key).setDepth(90).setDisplaySize(28, 28); this.boardFaces.set(p.id, small); }
        small.setPosition(GAME.W - 68 - this.board.width, 62 + i * (this.board.getTextMetrics().fontSize + 9)).setVisible(!lobbyOn);
      }
      portrait.label.setPosition(x, y + 59).setText(`${p.ready ? p.n : 'Dibujando…'}\n${p.ready ? '✓ LISTO' : '✎'}`).setColor(p.ready ? '#b9efb1' : '#c9b1d6').setVisible(lobbyOn);
    });
  }

  toast(text) {
    const t = txt(this.scene, 52, 0, 19, { align: 'left', fontStyle: '700' }).setOrigin(0, 0).setText(text).setAlpha(0);
    this.toasts.unshift(t);
    this.scene.tweens.add({ targets: t, alpha: 1, duration: 150 });
    this.scene.time.delayedCall(4500, () => {
      this.scene.tweens.add({
        targets: t, alpha: 0, duration: 400,
        onComplete: () => {
          this.toasts = this.toasts.filter((x) => x !== t);
          t.destroy();
          this.layoutToasts();
        },
      });
    });
    while (this.toasts.length > 6) this.toasts.pop().destroy();
    this.layoutToasts();
  }

  layoutToasts() {
    this.toasts.forEach((t, i) => t.setY(GAME.H - 70 - i * 28));
  }

  shout(text, sub = '', ms = 1400, color = '#ffffff') {
    this.big.setText(text).setColor(color).setVisible(true).setAlpha(1).setScale(2.2);
    this.sub.setText(sub).setVisible(!!sub).setAlpha(1);
    this.scene.tweens.killTweensOf([this.big, this.sub]);
    this.scene.tweens.add({ targets: this.big, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: [this.big, this.sub], alpha: 0, delay: ms, duration: 300 });
  }

  roundBanner(round, modifier) {
    this.hideRoundLoser();
    const m = MODIFICADORES[modifier] ?? MODIFICADORES.NORMAL;
    this.shout(`RONDA ${round}`, `${m.emoji} ${m.titulo} — ${m.desc}`, 1800, '#ffd23f');
  }

  showGameOver(winner, ranking = []) {
    this.hideRoundLoser();
    this.hideGameOver();
    this.overDim.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.overDim, alpha: 1, duration: 400 });
    this.overTitle.setFontSize(46).setText(winner ? `👑 ¡GANÓ ${winner.n}!` : '¡FIN DE LA PARTIDA!').setVisible(true).setScale(0.3);
    this.scene.tweens.add({ targets: this.overTitle, scale: 1, duration: 500, ease: 'Back.easeOut' });
    this.disasterPhoto = new DisasterPhoto(this.scene, winner, ranking);
    if (this.overTitle.width > GAME.W - 100) this.overTitle.setFontSize(30);
    this.overHint.setText('Empates: menos tiempo con la bomba · ¡En unos segundos, revancha!').setVisible(true);
  }

  hideGameOver() {
    this.overDim.setVisible(false);
    this.overTitle.setVisible(false);
    this.overHint.setVisible(false);
    this.scene.tweens.killTweensOf([this.overDim, this.overTitle]);
    this.disasterPhoto?.destroy();
    this.disasterPhoto = null;
  }

  showRoundLoser(player, avatar) {
    this.hideRoundLoser();
    this.lossDim.setVisible(true);
    this.lossTitle.setText(`💥 ¡LE EXPLOTÓ A ${player.n}!`).setVisible(true);
    this.lossHint.setText('Esta ronda no suma… ¡pero sigue jugando!').setVisible(true);
    if (avatar) {
      const key = avatarTexture(this.scene, 'round-loser-avatar', avatar);
      this.lossImage = this.scene.add.image(GAME.W / 2, 356, key).setDepth(98).setDisplaySize(300, 300);
      const scale = this.lossImage.scaleX;
      this.lossImage.setScale(scale * 0.15).setAngle(-12);
      this.scene.tweens.add({ targets: this.lossImage, scale, angle: 6, duration: 500, ease: 'Back.easeOut' });
      this.scene.tweens.add({ targets: this.lossImage, angle: -6, delay: 500, duration: 350, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' });
    }
    this.lossTimer = this.scene.time.delayedCall(2800, () => this.hideRoundLoser());
  }

  hideRoundLoser() {
    this.lossTimer?.remove();
    this.lossTimer = null;
    this.lossDim.setVisible(false);
    this.lossTitle.setVisible(false);
    this.lossHint.setVisible(false);
    if (this.lossImage) {
      this.scene.tweens.killTweensOf(this.lossImage);
      this.lossImage.destroy();
      this.lossImage = null;
    }
  }
}
