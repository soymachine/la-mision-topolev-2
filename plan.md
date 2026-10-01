# LA MISIÓN TOPOLEV — Plan de desarrollo

> Documento vivo. Cada tarea completada se marca con `[x]`. Si una sesión se corta,
> la siguiente debe continuar por la primera tarea sin marcar.

## 0. Concepto (resumen de diseño)

- **Género:** roguelike táctico de vuelo por turnos con construcción modular (inspiración: Cogmind para los
  módulos/daño por partes, Ultima Ratio Regum para la estética ASCII y la generación procedural del mundo).
- **Ambientación:** URSS, octubre de 1961. Un segundo evento de Tunguska esparce fragmentos de un objeto
  desconocido por Siberia. La oficina de diseño secreta OKB‑Topolev envía su prototipo modular **T‑0 «Zhuravl»**
  a recuperarlos y a traer el **Núcleo** desde el epicentro. La facción renegada **Dirección K** intenta impedirlo.
- **Bucle de juego:** despegar → cruzar un sector procedural (5 sectores) gestionando inercia, combustible,
  altitud y alerta → recoger fragmentos/restos/depósitos → combatir o esquivar → aterrizar en la pista de salida →
  hangar (reparar, repostar, comprar/desguazar, reconfigurar el avión con drag & drop) → siguiente sector.
- **Easy to learn:** 4 teclas de vuelo (girar, acelerar, ejecutar) + clic en el destino previsualizado.
- **Hard to master:** inercia (el avión nunca se detiene), arcos de tiro dependientes de la ranura, altitud vs. radar,
  relación empuje/masa, cobertura de módulos (qué pieza recibe el impacto), economía chatarra/fragmentos.
- **Procedural:** mapas (ruido fractal + ríos + ciudades + bosque abatido radial en Tunguska), módulos
  (plantilla × calidad × rasgos × nombre/fábrica), tienda del hangar, patrullas, tormentas, anomalías, radio.
- **Visual:** rejilla ASCII en canvas (capa base con render diferencial), capa de efectos (partículas, trazadoras,
  estelas, interpolación de movimiento) y capa superior (tooltips, arrastre, menús). Negro + naranjas;
  especiales: cian (Objeto/anómalo), rojo (peligro), púrpura (anomalías), amarillo (combustible).
- **Tecnología:** HTML + JS vanilla sin build (funciona en GitHub Pages y abriendo `index.html`), guardado en
  `localStorage`, pantalla completa adaptativa.

## Fase 1 — Infraestructura
- [ ] 1.1 `index.html`, `css/style.css` (pantalla completa, overlay CRT sutil, fuente monoespaciada)
- [ ] 1.2 `js/term.js`: rejilla ASCII en canvas con render diferencial, cajas dibujadas a mano, sombreados, capa superior
- [ ] 1.3 `js/ui.js`: UI en modo inmediato (botones con rollover, regiones, tooltips, drag & drop, clic derecho)
- [ ] 1.4 `js/fx.js`: partículas, proyectiles trazadores, textos flotantes, temblor de pantalla, nieve ambiental
- [ ] 1.5 `js/sound.js`: efectos sintetizados con WebAudio (silenciables)
- [ ] 1.6 `js/save.js`: guardado/carga de partida, récords y ajustes en `localStorage`
- [ ] 1.7 `js/main.js`: bucle principal, gestor de pantallas, teclado, zoom (+/−)

## Fase 2 — Generación procedural
- [ ] 2.1 `js/rng.js`: RNG con semilla serializable + ruido de valor fractal
- [ ] 2.2 `js/data.js`: paleta, terreno, objetos, enemigos, sectores, plantillas de módulos, calidades, rasgos, textos
- [ ] 2.3 Generador de sectores: elevación/humedad, montañas, lagos, ríos, taiga, ciudades con fábricas, pistas
- [ ] 2.4 Colocación de fragmentos, restos, depósitos, radares, antiaéreos, tormentas, anomalías, Núcleo
- [ ] 2.5 Bosque abatido radial en el sector de Tunguska
- [ ] 2.6 Generador de módulos (calidad, rasgos, anómalos, nombre, fábrica de origen, valor)

