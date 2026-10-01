# LA MISIÓN TOPOLEV

*Siberia, octubre de 1961.* Roguelike táctico de vuelo por turnos en ASCII, para el navegador.

Pilota el prototipo modular **T‑0 «Zhuravl»** a través de cinco sectores generados proceduralmente,
recupera los fragmentos del Objeto y trae el Núcleo desde el epicentro de Tunguska.

## Jugar

- **Online:** en la GitHub Pages del repositorio (ver más abajo).
- **En local:** abre `index.html` en cualquier navegador moderno (no necesita servidor ni instalación).

La partida se guarda automáticamente en el `localStorage` del navegador cada turno.
Las instrucciones completas están dentro del juego, en **INSTRUCCIONES**.

### Controles básicos

| Tecla | Acción |
|---|---|
| `←` `→` / `A` `D` | programar giro |
| `↑` `↓` / `W` `S` | programar acelerador |
| `ESPACIO` / `ENTER` | ejecutar la maniobra |
| clic en una flecha del mapa | ejecutar esa maniobra directamente |
| `X` | cambiar de altitud |
| `TAB` / clic en un enemigo | marcar objetivo |
| `F` | fuego automático / retener |
| `M` | mapa del sector |
| `ESC` | menú |
| `+` / `−` | tamaño de letra |
| arrastrar y soltar | mover módulos entre ranuras, bodega, almacén y desguace |

## Publicar en GitHub Pages

1. En GitHub, abre el repositorio → **Settings** → **Pages**.
2. En **Build and deployment → Source** elige **Deploy from a branch**.
3. En **Branch** selecciona la rama que contiene el juego (`main` una vez fusionada, o directamente
   `claude/blissful-cerf-1f6j2x`) y la carpeta **`/ (root)`**. Pulsa **Save**.
4. Tras uno o dos minutos el juego estará en `https://soymachine.github.io/la-mision-topolev-2/`.

## Estructura

```
index.html        página única (tres capas de canvas: base, efectos, superposición)
css/style.css     pantalla completa y efecto CRT
js/rng.js         RNG con semilla y ruido fractal
js/data.js        paleta, terreno, enemigos, sectores, módulos, textos e instrucciones
js/term.js        terminal ASCII con render diferencial
js/ui.js          UI en modo inmediato: botones, tooltips, drag & drop
js/fx.js          partículas, trazadoras, textos flotantes, temblor
js/sound.js       efectos sintetizados con WebAudio
js/save.js        guardado, récords y ajustes
js/gen.js         generación procedural de sectores y módulos
js/game.js        reglas: vuelo, combate, IA, alerta, hangar
js/screens.js     pantallas: título, instrucciones, vuelo, hangar, final
js/main.js        arranque y bucle principal
plan.md           plan de desarrollo por fases
```
