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
- [x] 1.1 `index.html`, `css/style.css` (pantalla completa, overlay CRT sutil, fuente monoespaciada)
- [x] 1.2 `js/term.js`: rejilla ASCII en canvas con render diferencial, cajas dibujadas a mano, sombreados, capa superior
- [x] 1.3 `js/ui.js`: UI en modo inmediato (botones con rollover, regiones, tooltips, drag & drop, clic derecho)
- [x] 1.4 `js/fx.js`: partículas, proyectiles trazadores, textos flotantes, temblor de pantalla, nieve ambiental
- [x] 1.5 `js/sound.js`: efectos sintetizados con WebAudio (silenciables)
- [x] 1.6 `js/save.js`: guardado/carga de partida, récords y ajustes en `localStorage`
- [x] 1.7 `js/main.js`: bucle principal, gestor de pantallas, teclado, zoom (+/−)

## Fase 2 — Generación procedural
- [x] 2.1 `js/rng.js`: RNG con semilla serializable + ruido de valor fractal
- [x] 2.2 `js/data.js`: paleta, terreno, objetos, enemigos, sectores, plantillas de módulos, calidades, rasgos, textos
- [x] 2.3 Generador de sectores: elevación/humedad, montañas, lagos, ríos, taiga, ciudades con fábricas, pistas
- [x] 2.4 Colocación de fragmentos, restos, depósitos, radares, antiaéreos, tormentas, anomalías, Núcleo
- [x] 2.5 Bosque abatido radial en el sector de Tunguska
- [x] 2.6 Generador de módulos (calidad, rasgos, anómalos, nombre, fábrica de origen, valor)

## Fase 3 — Vuelo
- [x] 3.1 Estadísticas derivadas (masa, empuje, velocidad máx., consumo, maniobra, visión, etc.)
- [x] 3.2 Opciones de maniobra con inercia (giro ±45°/±90°, acelerador) y viraje cerrado
- [x] 3.3 Ejecución del turno: movimiento paso a paso, bordes, colisión con montañas en baja altitud
- [x] 3.4 Altitud alta/baja, combustible, planeo sin motores, niebla de guerra (visión)
- [x] 3.5 Recogidas: fragmentos, restos (garfio y velocidad), fábricas, depósitos, Núcleo
- [x] 3.6 Tormentas (granizo, turbulencia, ocultan del radar) y anomalías (distorsión espacial)
- [x] 3.7 Aterrizaje en la pista de salida (baja altitud, velocidad ≤ 2)

## Fase 4 — Combate e IA
- [x] 4.1 Armas por ranura con arcos (frontal, cola, torreta), alcance, precisión, munición
- [x] 4.2 Fuego automático / retener, objetivo marcado (TAB / clic), munición limitada solo al objetivo
- [x] 4.3 Daño por cobertura a módulos (Cogmind), fuselaje, críticos, destrucción de módulos
- [x] 4.4 IA de cazas con inercia (buscan la cola del jugador), exploradores, cañoneros, Ecos
- [x] 4.5 Estructuras de tierra: radar (detección) y antiaéreos
- [x] 4.6 Sistema de alerta y oleadas de refuerzos, patrullas iniciales, despawn
- [x] 4.7 Botín: chatarra por derribo, restos que caen al suelo

## Fase 5 — Interfaz de vuelo
- [x] 5.1 Barra superior (sector, turno, fragmentos, chatarra, alerta)
- [x] 5.2 Vista del mapa con cámara suave, terreno visto/recordado, objetos, estructuras, tormentas
- [x] 5.3 Previsualización de maniobras en el mapa (rollover + clic para ejecutar)
- [x] 5.4 Panel del avión: esquema ASCII con ranuras, lista de módulos, bodega, estado
- [x] 5.5 Drag & drop de módulos en vuelo (cuesta un turno), eyectar
- [x] 5.6 Tooltips de terreno, enemigos (probabilidad de impacto) y módulos
- [x] 5.7 Registro de mensajes con colores + chatter de radio procedural
- [x] 5.8 Indicador de dirección a la pista / Núcleo, mapa del sector (M)

## Fase 6 — Hangar
- [x] 6.1 Pantalla de hangar con esquema, bodega, almacén y desguace (drag & drop)
- [x] 6.2 Servicios: reparar, repostar (reserva gratuita + pago), rearmar
- [x] 6.3 Tienda procedural (chatarra) + módulo anómalo (fragmentos)
- [x] 6.4 Despegue al siguiente sector

