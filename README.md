# 💣 Bomba Caliente

Papa caliente online para 2 a 8 personas (ideal 6). Phaser 3 + PartyKit.

## Jugar en local

```bash
npm install && (cd server && npm install)
cp .env.example .env

npm run server   # terminal 1: servidor PartyKit en :1999
npm run dev      # terminal 2: juego en http://localhost:3002
```

Abrí varias pestañas para simular jugadores. Tus amigos en la misma red
pueden entrar con `http://<tu-ip>:3002` (cambiá `VITE_SERVER_URL` en `.env`
a `<tu-ip>:1999`).

## Controles

| Tecla | Qué hace |
|---|---|
| WASD / flechas | Moverse |
| ESPACIO | Pedo-propulsión 💨 (10% nuclear) |
| 1–6 | Burlas (🐔, JAJAJA, 😈, perdón, 💩, te amo) |
| ENTER | Arrancar partida (en el lobby) |
| M | Silencio |

En celular, arrastrá el control de la izquierda para moverte y tocá el botón
de la derecha para impulsarte. En la sala de espera, tocá «Empezar las 5 rondas».
Se juega mejor con el teléfono horizontal.

## Tu personaje

El primer paso es dibujar sobre una esfera. Los ojos animados ya vienen puestos:
dibujá la nariz, boca, bigote o lo que quieras con mouse o dedo. Podés deshacer,
borrar, elegir el color de la esfera y tocar una miniatura para seleccionar pelo,
gorra o sombrero, con su propio color. Incluye «Tony recién despierto».

Al guardar, PartyKit valida y persiste el dibujo y los accesorios en el almacenamiento
de la sala. Recién entonces aparecés como listo. Todos ven los personajes en la
galería y en la cancha. El mismo navegador recupera su dibujo al volver a esa sala;
el identificador se conserva en el almacenamiento local del navegador.

## Reglas

- Al que tiene la bomba le basta con tocar a otro para pasársela. Corre un 12% más rápido.
- La partida empieza cuando hay al menos dos personas y todas guardaron su personaje.
- Son **5 rondas y nadie queda eliminado**. Sobrevivir a una explosión suma 1 punto.
- La mecha dura entre 8 y 24 s según la cantidad de jugadores. El pitido se acelera.
- Si te explota, tu personaje y tu nombre aparecen en grande para todos por un momento.
  No sumás esa ronda, pero seguís jugando en la siguiente.
- Cada ronda (desde la 2) trae un modificador: 🧊 hielo, ⚡ turbo, 🙃 controles invertidos, 🌑 apagón, 🎈 cabezones.
- Gana quien suma más puntos. Empates: menos tiempo con la bomba; si también empatan,
  más pases y finalmente un orden estable de jugadores.
- La foto final muestra un podio con el ganador posando y los demás chamuscados, con sus puntos y premios absurdos según los pases, pedos y tiempo con la bomba.
- Si entrás durante una partida, participás desde la próxima ronda.

## Verificar cambios

Con las dependencias de la web y del servidor instaladas:

```bash
npm test
npm run build
./server/node_modules/.bin/tsc --noEmit -p server/tsconfig.json
```

## Publicarlo

```bash
cd server && npx partykit deploy   # imprime la URL, ej. bomba-caliente.tuusuario.partykit.dev
```

Poné esa URL en `VITE_SERVER_URL` (o en `NET.SERVER_URL` de `src/core/Constants.js`),
corré `npm run build` y subí `dist/` a cualquier hosting estático (GitHub Pages, Netlify, here.now).
Cada grupo puede usar su sala: `?sala=nombre`.

## Dónde tocar

- `src/content/frases.js`: todos los textos graciosos. Agregá los chistes internos del grupo.
- `server/src/server.ts`: reglas (duración de la mecha, modificadores, inmunidad).
- `src/core/Constants.js`: velocidades, obstáculos de la arena, fuerza del pedo.
