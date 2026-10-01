import { FONT, GAME } from '../core/Constants.js';
import { gameState } from '../core/GameState.js';
import { avatarTexture } from '../avatar/Avatar.js';

// Una sola composición: hasta ocho retratos, con el campeón en el centro.
export class DisasterPhoto {
  constructor(scene, winner, ranking) {
    this.scene = scene;
    this.objects = [];
    this.keys = [];
    const add = (object) => { this.objects.push(object); return object; };
    const label = (x, y, text, size, color = '#f7eafa', width = 140) => {
      const object = add(scene.add.text(x, y, text, {
        fontFamily: FONT, fontSize: `${size}px`, fontStyle: '800', color,
        align: 'center', wordWrap: { width, useAdvancedWrap: true },
      }).setOrigin(0.5, 0).setDepth(103));
      return object;
    };
    const g = add(scene.add.graphics().setDepth(101));
    g.fillStyle(0x21162f, 1).fillRoundedRect(38, 176, GAME.W - 76, 448, 24);
    g.lineStyle(2, 0x705274).strokeRoundedRect(38, 176, GAME.W - 76, 448, 24);
    label(GAME.W / 2, 145, 'FOTO FINAL DEL DESASTRE · Sonrían, si les queda cara.', 21, '#dfbfd5', 1100);

    const awards = new Map(ranking.map((p, i) => [p.id, i === 0 ? 'SU MAJESTAD\nLA PAPA' : [
      'CROCANTE\nPOR FUERA', 'CARBÓN\nPREMIUM', 'ASADO\nDE DOMINGO', 'CENIZA\nCON PATAS', 'TOSTADITO\nDEL GRUPO', 'HUMO\nCON DNI', 'POCHOCLITO\nHUMANO',
    ][i - 1]]));
    // Cada premio estadístico va a una persona distinta; los demás reciben uno de la foto.
    const awarded = new Set(winner ? [winner.id] : []);
    for (const [stat, title] of [['farts', 'FÁBRICA\nDE GAS'], ['passes', 'DELIVERY\nDEL PELIGRO'], ['bombMs', 'ABRAZÓ\nEL PROBLEMA']]) {
      const top = ranking.reduce((best, p) => (p[stat] || 0) > (best?.[stat] || 0) ? p : best, null);
      if (top && !awarded.has(top.id)) { awards.set(top.id, title); awarded.add(top.id); }
    }
    const count = ranking.length;
    const spacing = Math.min(230, 1140 / Math.max(1, count));
    const order = ranking.map((_, i) => i).filter((i) => i % 2 === 1).reverse()
      .concat(ranking.map((_, i) => i).filter((i) => i % 2 === 0));
    order.forEach((rank, slot) => {
      const p = ranking[rank];
      const champion = p.id === winner?.id;
      const x = GAME.W / 2 + (slot - (count - 1) / 2) * spacing;
      const top = champion ? 365 : rank === 1 ? 413 : rank === 2 ? 439 : 464;
      const size = champion ? Math.min(184, spacing + 24) : Math.min(132, spacing - 18);
      const y = top - size / 2 - 8;
      const width = spacing - 12;
      g.fillStyle(champion ? 0xd99b37 : 0x55425f).fillRoundedRect(x - width / 2, top, width, 527 - top, 9);
      g.fillStyle(champion ? 0xffd77a : 0x8f7599).fillRect(x - width / 2 + 6, top + 5, width - 12, 5);
      label(x, top + 15, `${rank + 1}`, champion ? 40 : 28, champion ? '#382215' : '#dfcbe7', width);
      const avatar = champion ? winner.avatar : gameState.avatars.get(p.id);
      const fallback = { color: gameState.players.get(p.id)?.c ?? 0xb78aff, strokes: [] };
      const key = `disaster-photo-${slot}`;
      this.keys.push(key);
      avatarTexture(scene, key, avatar || fallback);
      const portrait = add(scene.add.image(x, y, key).setDisplaySize(size, size).setDepth(102).setAngle(champion ? -8 : (slot % 2 ? 9 : -9)));
      if (champion) {
        // Brazos en alto, corona y destellos de la pose triunfal.
        g.lineStyle(9, 0xffd77a, 1).beginPath().moveTo(x - size * 0.35, y + 18).lineTo(x - size * 0.58, y - 24)
          .moveTo(x + size * 0.35, y + 18).lineTo(x + size * 0.58, y - 24).strokePath();
        label(x, y - size / 2 - 43, '👑', 40, '#ffdb7f', width);
        label(x - size / 2 - 8, y - 40, '✦', 28, '#ffdb7f', 40);
        label(x + size / 2 + 8, y + 12, '✦', 24, '#ffdb7f', 40);
      } else {
        portrait.setTint(0x918080);
        const soot = add(scene.add.graphics().setDepth(103));
        soot.fillStyle(0x261c24, 0.65);
        for (const [dx, dy, r] of [[-0.27, 0.13, 0.1], [0.29, 0.19, 0.12], [0.13, 0.32, 0.07]]) {
          soot.fillCircle(x + dx * size, y + dy * size, r * size);
        }
        const smoke = add(scene.add.graphics().setDepth(102));
        smoke.fillStyle(0xb5a7b7, 0.35).fillCircle(x - 12, y - size * 0.48, 9)
          .fillCircle(x + 1, y - size * 0.61, 12).fillCircle(x - 8, y - size * 0.78, 16);
        scene.tweens.add({ targets: smoke, y: -18, alpha: 0, duration: 1800, delay: slot * 130, repeat: -1 });
      }
      const name = label(x, 535, p.name, 19, champion ? '#ffdb7f' : '#f7eafa', width);
      // Nombres largos caben en una línea sin invadir al vecino.
      name.setWordWrapWidth(0);
      if (name.width > width) name.setScale(width / name.width);
      label(x, 560, awards.get(p.id), 16, champion ? '#ffdb7f' : '#d5b8c8', width);
      label(x, 501, `${p.score} pts`, 16, champion ? '#382215' : '#f7eafa', width);
    });
  }

  destroy() {
    for (const object of this.objects) {
      this.scene.tweens.killTweensOf(object);
      object.destroy();
    }
    for (const key of this.keys) this.scene.textures.remove(key);
  }
}