## Fase 7 — Meta
- [x] 7.1 Pantalla de título animada (logo ASCII, paisaje, nieve, menú)
- [x] 7.2 Sección de Instrucciones (varias páginas, leyenda de símbolos)
- [x] 7.3 Briefing de sector (texto mecanografiado)
- [x] 7.4 Menú de pausa (continuar, instrucciones, guardar y salir, abandonar)
- [x] 7.5 Derrota / Victoria con resumen y puntuación
- [x] 7.6 Archivo de récords
- [x] 7.7 Guardado automático por turno y botón Continuar

## Fase 8 — Pulido y pruebas
- [x] 8.1 Prueba automática en Chromium headless (sin errores de consola, capturas)
- [x] 8.2 Ajuste de balance básico (combustible, daño, oleadas)
- [x] 8.3 Revisión de rendimiento (render diferencial) y de tamaños de pantalla

## Fase 9 — Publicación
- [x] 9.1 `README.md` con instrucciones de juego y despliegue
- [x] 9.2 `.nojekyll` y rutas relativas para GitHub Pages
- [x] 9.3 Commit y push a la rama de desarrollo

## Fase 10 — Ratón y zoom (iteración 2)
- [x] 10.1 Celdas grandes 2×2 en el terminal (render diferencial compatible) y fuente doble
- [x] 10.2 Zoom ×1 / ×2 del mapa (tecla Z, rueda del ratón, botón), capa de efectos escalada
- [x] 10.3 Paneo del mapa con botón central (y arrastre izquierdo en zona vacía), botón/tecla C para centrar
- [x] 10.4 Barra de acciones clicable sobre el mapa (ejecutar, altitud, evasiva, bengala, kit, zoom, centrar)

## Fase 11 — 10 mejoras de profundidad
- [x] 11.1 Talentos del piloto: elegir 1 de 3 en cada hangar (10 talentos)
- [x] 11.2 Maniobra evasiva «tonel»: −30% precisión enemiga ese turno, no disparas, cuesta combustible, enfriamiento
- [x] 11.3 Encargos del Ministerio: objetivo secundario procedural por sector con recompensa
- [x] 11.4 Eventos de radio con decisiones (socorro, desertor, silencio de radio, suministros, frecuencia falsa)
- [x] 11.5 Averías críticas: módulos por debajo del 35% fallan (motor, arma encasquillada, fuga, sistema caído)
- [x] 11.6 Viento por sector: a favor ahorra combustible, en contra lo gasta; arrastra las tormentas
- [x] 11.7 Ciclo día/noche: de noche menos visión propia y enemiga, antiaéreos menos precisos
- [x] 11.8 Taller del hangar: mejorar la calidad de un módulo con chatarra
- [x] 11.9 Lanzamisiles SAM «Ψ»: largo alcance, solo contra altitud alta, recarga
- [x] 11.10 Consumibles: bengalas (rompen el blocaje) y kits de reparación; compra en hangar
- [x] 11.11 Instrucciones actualizadas, migración de partidas guardadas, pruebas

## Fase 12 — Cabina e instrumentos (iteración 3)
- [ ] 12.1 Giro dependiente de la velocidad (vel 1: 135°, vel 2: 90°, vel ≥3: 45°; alerones +45°): permite volver hacia el oeste
- [ ] 12.2 Distribución de energía del generador (MOT/ARM/SIS) con efectos en empuje, consumo, precisión y sistemas
- [ ] 12.3 Temperatura de motores y radiador (abrir enfría pero consume); sobrecalentamiento daña motores
- [ ] 12.4 Hielo en altitud alta (noche, tormentas, sectores fríos): masa, giro y velocidad; deshielo
- [ ] 12.5 Panel de cabina compacto: brújula de cinta con marcadores, estado de vuelo, barras, consumo/autonomía
- [ ] 12.6 Pantalla de radar con barrido, blips clicables, pista y fragmentos
- [ ] 12.7 Horizonte artificial reactivo al giro y altitud programados
- [ ] 12.8 Módulos en rejilla de 2 columnas y bodega en fichas (drag & drop, clic derecho)
- [ ] 12.9 Teclas (V radiador, 1/2/3 energía), tooltips de instrumentos, instrucciones, migración, pruebas

## Ideas futuras (no imprescindibles)
- [ ] Música ambiental generativa
- [ ] Más tipos de enemigos y eventos de radio con decisiones
- [ ] Modo diario con semilla compartida
- [ ] Soporte táctil completo para móvil