## Fase 3 — Vuelo
- [ ] 3.1 Estadísticas derivadas (masa, empuje, velocidad máx., consumo, maniobra, visión, etc.)
- [ ] 3.2 Opciones de maniobra con inercia (giro ±45°/±90°, acelerador) y viraje cerrado
- [ ] 3.3 Ejecución del turno: movimiento paso a paso, bordes, colisión con montañas en baja altitud
- [ ] 3.4 Altitud alta/baja, combustible, planeo sin motores, niebla de guerra (visión)
- [ ] 3.5 Recogidas: fragmentos, restos (garfio y velocidad), fábricas, depósitos, Núcleo
- [ ] 3.6 Tormentas (granizo, turbulencia, ocultan del radar) y anomalías (distorsión espacial)
- [ ] 3.7 Aterrizaje en la pista de salida (baja altitud, velocidad ≤ 2)

## Fase 4 — Combate e IA
- [ ] 4.1 Armas por ranura con arcos (frontal, cola, torreta), alcance, precisión, munición
- [ ] 4.2 Fuego automático / retener, objetivo marcado (TAB / clic), munición limitada solo al objetivo
- [ ] 4.3 Daño por cobertura a módulos (Cogmind), fuselaje, críticos, destrucción de módulos
- [ ] 4.4 IA de cazas con inercia (buscan la cola del jugador), exploradores, cañoneros, Ecos
- [ ] 4.5 Estructuras de tierra: radar (detección) y antiaéreos
- [ ] 4.6 Sistema de alerta y oleadas de refuerzos, patrullas iniciales, despawn
- [ ] 4.7 Botín: chatarra por derribo, restos que caen al suelo

## Fase 5 — Interfaz de vuelo
- [ ] 5.1 Barra superior (sector, turno, fragmentos, chatarra, alerta)
- [ ] 5.2 Vista del mapa con cámara suave, terreno visto/recordado, objetos, estructuras, tormentas
- [ ] 5.3 Previsualización de maniobras en el mapa (rollover + clic para ejecutar)
- [ ] 5.4 Panel del avión: esquema ASCII con ranuras, lista de módulos, bodega, estado
- [ ] 5.5 Drag & drop de módulos en vuelo (cuesta un turno), eyectar
- [ ] 5.6 Tooltips de terreno, enemigos (probabilidad de impacto) y módulos
- [ ] 5.7 Registro de mensajes con colores + chatter de radio procedural
- [ ] 5.8 Indicador de dirección a la pista / Núcleo, mapa del sector (M)

## Fase 6 — Hangar
- [ ] 6.1 Pantalla de hangar con esquema, bodega, almacén y desguace (drag & drop)
- [ ] 6.2 Servicios: reparar, repostar (reserva gratuita + pago), rearmar
- [ ] 6.3 Tienda procedural (chatarra) + módulo anómalo (fragmentos)
- [ ] 6.4 Despegue al siguiente sector

## Fase 7 — Meta
- [ ] 7.1 Pantalla de título animada (logo ASCII, paisaje, nieve, menú)
- [ ] 7.2 Sección de Instrucciones (varias páginas, leyenda de símbolos)
- [ ] 7.3 Briefing de sector (texto mecanografiado)
- [ ] 7.4 Menú de pausa (continuar, instrucciones, guardar y salir, abandonar)
- [ ] 7.5 Derrota / Victoria con resumen y puntuación
- [ ] 7.6 Archivo de récords
- [ ] 7.7 Guardado automático por turno y botón Continuar

## Fase 8 — Pulido y pruebas
- [ ] 8.1 Prueba automática en Chromium headless (sin errores de consola, capturas)
- [ ] 8.2 Ajuste de balance básico (combustible, daño, oleadas)
- [ ] 8.3 Revisión de rendimiento (render diferencial) y de tamaños de pantalla

## Fase 9 — Publicación
- [ ] 9.1 `README.md` con instrucciones de juego y despliegue
- [ ] 9.2 `.nojekyll` y rutas relativas para GitHub Pages
- [ ] 9.3 Commit y push a la rama de desarrollo

## Ideas futuras (no imprescindibles)
- [ ] Música ambiental generativa
- [ ] Más tipos de enemigos y eventos de radio con decisiones
- [ ] Modo diario con semilla compartida
- [ ] Soporte táctil completo para móvil
