// Todo en coordenadas de diseño (1280x720). Phaser escala con FIT.

export const GAME = { W: 1280, H: 720 };

export const ARENA = {
  MARGIN: 40,
  // Obstáculos rectangulares: dan donde esconderse y donde quedar acorralado.
  OBSTACLES: [
    { x: 300, y: 190, w: 90, h: 90 },
    { x: 890, y: 190, w: 90, h: 90 },
    { x: 300, y: 440, w: 90, h: 90 },
    { x: 890, y: 440, w: 90, h: 90 },
    { x: 585, y: 320, w: 110, h: 80 },
  ],
  FLOOR: 0x1b1530,
  FLOOR_TILE: 0x221a3b,
  WALL: 0x4a3a78,
  WALL_TOP: 0x6d58b0,
};

export const PLAYER = {
  RADIUS: 22,
  SPEED: 250,
  HOLDER_SPEED_MULT: 1.12,
  GHOST_SPEED: 300,
  RESPONSE: 12, // qué tan rápido la velocidad sigue al input
  DASH_IMPULSE: 620,
  NUKE_IMPULSE: 950,
  NUKE_CHANCE: 0.1,
  DASH_COOLDOWN_MS: 2200,
  DASH_SLIDE_MS: 180,
  GUST_COOLDOWN_MS: 2500,
  GUST_RADIUS: 180,
  GUST_IMPULSE: 700,
  PASS_KNOCKBACK: 420,
  EMOTE_COOLDOWN_MS: 900,
};

// Cómo cambia cada modificador el movimiento.
export const MODIFIERS = {
  NORMAL:     { speed: 1,    response: 1,    radius: 1 },
  HIELO:      { speed: 1.05, response: 0.12, radius: 1 },
  TURBO:      { speed: 1.5,  response: 1.3,  radius: 1 },
  INVERTIDOS: { speed: 1,    response: 1,    radius: 1, inverted: true },
  APAGON:     { speed: 1,    response: 1,    radius: 1, dark: true },
  CABEZONES:  { speed: 0.95, response: 1,    radius: 1.6 },
};

export const NET = {
  SEND_HZ: 20,
  // .env: VITE_SERVER_URL=127.0.0.1:1999 en local. Tras `npm run deploy`
  // en server/, poné acá la URL que imprime PartyKit.
  SERVER_URL: import.meta.env.VITE_SERVER_URL || 'bomba-caliente.TU-USUARIO.partykit.dev',
};

export const FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';
