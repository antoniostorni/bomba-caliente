import Phaser from 'phaser';
import { GAME } from './core/Constants.js';
import { gameState } from './core/GameState.js';
import { eventBus } from './core/EventBus.js';
import { net } from './net/Net.js';
import { initAudio } from './audio/Sfx.js';
import { GameScene } from './scenes/GameScene.js';
import { AvatarEditor } from './avatar/Editor.js';

const params = new URLSearchParams(location.search);
const sala = (params.get('sala') || 'lobby').replace(/[^\w-]/g, '').slice(0, 32) || 'lobby';
window.__SALA__ = sala;

async function boot() {
  // Phaser dibuja los textos con la fuente ya cargada o usa la de respaldo.
  try { await document.fonts.load('800 20px "Baloo 2"'); } catch { /* sin fuente, igual anda */ }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: GAME.W,
    height: GAME.H,
    parent: 'game',
    backgroundColor: '#0d0a18',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [GameScene],
  });

  const form = document.getElementById('join');
  const input = document.getElementById('name');
  const editor = new AvatarEditor();
  const submit = document.getElementById('ready');
  const message = document.getElementById('join-status');
  let saveTimer = null;
  let profileId;
  try {
    profileId = localStorage.getItem('bomba:profile');
    if (!profileId || !/^[a-zA-Z0-9-]{8,64}$/.test(profileId)) {
      profileId = crypto.randomUUID();
      localStorage.setItem('bomba:profile', profileId);
    }
  } catch { profileId = `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  document.getElementById('sala').textContent = sala;
  try { input.value = localStorage.getItem('bomba:name') || ''; } catch { /* modo privado */ }

  eventBus.on('net:profileSaved', ({ avatar }) => {
    clearTimeout(saveTimer);
    saveTimer = null;
    try { localStorage.setItem('bomba:avatar', JSON.stringify(avatar)); } catch { /* El servidor ya lo guardó. */ }
    document.getElementById('overlay')?.remove();
    const scene = game.scene.getScene('GameScene');
    scene.input.keyboard.enabled = true;
    scene.input.keyboard.enableGlobalCapture();
    game.canvas.setAttribute('tabindex', '0');
    game.canvas.focus();
  });
  eventBus.on('net:profileDraft', ({ avatar }) => {
    if (!editor.dirty && !editor.disabled && avatar) {
      editor.avatar = avatar;
      editor.render();
    }
  });
  const showError = (text) => {
    clearTimeout(saveTimer);
    saveTimer = null;
    message.textContent = text;
    editor.disabled = false;
    submit.disabled = false;
    submit.textContent = 'GUARDAR Y ESTOY LISTO';
    editor.render();
  };
  eventBus.on('net:profileError', ({ text }) => showError(text));
  eventBus.on('net:full', () => showError('La sala está llena. Entrá a otra con ?sala=otro-nombre.'));
  eventBus.on('net:close', () => {
    if (document.getElementById('overlay') && submit.disabled) message.textContent = 'Reconectando con el servidor. Tu dibujo sigue acá.';
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (submit.disabled) return;
    if (!editor.avatar.strokes.length) {
      message.textContent = 'Primero dibujá la carita de tu personaje.';
      return;
    }
    const name = input.value.trim() || 'Anónimo';
    try {
      localStorage.setItem('bomba:name', name);
      localStorage.setItem('bomba:avatar', JSON.stringify(editor.avatar));
    } catch { /* modo privado */ }
    initAudio();
    editor.disabled = true;
    submit.disabled = true;
    submit.textContent = 'GUARDANDO TU PERSONAJE…';
    message.textContent = 'Conectando y guardando tu dibujo en la sala…';
    editor.render();
    saveTimer = setTimeout(() => showError(gameState.connected
      ? 'El servidor tardó demasiado en guardar. Tu dibujo sigue acá. Intentá de nuevo.'
      : 'No pudimos conectar con la sala. Tu dibujo sigue acá. Revisá la conexión e intentá de nuevo.'), 12000);
    try {
      net.connect(sala, name, profileId, structuredClone(editor.avatar));
    } catch {
      showError('No pudimos conectar con la sala. Tu dibujo sigue acá. Intentá de nuevo.');
    }
  });

  // Entrás a la sala mientras dibujás; el servidor te marca listo al guardar.
  net.connect(sala, undefined, profileId);

  // Ganchos para tests automáticos
  window.__GAME__ = game;
  window.__STATE__ = gameState;
  window.__BUS__ = eventBus;
  window.render_game_to_text = () => JSON.stringify({
    connected: gameState.connected,
    you: gameState.you,
    phase: gameState.phase,
    round: gameState.round,
    modifier: gameState.modifier,
    holder: gameState.holder,
    heat: gameState.heat,
    players: [...gameState.players.values()],
  });
}

boot();
