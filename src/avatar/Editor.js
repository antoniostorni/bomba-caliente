import { AVATAR_COLORS, HAIR_COLORS, HEAD_STYLES, MAX_POINTS, MAX_STROKES, paintAvatar } from './Avatar.js';

export class AvatarEditor {
  constructor() {
    this.canvas = document.getElementById('face-editor');
    this.ctx = this.canvas.getContext('2d');
    this.avatar = { color: AVATAR_COLORS[0], head: 'none', hairColor: HAIR_COLORS[0], strokes: [] };
    this.current = null;
    this.pointerId = null;
    this.brush = 40;
    this.disabled = false;
    this.dirty = false;
    this.note = document.getElementById('editor-note');
    try {
      const saved = JSON.parse(localStorage.getItem('bomba:avatar'));
      if (saved && AVATAR_COLORS.includes(saved.color) && Array.isArray(saved.strokes)) this.avatar = saved;
    } catch { /* El primer personaje empieza en blanco. */ }
    this.colors = document.getElementById('colors');
    this.hairColors = document.getElementById('hair-colors');
    this.headOptions = document.getElementById('head-options');
    const labels = ['Pelado feliz', 'Tony recién despierto', 'Rulos locos', 'Cresta punk', 'Dos colitas', 'Corte taza', 'Gorra fachera', 'Señor elegante'];
    HEAD_STYLES.forEach((head, i) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'head-option'; button.dataset.head = head;
      button.setAttribute('aria-label', labels[i]);
      const canvas = document.createElement('canvas'); canvas.width = 112; canvas.height = 112;
      canvas.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span'); label.textContent = labels[i];
      button.append(canvas, label);
      button.addEventListener('click', () => {
        if (this.disabled) return;
        this.dirty = true; this.avatar.head = head; this.render();
      });
      this.headOptions.append(button);
    });
    for (const color of HAIR_COLORS) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'swatch';
      button.style.background = `#${color.toString(16).padStart(6, '0')}`;
      button.setAttribute('aria-label', `Color de pelo o sombrero #${color.toString(16)}`);
      button.dataset.color = String(color);
      button.addEventListener('click', () => {
        if (this.disabled) return;
        this.dirty = true;
        this.avatar.hairColor = color;
        this.render();
      });
      this.hairColors.append(button);
    }
    for (const color of AVATAR_COLORS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'swatch';
      button.style.background = `#${color.toString(16).padStart(6, '0')}`;
      button.setAttribute('aria-label', `Color #${color.toString(16)}`);
      button.addEventListener('click', () => {
        if (this.disabled) return;
        this.dirty = true;
        this.avatar.color = color;
        this.render();
      });
      button.dataset.color = String(color);
      this.colors.append(button);
    }
    document.getElementById('brush').addEventListener('change', (e) => { this.brush = Number(e.target.value); });
    document.getElementById('undo').addEventListener('click', () => {
      if (this.disabled) return;
      this.dirty = true;
      this.avatar.strokes.pop(); this.render();
    });
    document.getElementById('clear-face').addEventListener('click', () => {
      if (this.disabled) return;
      this.dirty = true;
      this.avatar.strokes = []; this.render();
    });
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.disabled || this.pointerId !== null || e.button !== 0) return;
      if (this.avatar.strokes.length >= MAX_STROKES || this.pointCount() >= MAX_POINTS) return this.limit();
      const point = this.point(e);
      if (!point) return;
      e.preventDefault();
      this.dirty = true;
      this.pointerId = e.pointerId;
      this.canvas.setPointerCapture(e.pointerId);
      this.current = { w: this.brush, points: [point] };
      this.avatar.strokes.push(this.current);
      this.render();
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pointerId || !this.current) return;
      if (this.pointCount() >= MAX_POINTS) return this.limit();
      const point = this.point(e);
      if (!point) return;
      const last = this.current.points.at(-1);
      if (Math.hypot(point[0] - last[0], point[1] - last[1]) < 9) return;
      this.current.points.push(point);
      this.render();
    });
    const end = (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.current = null;
      this.pointerId = null;
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener('lostpointercapture', end);
    this.render();
  }

  point(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width - 0.5) / 0.43 * 1000);
    const y = Math.round(((e.clientY - rect.top) / rect.height - 0.5) / 0.43 * 1000);
    const onEye = [-1, 1].some((side) => Math.hypot(x - side * 340, y + 150) < 280);
    return Math.hypot(x, y) <= 950 && !onEye ? [x, y] : null;
  }

  pointCount() { return this.avatar.strokes.reduce((sum, s) => sum + s.points.length, 0); }
  limit() { this.note.textContent = 'El dibujo está lleno. Deshacé un trazo para seguir.'; }
  render() {
    paintAvatar(this.ctx, this.avatar, this.canvas.width);
    for (const button of this.colors.children) button.setAttribute('aria-pressed', String(Number(button.dataset.color) === this.avatar.color));
    for (const button of this.headOptions.children) {
      button.disabled = this.disabled;
      button.setAttribute('aria-pressed', String(button.dataset.head === (this.avatar.head || 'none')));
      const canvas = button.querySelector('canvas');
      paintAvatar(canvas.getContext('2d'), { ...this.avatar, head: button.dataset.head }, canvas.width);
    }
    for (const button of this.hairColors.children) button.setAttribute('aria-pressed', String(Number(button.dataset.color) === (this.avatar.hairColor ?? HAIR_COLORS[0])));
    document.getElementById('undo').disabled = this.disabled || !this.avatar.strokes.length;
    document.getElementById('clear-face').disabled = this.disabled || !this.avatar.strokes.length;
    this.note.textContent = this.avatar.strokes.length ? '¡Esa carita la van a ver todos!' : 'Los ojos ya están. Dibujá nariz, boca y lo que quieras.';
  }
}
