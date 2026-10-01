import { FONT } from '../core/Constants.js';
import { avatarTexture } from '../avatar/Avatar.js';

// Esferas con la cara original dibujada por cada jugador.
export class Blob {
  constructor(scene, id) {
    this.scene = scene;
    this.id = id;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.lookX = 0;
    this.lookY = 1;
    this.t = Math.random() * 10;
    this.color = 0xffffff;
    this.name = '';
    this.wins = 0;
    this.alive = true;
    this.holder = false;
    this.heat = 0;
    this.radius = 22;
    this.isLocal = false;
    this.avatar = null;
    this.face = null;
    this.textureKey = `avatar-${id}`;
    this.portraitKey = `portrait-${id}`;

    this.g = scene.add.graphics().setDepth(10);
    this.eyes = scene.add.graphics().setDepth(10.5);
    this.label = scene.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '16px', fontStyle: '700', color: '#ffffff',
      stroke: '#120a22', strokeThickness: 4,
    }).setOrigin(0.5, 0).setDepth(11);
    this.bubble = scene.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '18px', fontStyle: '700', color: '#1a0f2e',
      backgroundColor: '#ffffff', padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 1).setDepth(35).setVisible(false);
    this.bubbleTimer = null;
  }

  say(text) {
    this.bubble.setText(text).setVisible(true).setScale(0.4);
    this.scene.tweens.add({ targets: this.bubble, scale: 1, duration: 180, ease: 'Back.easeOut' });
    this.bubbleTimer?.remove();
    this.bubbleTimer = this.scene.time.delayedCall(1800, () => this.bubble.setVisible(false));
  }

  draw(dt) {
    this.t += dt;
    const g = this.g;
    const r = this.radius;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 20) {
      this.lookX = this.vx / speed;
      this.lookY = this.vy / speed;
    }
    g.clear();

    this.drawBody(g, r, speed);

    const labelText = `${this.isLocal ? '▶ ' : ''}${this.name}${this.wins ? ` 👑${this.wins}` : ''}`;
    if (this.label.text !== labelText) this.label.setText(labelText);
    this.label.setPosition(this.x, this.y + r + 6).setAlpha(this.alive ? 1 : 0.5);
    const top = this.holder ? r + 60 : r + 10;
    this.bubble.setPosition(this.x, this.y - top);
  }

  setAvatar(avatar) {
    if (!avatar || this.avatar === avatar) return;
    this.avatar = avatar;
    avatarTexture(this.scene, this.textureKey, avatar, { eyes: false });
    avatarTexture(this.scene, this.portraitKey, avatar);
    if (!this.face) this.face = this.scene.add.image(this.x, this.y, this.textureKey).setDepth(10);
    else this.face.setTexture(this.textureKey);
  }

  drawBody(g, r, speed) {
    const moving = Math.min(1, speed / 200);
    const hop = -Math.abs(Math.sin(this.t * 14)) * 5 * moving;
    const jitter = this.holder && this.heat >= 2 ? Math.sin(this.t * 80) * this.heat : 0;
    const x = this.x + jitter;
    const y = this.y + hop;
    g.fillStyle(0x000000, 0.35).fillEllipse(this.x, this.y + r * 0.85, r * 1.8, r * 0.6);
    if (this.holder) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * (7 + this.heat * 5));
      g.lineStyle(3 + this.heat, this.heat >= 2 ? 0xff593f : 0xffd36d, 0.38 + pulse * 0.38)
        .strokeCircle(x, y, r + 10 + pulse * 5);
      g.fillStyle(0xffa43a, 0.08 + pulse * 0.08).fillCircle(x, y, r * 2.1);
      this.drawBomb(g, x, y - r - 26, r);
    } else if (this.isLocal) {
      g.lineStyle(3, 0xffffff, 0.55).strokeCircle(x, y, r + 7);
    }
    if (this.face) {
      this.face.setPosition(x, y).setDisplaySize(r / 0.43, r / 0.43).setAlpha(this.alive ? 1 : 0.4);
    } else {
      g.fillStyle(this.color, 0.5).fillCircle(x, y, r);
    }
    const eyes = this.eyes.clear().setAlpha(this.alive ? 1 : 0.4);
    const eyeR = r * (this.holder ? 0.33 : 0.27);
    const pupilR = r * (this.holder ? 0.08 : 0.14);
    for (const side of [-1, 1]) {
      const ex = x + side * r * 0.34 + this.lookX * r * 0.14;
      const ey = y - r * 0.15 + this.lookY * r * 0.12;
      eyes.fillStyle(0xffffff).fillCircle(ex, ey, eyeR);
      eyes.fillStyle(0x17121d).fillCircle(ex + this.lookX * eyeR * 0.45, ey + this.lookY * eyeR * 0.45, pupilR);
    }
  }

  drawBomb(g, x, y, r) {
    const pulse = 1 + Math.sin(this.t * (6 + this.heat * 7)) * (0.05 + this.heat * 0.035);
    const br = r * 0.62 * pulse;
    const redness = [0, 0.25, 0.55, 0.9][this.heat] ?? 0;
    const col = (Math.round(20 + 200 * redness) << 16) | (20 << 8) | 25;
    g.fillStyle(col).fillCircle(x, y, br);
    g.fillStyle(0xffffff, 0.3).fillCircle(x - br * 0.35, y - br * 0.35, br * 0.25);
    g.lineStyle(3, 0x9c7a4a).beginPath();
    g.moveTo(x + br * 0.5, y - br * 0.7);
    g.lineTo(x + br * 0.9, y - br * 1.25);
    g.strokePath();
    // Chispa de la mecha
    const fx = x + br * 0.9;
    const fy = y - br * 1.3;
    const flick = 3 + Math.random() * 4 + this.heat * 1.5;
    g.fillStyle(0xff8c2e).fillCircle(fx, fy, flick);
    g.fillStyle(0xfff3a0).fillCircle(fx, fy, flick * 0.5);
    if (this.heat >= 1) g.fillStyle(0xff3b1f, 0.12 + 0.05 * this.heat).fillCircle(x, y, br * (2 + this.heat * 0.4));
  }

  destroy() {
    this.g.destroy();
    this.eyes.destroy();
    this.face?.destroy();
    if (this.scene.textures.exists(this.textureKey)) this.scene.textures.remove(this.textureKey);
    if (this.scene.textures.exists(this.portraitKey)) this.scene.textures.remove(this.portraitKey);
    this.label.destroy();
    this.bubble.destroy();
    this.bubbleTimer?.remove();
  }
}
