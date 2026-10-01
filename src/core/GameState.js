// Estado compartido del cliente. El servidor manda; esto es lo último que dijo.
export const gameState = {
  connected: false,
  you: null,
  phase: 'lobby',
  round: 0,
  modifier: 'NORMAL',
  holder: null,
  heat: 0,
  players: new Map(), // id -> { id, n, c, x, y, a, w }
  avatars: new Map(), // Se transfieren al entrar o guardar, no en cada tick.
  totalRounds: 5,
  muted: false,
};
