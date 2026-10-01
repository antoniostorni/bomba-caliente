// El picante del juego vive acá. Agregá las tuyas.

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

export const POP_PASE = ['¡TOMÁ!', '¡ES TUYA!', '¡AGARRÁ!', '¡CHAU!', '¡TE LA DI!', '¡SORPRESA!', '¡REGALITO!'];

export const PASE = [
  '{to} la tiene 🔥',
  '{from} se la pasó a {to} sin culpa',
  '{to}: corré, corré 🏃',
  '{from} jugó sucio con {to}',
  '{to} recibió un regalito 🎁',
  '{from} 🤝 {to}: amistad terminada',
  '{to} está en el horno (literal)',
];

export const PASE_ULTIMO_SEGUNDO = [
  '🐀 ¡{from} se la pasó a {to} en el ÚLTIMO SEGUNDO! Una rata',
  '😱 ¡{from} se salvó por un pelo! {to}, rezá',
  '🧊 {from} tiene sangre fría. {to} no tanto',
];

export const COBARDE = '🏃 {name} se desconectó con la bomba. Qué cobardía. Ahora la tiene {to}';

export const BOOM = [
  '💀 {name} explotó como pochoclo 🍿',
  '💥 {name} se hizo puré de papa',
  '🪦 QEPD {name}. Breve pero intenso',
  '💥 {name} voló por los aires. Literal',
  '☠️ {name} no la vio venir (sí la vio)',
  '🔥 {name} quedó más quemado que asado de domingo',
  '🎆 {name} ahora es fuegos artificiales',
  '📉 {name} no sumó esta vez. ¡Se viene la revancha!',
];

export const POP_BOOM = ['BOOM', 'KABOOM', 'PUM', 'F', 'RIP', 'CHAU'];

export const MODIFICADORES = {
  NORMAL: { titulo: 'RONDA NORMAL', desc: 'Sin trucos. Por ahora... 😏', emoji: '💣' },
  HIELO: { titulo: 'PISTA DE HIELO', desc: 'Frenar es opcional', emoji: '🧊' },
  TURBO: { titulo: 'TURBO', desc: 'Todos se tomaron 3 cafés', emoji: '⚡' },
  INVERTIDOS: { titulo: 'CONTROLES INVERTIDOS', desc: 'Izquierda es derecha. Suerte', emoji: '🙃' },
  APAGON: { titulo: 'APAGÓN', desc: 'Se cortó la luz. La bomba ilumina 👀', emoji: '🌑' },
  CABEZONES: { titulo: 'CABEZONES', desc: 'Nadie entra en la arena', emoji: '🎈' },
};

export const EMOTES = ['¡Vení, vení! 🐔', 'JAJAJA 🤣', '😈', '¡Perdón! 🙏', '💩', 'Te amo ❤️'];

export const PEDO_NUCLEAR = [
  '☢️ {name} se mandó un PEDO NUCLEAR',
  '💨 {name} rompió la barrera del sonido (y del olfato)',
  '🤢 Evacúen: {name} se mandó uno de los grandes',
];

export const SOPLIDO_FANTASMA = ['👻 ¡BUUU!', '👻 fffffuuu', '👻 ¡A volar!'];

export const GANADOR = [
  'REY DE LA PAPA CALIENTE',
  'SOBREVIVIENTE OFICIAL',
  'INMORTAL (por ahora)',
  'EL ÚLTIMO EN PIE',
];

export const PERDEDORES = [
  'Los demás: a lavar los platos 🍽️',
  'Los demás: pueden llorar en el chat de voz',
  'Los demás: revancha o vergüenza eterna',
];
