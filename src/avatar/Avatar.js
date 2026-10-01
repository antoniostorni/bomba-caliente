// Coordenadas del dibujo relativas al radio de la esfera: -1000 a 1000.
// El mismo render se usa en el editor, la sala, la partida y el podio.
export const AVATAR_COLORS = [0xff715b, 0xffc857, 0x92df71, 0x50dbcf, 0x61aaff, 0xb78aff, 0xff83bb, 0xf5eedc];
export const HEAD_STYLES = ['none', 'tuft', 'curls', 'mohawk', 'pigtails', 'bowl', 'cap', 'hat'];
export const HAIR_COLORS = [0x33202b, 0x875136, 0xf4c45e, 0xf0e9ef, 0xec628e, 0x6557d6, 0x3db9a0, 0xf08642];
export const MAX_POINTS = 2000;
export const MAX_STROKES = 96;

export function paintAvatar(ctx, avatar, size, { eyes = true } = {}) {
  ctx.clearRect(0, 0, size, size);
  const r = size * 0.43;
  const c = size / 2;
  const color = `#${avatar.color.toString(16).padStart(6, '0')}`;
  ctx.save();
  ctx.translate(c, c);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  const shade = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, r * 0.2, r * 0.3, r * 1.35);
  shade.addColorStop(0, '#ffffff77');
  shade.addColorStop(0.42, '#ffffff00');
  shade.addColorStop(1, '#130821aa');
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.strokeStyle = '#160d2f';
  ctx.lineWidth = size * 0.012;
  ctx.stroke();
  ctx.clip();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#21142e';
  ctx.fillStyle = '#21142e';
  for (const stroke of avatar.strokes || []) {
    if (!stroke.points.length) continue;
    ctx.lineWidth = stroke.w * r / 1000;
    ctx.beginPath();
    const [x, y] = stroke.points[0];
    ctx.moveTo(x * r / 1000, y * r / 1000);
    for (const [px, py] of stroke.points.slice(1)) ctx.lineTo(px * r / 1000, py * r / 1000);
    ctx.stroke();
    // Un clic también sirve para dibujar un punto (por ejemplo, un ojo).
    if (stroke.points.length === 1) {
      ctx.beginPath();
      ctx.arc(x * r / 1000, y * r / 1000, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (eyes) {
    for (const side of [-1, 1]) {
      const x = side * r * 0.34;
      const y = -r * 0.15;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.27, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y + r * 0.06, r * 0.14, 0, Math.PI * 2);
      ctx.fillStyle = '#17121d';
      ctx.fill();
    }
  }
  ctx.restore();
  paintHair(ctx, avatar, size);
}

function paintHair(ctx, avatar, size) {
  const head = avatar.head || 'none';
  if (head === 'none') return;
  const r = size * 0.43;
  const color = `#${(avatar.hairColor ?? HAIR_COLORS[0]).toString(16).padStart(6, '0')}`;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale(r, r);
  ctx.fillStyle = color;
  ctx.strokeStyle = '#21142e';
  ctx.lineWidth = 0.045;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const finish = () => { ctx.closePath(); ctx.fill(); ctx.stroke(); };
  const ellipse = (x, y, rx, ry, angle = 0) => {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2); finish();
  };
  const shine = (x, y, rx, ry, angle = 0) => {
    ctx.save(); ctx.fillStyle = '#ffffff44'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  if (head === 'tuft') {
    // Un remolino despeinado, con el flequillo escapándose hacia un costado.
    ctx.beginPath(); ctx.moveTo(-0.78, -0.52);
    ctx.bezierCurveTo(-0.96, -0.97, -0.35, -1.12, 0.02, -0.91);
    ctx.bezierCurveTo(-0.08, -1.09, 0.07, -1.18, 0.23, -1.02);
    ctx.bezierCurveTo(0.43, -1.13, 0.8, -1.01, 0.84, -0.78);
    ctx.quadraticCurveTo(0.44, -0.95, 0.55, -0.58);
    ctx.quadraticCurveTo(0.3, -0.39, 0.17, -0.76);
    ctx.quadraticCurveTo(-0.12, -0.47, -0.38, -0.66);
    ctx.quadraticCurveTo(-0.54, -0.35, -0.78, -0.52); finish();
    shine(-0.4, -0.85, 0.25, 0.06, -0.2);
  } else if (head === 'curls') {
    // Bucles de distinto tamaño, con pequeños espirales.
    for (const [x, y, radius] of [[-0.79,-0.55,0.23],[-0.63,-0.82,0.23],[-0.32,-0.91,0.23],[0.03,-0.91,0.24],[0.37,-0.89,0.24],[0.69,-0.72,0.25],[0.83,-0.44,0.2]]) {
      ellipse(x, y, radius, radius);
      ctx.beginPath(); ctx.arc(x, y, radius * 0.47, 0, Math.PI * 1.6); ctx.stroke();
      shine(x - 0.055, y - 0.075, 0.055, 0.03, -0.5);
    }
  } else if (head === 'mohawk') {
    ctx.beginPath(); ctx.moveTo(-0.26,-0.72); ctx.lineTo(-0.29,-1.05);
    ctx.lineTo(-0.1,-0.94); ctx.lineTo(0.03,-1.13); ctx.lineTo(0.14,-0.9);
    ctx.lineTo(0.34,-1.02); ctx.lineTo(0.29,-0.61); ctx.quadraticCurveTo(0,-0.48,-0.26,-0.72); finish();
    shine(0, -0.79, 0.06, 0.14);
  } else if (head === 'pigtails') {
    ellipse(-0.85,-0.62,0.22,0.33,-0.55); ellipse(0.85,-0.62,0.22,0.33,0.55);
    ctx.beginPath(); ctx.moveTo(-0.73,-0.67); ctx.bezierCurveTo(-0.55,-1.18,0.55,-1.18,0.73,-0.67);
    ctx.quadraticCurveTo(0.22,-0.57,0,-0.84); ctx.quadraticCurveTo(-0.26,-0.58,-0.73,-0.67); finish();
    ctx.fillStyle = '#ffdd69'; ellipse(-0.73,-0.57,0.085,0.11,-0.3); ellipse(0.73,-0.57,0.085,0.11,0.3);
    shine(-0.34,-0.88,0.18,0.055,-0.25);
  } else if (head === 'bowl') {
    ctx.beginPath(); ctx.moveTo(-0.86,-0.48);
    ctx.bezierCurveTo(-0.98,-1.13,0.89,-1.19,0.89,-0.48);
    ctx.quadraticCurveTo(0.58,-0.38,0.4,-0.52); ctx.lineTo(0.35,-0.41); ctx.lineTo(0.27,-0.52);
    ctx.quadraticCurveTo(-0.3,-0.43,-0.86,-0.48); finish();
    shine(-0.28,-0.85,0.28,0.075,-0.1);
    ctx.strokeStyle = '#21142e66'; ctx.lineWidth = 0.025;
    for (const x of [-0.64,-0.38,-0.12,0.14,0.63]) { ctx.beginPath(); ctx.moveTo(x,-0.75); ctx.lineTo(x+0.035,-0.51); ctx.stroke(); }
  } else if (head === 'cap') {
    ctx.rotate(-0.12);
    ctx.beginPath(); ctx.moveTo(-0.79,-0.63); ctx.bezierCurveTo(-0.76,-1.22,0.66,-1.14,0.77,-0.63); finish();
    ctx.beginPath(); ctx.moveTo(-0.8,-0.63); ctx.quadraticCurveTo(0.6,-0.69,1.08,-0.4);
    ctx.quadraticCurveTo(0.31,-0.28,-0.8,-0.63); finish();
    ctx.fillStyle = '#ffe8ad'; ellipse(0.06,-0.84,0.13,0.12);
    ctx.fillStyle = '#21142e'; ctx.font = 'bold 0.16px sans-serif'; ctx.textAlign='center'; ctx.fillText('B',0.06,-0.785);
    shine(-0.42,-0.89,0.18,0.06,-0.3);
  } else if (head === 'hat') {
    ctx.rotate(0.09);
    ctx.beginPath(); ctx.moveTo(-0.54,-0.64); ctx.lineTo(-0.5,-1.1);
    ctx.quadraticCurveTo(0,-1.16,0.43,-1.09); ctx.lineTo(0.53,-0.65); finish();
    ctx.fillStyle = '#f6c86b'; ctx.beginPath(); ctx.moveTo(-0.51,-0.79); ctx.lineTo(0.49,-0.77); ctx.lineTo(0.51,-0.65); ctx.lineTo(-0.53,-0.66); ctx.closePath(); ctx.fill();
    ctx.fillStyle = color; ellipse(0,-0.65,1.03,0.14);
    shine(-0.29,-0.95,0.08,0.12);
  }
  ctx.restore();
}

export function avatarTexture(scene, key, avatar, options) {
  const texture = scene.textures.exists(key) ? scene.textures.get(key) : scene.textures.createCanvas(key, 384, 384);
  paintAvatar(texture.getContext(), avatar, 384, options);
  texture.refresh();
  return key;
}
