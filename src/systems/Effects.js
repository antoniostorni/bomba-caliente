import { FONT } from '../core/Constants.js';

// Partículas simples con objetos Arc; alcanza y sobra para 8 jugadores.
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.obj.destroy();
        this.parts.splice(i, 1);
        continue;
      }
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy = p.vy * Math.pow(p.drag, dt * 60) + p.gravity * dt;
      p.obj.x += p.vx * dt;
      p.obj.y += p.vy * dt;
      const k = p.life / p.maxLife;
      p.obj.setAlpha(p.alpha * Math.min(1, k * 2));
      p.obj.setScale(p.grow ? 1 + (1 - k) * p.grow : k * 0.7 + 0.3);
    }
  }

  burst(x, y, { count = 16, colors = [0xffffff], speed = 300, life = 0.6, size = 5, gravity = 0, drag = 0.92, grow = 0, alpha = 1, depth = 30 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      const obj = this.scene.add.circle(x, y, size * (0.6 + Math.random() * 0.8), colors[i % colors.length]).setDepth(depth);
      const l = life * (0.6 + Math.random() * 0.6);
      this.parts.push({ obj, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: l, maxLife: l, gravity, drag, grow, alpha });
    }
  }

  explosion(x, y, color) {
    this.burst(x, y, { count: 40, colors: [0xfff3a0, 0xffb22e, 0xff5a1f, 0xff2d2d], speed: 650, life: 0.8, size: 8 });
    this.burst(x, y, { count: 18, colors: [color], speed: 420, life: 1.2, size: 6, gravity: 500 });
    this.burst(x, y, { count: 14, colors: [0x2b2533, 0x3d3548], speed: 120, life: 1.6, size: 12, grow: 2.5, alpha: 0.7, drag: 0.95, depth: 29 });
    const ring = this.scene.add.circle(x, y, 20).setStrokeStyle(8, 0xfff3a0).setDepth(31);
    this.scene.tweens.add({ targets: ring, scale: 9, alpha: 0, duration: 450, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }

  fartCloud(x, y, big = false) {
    this.burst(x, y, {
      count: big ? 26 : 9,
      colors: [0x9bd35a, 0x7fb843, 0xb8e07a, 0x8a7a3a],
      speed: big ? 200 : 70,
      life: big ? 1.8 : 1.0,
      size: big ? 14 : 9,
      grow: big ? 3 : 2,
      alpha: 0.75,
      drag: 0.9,
      depth: 8,
    });
    this.popText(x, y - 10, big ? '☢️💨' : '💨', { size: big ? 44 : 26, rise: 40, life: 800 });
  }

  gust(x, y, radius) {
    const ring = this.scene.add.circle(x, y, 10).setStrokeStyle(5, 0xcfe8ff, 0.8).setDepth(28);
    this.scene.tweens.add({ targets: ring, radius, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    this.burst(x, y, { count: 14, colors: [0xe6f3ff, 0xbcd9ff], speed: 500, life: 0.4, size: 3 });
  }

  sparks(x, y) {
    this.burst(x, y, { count: 14, colors: [0xffffff, 0xffe066, 0xff8c2e], speed: 380, life: 0.35, size: 4 });
  }

  confetti(x, y) {
    this.burst(x, y, { count: 80, colors: [0xff4d4d, 0x3fa7ff, 0x4be37a, 0xffd23f, 0xc86bff, 0xff6fb5], speed: 700, life: 2.2, size: 6, gravity: 600, drag: 0.96, depth: 105 });
  }

  popText(x, y, text, { color = '#ffffff', size = 34, rise = 70, life = 900, depth = 40 } = {}) {
    const t = this.scene.add.text(x, y, text, {
      fontFamily: FONT, fontSize: `${size}px`, fontStyle: '800', color,
      stroke: '#1a0f2e', strokeThickness: Math.max(4, size / 6),
    }).setOrigin(0.5).setDepth(depth).setScale(0.3);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.scene.tweens.add({
      targets: t, y: y - rise, alpha: 0, delay: life * 0.45, duration: life * 0.55,
      onComplete: () => t.destroy(),
    });
  }

  shake(ms = 200, intensity = 0.008) {
    this.scene.cameras.main.shake(ms, intensity);
  }

  flash(ms = 120, r = 255, g = 255, b = 255) {
    this.scene.cameras.main.flash(ms, r, g, b);
  }
}
