'use strict';
// Datos estáticos: paleta, terreno, objetos, enemigos, sectores, módulos y textos.

const COL = {
  bg: '#080605', panel: '#0d0805', panel2: '#160d06', hi: '#2b1607', hi2: '#3d1f08',
  o1: '#ff8a1e', o2: '#ffb35c', o3: '#d4700f', o4: '#97500f', o5: '#5c300a', o6: '#331a06',
  white: '#f7e9d2', cream: '#e8cfa8', grey: '#8b7a66', dgrey: '#4d4036',
  red: '#ff4130', dred: '#7d1a10', cyan: '#5ff5df', dcyan: '#1c6e66', purple: '#c38cff', dpurple: '#4f3478',
  yellow: '#ffe070', storm: '#8391a8', green: '#a6ff6e',
};

const MAP_W = 100, MAP_H = 50;
const DX = [0, 1, 1, 1, 0, -1, -1, -1], DY = [-1, -1, 0, 1, 1, 1, 0, -1];
const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
const DIRN = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

// Terreno: n nombre, c color visible, bg fondo, flags
const TER = {
  ' ': { n: 'Nieve', c: '#3a1e08' },
  '.': { n: 'Tundra', c: '#6a3912' },
  ',': { n: 'Tundra', c: '#55300f' },
  "'": { n: 'Tundra', c: '#55300f' },
  '♣': { n: 'Taiga', c: '#a8570f', forest: true },
  '♠': { n: 'Taiga densa', c: '#8a4610', forest: true },
  '^': { n: 'Colinas', c: '#c47420' },
  '▲': { n: 'Montaña', c: '#f2b675', block: true },
  '≈': { n: 'Lago helado', c: '#82502a', bg: '#120905', water: true },
  '~': { n: 'Río helado', c: '#94602e', bg: '#120905', water: true },
  '#': { n: 'Bloques de viviendas', c: '#cf9050', city: true },
  '▪': { n: 'Naves industriales', c: '#a8682a', city: true },
  ':': { n: 'Avenida', c: '#5e3816', city: true },
  '=': { n: 'Pista de aterrizaje', c: '#ffd08a', bg: '#2a1505' },
  '§': { n: 'Anomalía espacial', c: COL.purple, bg: '#160c22', anom: true },
  '-': { n: 'Bosque abatido', c: '#7c4214' },
  '|': { n: 'Bosque abatido', c: '#7c4214' },
  '/': { n: 'Bosque abatido', c: '#7c4214' },
  '\\': { n: 'Bosque abatido', c: '#7c4214' },
  '×': { n: 'Suelo calcinado', c: '#4a2a14' },
};

const ITEMS = {
  frag: { g: '◊', c: COL.cyan, n: 'Fragmento del Objeto', d: 'Vuela bajo sobre él para recogerlo. Puntúa y sirve de moneda para módulos anómalos.' },
  wreck: { g: '%', c: COL.o2, n: 'Restos de aeronave', d: 'Vuela bajo y despacio (garfio) para recuperar un módulo y chatarra.' },
  factory: { g: 'Ω', c: '#ffa040', n: 'Fábrica abandonada', d: 'Vuela bajo y despacio para saquear un módulo de mejor calidad.' },
  depot: { g: '⌂', c: COL.yellow, n: 'Depósito de combustible', d: 'Vuela bajo y despacio para repostar en vuelo.' },
  nucleo: { g: '◉', c: COL.cyan, n: 'EL NÚCLEO', d: 'El corazón del Objeto. Recógelo en baja altitud y llévalo a la pista de evacuación.' },
};

const GROUND = {
  radar: { g: 'Ж', c: COL.red, n: 'Estación de radar «P-12»', hp: 18, scrap: 8, score: 40, d: 'Detecta aviones en altitud alta (radio 14) y baja (radio 5). Eleva la alerta.' },
  aa: { g: 'Ш', c: COL.red, n: 'Batería antiaérea «KS-19»', hp: 24, scrap: 10, score: 50, range: 5, dmg: [3, 7], acc: 32, d: 'Dispara en radio 5. Más precisa contra aviones en altitud baja.' },
};

const ENEMY = {
  scout: { g: 'v', n: 'Explorador Po-2K', c: '#ff7a5a', hp: 8, spd: 2, man: 2, sight: 10, w: [], scrap: 5, score: 20, scout: true, d: 'Desarmado. Si te ve, eleva la alerta cada turno.' },
  yak: { g: 'y', n: 'Caza Yak-K', c: COL.red, hp: 14, spd: 3, man: 2, sight: 9, w: [{ dmg: [2, 4], range: 3, acc: 55, arc: 'F', shots: 1 }], scrap: 9, score: 40, d: 'Caza ligero. Cañón frontal.' },
  mig: { g: 'M', n: 'Interceptor MiG-K', c: COL.red, hp: 22, spd: 4, man: 2, sight: 10, w: [{ dmg: [3, 5], range: 4, acc: 58, arc: 'F', shots: 2 }], scrap: 15, score: 80, smart: true, d: 'Rápido y astuto: evita tu arco frontal.' },
  heavy: { g: 'B', n: 'Cañonero Il-K', c: '#ff5a3a', hp: 40, spd: 2, man: 1, sight: 9, w: [{ dmg: [3, 6], range: 4, acc: 50, arc: 'T', shots: 1 }], scrap: 24, score: 120, d: 'Lento y blindado. Torreta de 360°.' },
  eco: { g: 'Ф', n: 'Eco', c: COL.purple, hp: 26, spd: 3, man: 3, sight: 12, w: [{ dmg: [4, 7], range: 2, acc: 70, arc: 'T', shots: 1, drain: 4 }], scrap: 12, score: 150, anom: true, d: 'Una sombra del Objeto. Drena combustible al impactar.' },
};

const SECTORS = [
  {
    name: 'Taiga de Tomsk', field: 'Aeródromo de Kolpashevo',
    desc: 'Bosque infinito y ríos helados. La Dirección K apenas tiene presencia aquí: algunos exploradores y cazas ligeros. Buen lugar para aprender a volar el T-0.',
    forest: 0.58, mtn: 0.0, water: 0.10, rivers: 1, cities: 1, citySize: 1, radars: 1, aa: 1, wrecks: 6, frags: 5, depots: 3,
    storms: 1, anom: 0, patrols: 1, pool: [['scout', 3], ['yak', 3]], maxE: 3,
  },
  {
    name: 'Llanura del Yeniséi', field: 'Aeródromo de Yeniseisk',
    desc: 'Llanura abierta: poca cobertura y radares en cada colina. Los primeros MiG de la Dirección K han sido avistados.',
    forest: 0.32, mtn: 0.02, water: 0.16, rivers: 2, cities: 2, citySize: 1, radars: 2, aa: 3, wrecks: 6, frags: 6, depots: 3,
    storms: 2, anom: 0, patrols: 2, pool: [['scout', 2], ['yak', 4], ['mig', 1]], maxE: 4,
  },
  {
    name: 'Meseta de Putorana', field: 'Base aérea de Tura',
    desc: 'Mesetas basálticas y cañones profundos. Volar bajo es arriesgado entre tantas montañas, pero volar alto te expone a los radares.',
    forest: 0.22, mtn: 0.13, water: 0.10, rivers: 1, cities: 1, citySize: 1, radars: 2, aa: 4, wrecks: 7, frags: 7, depots: 3,
    storms: 3, anom: 0, patrols: 2, pool: [['yak', 3], ['mig', 2], ['heavy', 1]], maxE: 4,
  },
  {
    name: 'Krasnoyarsk-26', field: 'Pista secreta de Vanavara',
    desc: 'Ciudad cerrada. No figura en ningún mapa. Fábricas, antiaéreos y el cuartel general de la Dirección K. Las primeras anomalías aparecen en el cielo.',
    forest: 0.26, mtn: 0.03, water: 0.08, rivers: 1, cities: 4, citySize: 2, radars: 4, aa: 7, wrecks: 7, frags: 7, depots: 3,
    storms: 2, anom: 3, patrols: 3, pool: [['yak', 2], ['mig', 3], ['heavy', 2]], maxE: 5,
  },
  {
    name: 'Epicentro de Tunguska', field: 'Pista de evacuación «Rassvet»',
    desc: 'Árboles abatidos en círculos perfectos. El aire vibra. En el centro espera el Núcleo... y los Ecos que lo protegen. Sin el Núcleo no hay aterrizaje.',
    forest: 0.5, mtn: 0.03, water: 0.08, rivers: 1, cities: 0, citySize: 1, radars: 2, aa: 4, wrecks: 8, frags: 9, depots: 3,
    storms: 3, anom: 12, patrols: 3, pool: [['mig', 2], ['eco', 4], ['heavy', 1]], maxE: 6, nucleo: true,
  },
];

// Ranuras del T-0. arc: arco de tiro de las armas montadas (F frontal, R cola). Las torretas son 360°.
const SLOTS = [
  { cat: 'motor', n: 'Motor izq.' },
  { cat: 'motor', n: 'Motor der.' },
  { cat: 'arma', n: 'Morro', arc: 'F' },
  { cat: 'arma', n: 'Ala izq.', arc: 'F' },
  { cat: 'arma', n: 'Ala der.', arc: 'F' },
  { cat: 'arma', n: 'Cola', arc: 'R' },
  { cat: 'tanque', n: 'Tanque izq.' },
  { cat: 'tanque', n: 'Tanque der.' },
  { cat: 'blindaje', n: 'Blindaje ventral' },
  { cat: 'blindaje', n: 'Blindaje dorsal' },
  { cat: 'sistema', n: 'Sistema A' },
  { cat: 'sistema', n: 'Sistema B' },
  { cat: 'sistema', n: 'Sistema C' },
];
const CARGO_SIZE = 6;
const CAT = {
  motor: { n: 'Motor', g: 'M' }, arma: { n: 'Arma', g: 'A' }, tanque: { n: 'Tanque', g: 'T' },
  blindaje: { n: 'Blindaje', g: 'B' }, sistema: { n: 'Sistema', g: 'S' },
};
const ARCN = { F: 'frontal', R: 'cola', T: 'torreta 360°' };

const TIERS = [
  { n: 'Defectuoso', c: '#9a8a76', mult: 0.78 },
  { n: 'Estándar', c: COL.o1, mult: 1 },
  { n: 'Mejorado', c: COL.o2, mult: 1.15 },
  { n: 'Prototipo', c: COL.white, mult: 1.3 },
  { n: 'Anómalo', c: COL.cyan, mult: 1.45 },
];

const MOD_T = {
  motor: [
    { kind: 'piston', base: 'Motor de pistón', models: ['M-11', 'M-17', 'AM-34', 'VK-105', 'ASh-82'], thrust: 10, cons: 0.42, mass: 3, hp: 18, cov: 10, w: 3 },
    { kind: 'reactor', base: 'Turborreactor', models: ['RD-10', 'RD-20', 'RD-45', 'VK-1', 'AM-5'], thrust: 15, cons: 0.72, mass: 3.5, hp: 14, cov: 10, w: 2, min: 1 },
    { kind: 'turbohelice', base: 'Turbohélice', models: ['TV-2', 'NK-12', 'AI-20'], thrust: 12.5, cons: 0.4, mass: 4, hp: 22, cov: 11, w: 1.5, min: 2 },
  ],
  tanque: [
    { kind: 'tanque', base: 'Tanque', models: ['BT-1', 'BT-3', 'PB-5'], cap: 30, mass: 2, hp: 14, cov: 12, w: 3 },
    { kind: 'autosellante', base: 'Tanque autosellante', models: ['AS-2', 'AS-4'], cap: 24, mass: 2.4, hp: 26, cov: 10, w: 1.5, min: 1 },
    { kind: 'ventral', base: 'Depósito ventral', models: ['DV-6', 'DV-9'], cap: 46, mass: 3.2, hp: 10, cov: 16, w: 1, min: 2 },
  ],
  blindaje: [
    { kind: 'placa', base: 'Placa de acero', models: ['ST-3', 'ST-5', 'BR-8'], mass: 4, hp: 30, cov: 30, w: 3 },
    { kind: 'compuesto', base: 'Blindaje compuesto', models: ['K-1', 'K-4'], mass: 3, hp: 32, cov: 28, w: 1.5, min: 2 },
    { kind: 'laminado', base: 'Placas laminadas', models: ['L-2', 'L-7'], mass: 5.2, hp: 46, cov: 34, w: 1, min: 3 },
  ],
  arma: [
    { kind: 'canon', base: 'Cañón', models: ['ShVAK', 'VYa-23', 'NS-37', 'NR-23'], dmg: [3, 6], range: 4, acc: 70, ammo: null, shots: 1, mass: 2, hp: 12, cov: 8, w: 3 },
    { kind: 'torreta', base: 'Torreta', models: ['UBT', 'ShKAS', 'UB-12'], dmg: [2, 4], range: 3, acc: 64, ammo: null, shots: 1, arc: 'T', mass: 2.6, hp: 12, cov: 9, w: 2 },
    { kind: 'cohetes', base: 'Cohetes', models: ['RS-82', 'RS-132', 'S-5'], dmg: [8, 14], range: 7, acc: 56, ammo: 6, shots: 1, mass: 2.5, hp: 10, cov: 8, w: 2 },
    { kind: 'bombas', base: 'Bombas', models: ['FAB-50', 'FAB-100', 'FAB-250'], dmg: [22, 34], range: 1, acc: 85, ammo: 4, shots: 1, arc: 'T', ground: true, mass: 3.5, hp: 10, cov: 9, w: 1.2 },
  ],
  sistema: [
    { kind: 'radar', base: 'Radar', models: ['Gneis-2', 'Izumrud', 'RP-1'], sys: { vision: 4, detect: 18 }, mass: 1.5, hp: 10, cov: 6, w: 2 },
    { kind: 'ecm', base: 'Interferidor', models: ['Siren', 'Buket', 'Rezeda'], sys: { ecm: 12 }, mass: 1.5, hp: 10, cov: 6, w: 2 },
    { kind: 'alerones', base: 'Alerones servo', models: ['SA-1', 'SA-3'], sys: { man: 1 }, mass: 1.5, hp: 12, cov: 7, w: 1.5 },
    { kind: 'garfio', base: 'Garfio magnético', models: ['GM-2', 'GM-4'], sys: { grab: 1 }, mass: 2, hp: 12, cov: 6, w: 1.5 },
    { kind: 'mira', base: 'Mira giroscópica', models: ['ASP-1', 'ASP-3N'], sys: { aim: 12 }, mass: 1, hp: 8, cov: 5, w: 2 },
    { kind: 'resonador', base: 'Resonador', models: ['R-0', 'R-1'], sys: { reso: 18 }, mass: 1.5, hp: 10, cov: 6, w: 1.5 },
    { kind: 'reparador', base: 'Equipo de reparación', models: ['ER-1', 'ER-2'], sys: { repair: 2 }, mass: 2.5, hp: 12, cov: 7, w: 1.2, min: 1 },
    { kind: 'sigilo', base: 'Revestimiento absorbente', models: ['P-3', 'P-7'], sys: { stealth: 35 }, mass: 2, hp: 10, cov: 8, w: 1.2, min: 1 },
    { kind: 'postquemador', base: 'Postquemador', models: ['F-1', 'F-2'], sys: { burner: 1 }, mass: 2, hp: 10, cov: 7, w: 1.2, min: 1 },
  ],
};

const SYSN = {
  vision: 'Visión', detect: 'Detección radar', ecm: 'Interferencia', man: 'Maniobra', grab: 'Garfio (vel. recogida)',
  aim: 'Puntería', reso: 'Resonancia', repair: 'Reparación/turno', stealth: 'Sigilo %', burner: 'Velocidad máx.',
};

const QUIRKS = {
  ligero: { n: 'Ligero', d: '−35% masa', good: true },
  robusto: { n: 'Robusto', d: '+50% integridad', good: true },
  afinado: { n: 'Afinado', d: '+15% rendimiento', good: true },
  compacto: { n: 'Compacto', d: '−40% cobertura (recibe menos impactos)', good: true },
  pesado: { n: 'Pesado', d: '+40% masa' },
  fragil: { n: 'Frágil', d: '−35% integridad' },
  desajustado: { n: 'Desajustado', d: '−15% rendimiento' },
  voluminoso: { n: 'Voluminoso', d: '+50% cobertura (atrae impactos)' },
};

const ANOM = {
  motor: { id: 'vacio', d: 'No consume combustible' },
  tanque: { id: 'fuente', d: 'Genera 0.6 de combustible por turno' },
  blindaje: { id: 'regen', d: 'Se regenera 2 puntos por turno' },
  arma: { id: 'certero', d: '+25 precisión e ignora la evasión' },
  sistema: { id: 'ojo', d: '+5 visión, +10 interferencia, resonancia 20' },
};

const NICKS = ['Zvezdá', 'Ródina', 'Burevéstnik', 'Sokol', 'Berkut', 'Vostok', 'Iskra', 'Mólnia', 'Strelá', 'Grom', 'Pravda',
  'Oktiabr', 'Chaika', 'Vympel', 'Rassvet', 'Druzhba', 'Pobeda', 'Kometa', 'Sputnik', 'Volná', 'Tráktor', 'Udárnik', 'Sever', 'Ural'];
const CITIES = ['Kúibyshev', 'Gorki', 'Kazán', 'Perm', 'Omsk', 'Novosibirsk', 'Járkov', 'Rybinsk', 'Ufá', 'Irkutsk', 'Tashkent',
  'Sverdlovsk', 'Zaporozhie', 'Leningrado', 'Moscú', 'Komsomolsk', 'Ulán-Udé', 'Saratov', 'Tbilisi', 'Voronezh'];

const RADIO = [
  'Torre {f}: «Zhuravl, aquí Torre. Mantenga silencio de radio.»',
  'Interceptado: «...objetivo de la Dirección K... prioridad absoluta...»',
  'Mando OKB: «Camarada, el Ministerio cuenta con cada fragmento.»',
  'Interferencias. Una voz lejana cuenta números en alemán.',
  'Interceptado: «Patrulla 7, sin contacto en cuadrante {q}.»',
  'Radio Moscú: «...la cosecha de este año supera todas las previsiones...»',
  'Mando OKB: «Recuerde: el T-0 no es un caza. Elija sus combates.»',
  'Estática. Por un instante, el altímetro marca cifras imposibles.',
  'Interceptado: «Han visto la Grulla. Repito: la Grulla está en el aire.»',
  'Torre {f}: «Viento del norte, 40 nudos. Hielo en las alas.»',
];

const TEXT = {
  lore: [
    '{b}30 de junio de 1908.{/} Algo estalla sobre el río Podkamennaya Tunguska y arrasa dos mil kilómetros cuadrados de taiga.',
    '',
    '{b}Octubre de 1961.{/} Las estaciones sísmicas registran un segundo evento. El cielo de Siberia se llena de {c}fragmentos{/} de algo que no figura en ningún catálogo.',
    '',
    'La oficina de diseño secreta {o}OKB-Topolev{/} ha construido el {w}T-0 «Zhuravl»{/} (la Grulla): un prototipo modular capaz de reconfigurarse en pleno vuelo con las piezas que encuentra.',
    '',
    'Tu misión, camarada piloto: cruzar {b}cinco sectores{/}, recuperar los fragmentos del Objeto y traer el {c}Núcleo{/} desde el epicentro.',
    '',
    'No eres el único interesado. La {r}Dirección K{/}, una facción renegada del aparato de seguridad, quiere el Núcleo para sí. Sus cazas patrullan el cielo y sus radares vigilan cada valle.',
  ],
};

// Páginas de instrucciones: [título, líneas]
const INSTR = [
  ['LA MISIÓN', [
    ...TEXT.lore,
    '',
    '{y}OBJETIVO{/}',
    '· Atraviesa los 5 sectores aterrizando en la pista de salida de cada uno (siempre al {b}este{/}).',
    '· Recoge {c}◊ fragmentos{/} por el camino: puntúan y sirven para comprar módulos anómalos.',
    '· En el sector 5 recoge el {c}◉ Núcleo{/} y aterriza en la pista de evacuación.',
    '· Si tu estructura llega a 0 o te quedas sin combustible y sin velocidad, la misión fracasa.',
    '  La muerte es permanente: la partida se borra.',
  ]],
  ['VUELO E INERCIA', [
    'El T-0 {b}nunca se detiene{/}. Cada turno avanza tantas casillas como su velocidad, en la dirección de su rumbo.',
    '',
    '{y}CONTROLES{/}',
    '  {w}← / A{/}  girar 45° a la izquierda      {w}→ / D{/}  girar 45° a la derecha',
    '  {w}↑ / W{/}  acelerar (+1)                 {w}↓ / S{/}  desacelerar (−1)',
    '  {w}ESPACIO / ENTER{/}  ejecutar la maniobra programada',
    '  {w}X{/}  cambiar de altitud      {w}TAB{/}  siguiente objetivo      {w}F{/}  fuego auto / retener',
    '  {w}M{/}  mapa del sector         {w}ESC{/}  menú                     {w}+ / −{/}  tamaño de letra',
    '',
    'En el mapa verás los {b}destinos posibles{/} de este turno. Pasa el ratón por encima para ver la',
    'trayectoria y haz {w}clic{/} para ejecutarla directamente.',
    '',
    '{y}MANIOBRA{/}: por defecto puedes girar 45° por turno. Con {b}alerones{/} puedes girar 90°, pero un',
    'viraje cerrado de 90° cuesta 1 punto de velocidad.',
    '',
    '{y}VELOCIDAD MÁXIMA{/}: depende de la relación {b}empuje / masa{/}. Cada módulo, cada pieza en la bodega',
    'y el propio combustible pesan. Un avión sobrecargado es un avión lento.',
    '',
    '{y}COMBUSTIBLE{/}: se consume cada turno según la velocidad y los motores. Volar bajo consume un 20% más.',
    'Sin combustible (o sin motores) el T-0 planea perdiendo 1 de velocidad por turno. En altitud alta puede\nentrar en picado una vez para ganar velocidad; en baja, al llegar a 0 se estrella...',
    'salvo que consigas posarte sobre una pista.',
  ]],
  ['ALTITUD Y ALERTA', [
    'El T-0 vuela en dos altitudes. Cambiar ({w}X{/}) se aplica al ejecutar el siguiente turno.',
    '',
    '{b}▲ ALTA{/}   · Ignoras el relieve.  · Ves más lejos.',
    '         · Los {r}radares Ж{/} te detectan desde 14 casillas.  · No puedes recoger nada.',
    '',
    '{b}▼ BAJA{/}   · Puedes recoger objetos.  · Los radares solo te ven a 5 casillas (2-3 en la taiga).',
    '         · Las {b}montañas ▲{/} te golpean.  · Los {r}antiaéreos Ш{/} son más precisos.',
    '         · Los cazas te apuntan peor (−20%).  · Consumes un 20% más.',
    '',
    '{y}ALERTA{/} (barra superior): sube cuando un radar o un explorador te detecta y cuando disparas.',
    'Baja lentamente cuando nadie te ve. Cada 25% de alerta la Dirección K envía {r}refuerzos{/}.',
    'Por encima del 50% todos sus cazas conocen tu posición.',
    '',
    '{s}░▒ TORMENTAS{/}: te ocultan del radar, pero el granizo daña módulos y la turbulencia te frena.',
    '{p}§ ANOMALÍAS{/}: distorsionan el espacio y te teletransportan a un punto cercano.',
  ]],
  ['COMBATE', [
    'Las armas disparan {b}automáticamente{/} al final de tu movimiento contra enemigos a su alcance.',
    '',
    '{y}ARCOS DE TIRO{/}: dependen de la ranura donde montes el arma.',
    '  · Morro y alas: arco {b}frontal{/} (unos 135° hacia tu rumbo).',
    '  · Cola: arco {b}trasero{/}.   · Las {b}torretas{/} disparan en 360° desde cualquier ranura.',
    '',
    '{y}OBJETIVO{/}: marca un enemigo con {w}TAB{/} o con {w}clic{/}. Las armas sin munición limitada disparan',
    'al objetivo marcado o, si no pueden, al enemigo más cercano. {b}Cohetes y bombas solo se disparan',
    'contra el objetivo marcado.{/} Con {w}F{/} puedes retener el fuego (disparar sube la alerta).',
    '',
    '{y}PROBABILIDAD DE IMPACTO{/}: precisión del arma + puntería − 4% por cada punto de velocidad del',
    'blanco − 3% por casilla de distancia. Pasa el ratón sobre un enemigo para verla.',
    '',
    '{y}DAÑO POR MÓDULOS{/}: cada impacto alcanza una pieza al azar según su {b}cobertura{/}. El blindaje',
    'tiene mucha cobertura y protege al resto. Si una pieza llega a 0 se destruye y la pierdes.',
    'Si el impacto alcanza el {w}fuselaje{/} resta {b}estructura{/}: a 0 el T-0 cae.',
    '',
    '{y}TIERRA{/}: radares y antiaéreos se atacan con {b}bombas{/} (alcance 1) o con cualquier arma',
    'volando en altitud baja.',
  ]],
  ['MÓDULOS', [
    'El T-0 tiene 13 ranuras: {b}2 motores, 4 armas, 2 tanques, 2 blindajes y 3 sistemas{/}, más una',
    'bodega de 6 huecos. {w}Arrastra y suelta{/} módulos entre ranuras y bodega.',
    '',
    '· En vuelo, cada reconfiguración {b}cuesta un turno{/} (mantienes rumbo y velocidad).',
    '· Arrastra un módulo a {r}EYECTAR{/} para soltarlo y aligerar peso.',
    '· {w}Clic derecho{/} en la bodega: equipar en la primera ranura compatible.',
    '',
    '{y}CALIDADES{/}: {g}Defectuoso{/} · {o}Estándar{/} · {b}Mejorado{/} · {w}Prototipo{/} · {c}Anómalo{/}',
    '{y}RASGOS{/}: Ligero, Robusto, Afinado, Compacto / Pesado, Frágil, Desajustado, Voluminoso.',
    '',
    '{y}SISTEMAS{/}',
    '  Radar (visión, detecta enemigos)   Interferidor (−precisión enemiga)   Alerones (+maniobra)',
    '  Garfio (recoger a más velocidad)   Mira (+puntería)   Resonador (detecta y atrae fragmentos)',
    '  Reparación (repara cada turno)     Revestimiento (sigilo frente a radar)   Postquemador (+vel.)',
    '',
    'Los módulos se consiguen en {b}% restos{/} y {b}Ω fábricas{/} (vuela bajo y despacio: velocidad ≤ 2,',
    '≤ 3 con garfio), en el almacén del hangar y, a veces, de los enemigos derribados.',
  ]],
  ['HANGAR', [
    'Al aterrizar llegas al hangar del aeródromo. Allí el tiempo no corre.',
    '',
    '· {b}Reparar{/}: 1 de chatarra por cada 3 puntos de integridad.',
    '· {b}Repostar{/}: el aeródromo tiene una reserva gratuita; después cuesta 1 de chatarra cada 2 unidades.',
    '· {b}Rearmar{/}: recarga cohetes y bombas.',
    '· {b}Almacén{/}: compra módulos con chatarra. El módulo {c}anómalo{/} se paga con {c}fragmentos{/}.',
    '· {b}Desguace{/}: arrastra un módulo para convertirlo en chatarra.',
    '',
    'Cada fragmento gastado es puntuación que no te llevas. Cada fragmento guardado es poder que no usas.',
    '',
    'La chatarra se obtiene derribando enemigos, destruyendo instalaciones y recuperando restos.',
  ]],
  ['LEYENDA', [
    '{w}→↗↑{/} el T-0 (la flecha indica el rumbo)   {r}v{/} explorador   {r}y{/} caza Yak   {r}M{/} interceptor MiG',
    '{r}B{/} cañonero   {p}Ф{/} Eco   {r}Ж{/} radar   {r}Ш{/} antiaéreo',
    '',
    '{c}◊{/} fragmento   {c}◉{/} Núcleo   {b}%{/} restos   {b}Ω{/} fábrica   {y}⌂{/} depósito de combustible',
    '{b}={/} pista de aterrizaje   {p}§{/} anomalía   {s}░▒{/} tormenta',
    '',
    '{m}♣ ♠{/} taiga   {m}^{/} colinas   {b}▲{/} montaña   {d}≈ ~{/} lago y río helados   {b}# ▪ :{/} ciudad',
    '{d}- | / \\{/} bosque abatido (Tunguska)   {d}. ,{/} tundra',
    '',
    'Las zonas que ya no ves se muestran atenuadas. Los enemigos solo aparecen dentro de tu visión',
    'o del alcance de detección de tu radar.',
    '',
    'En el panel del avión: {o}M{/} motor, {o}A{/} arma, {o}T{/} tanque, {o}B{/} blindaje, {o}S{/} sistema.',
    'El color indica el estado: {o}intacto{/}, {y}dañado{/}, {r}crítico{/}, {g}vacío{/}.',
  ]],
  ['CONSEJOS', [
    '· Planifica el giro {b}antes{/} de necesitarlo: a velocidad 4 un giro de 45° te desplaza mucho.',
    '· Un caza que se te pone en la cola no puede ser alcanzado por armas frontales. Una torreta',
    '  o un arma en la ranura de cola cambian ese duelo.',
    '· Cruzar alto es rápido y seguro frente al relieve, pero cada turno en el radio de un radar',
    '  acerca la siguiente oleada. Cruzar bajo por la taiga es lento pero discreto.',
    '· Las tormentas son escondites... caros.',
    '· El blindaje es un escudo de sacrificio: repáralo antes de que caiga.',
    '· Lleva la bodega ligera. Cada módulo de repuesto te cuesta velocidad.',
    '· Los cohetes deciden combates: márcale el objetivo correcto.',
    '· El combustible manda. Mira el indicador de la pista y calcula.',
    '· En el epicentro, los Ecos drenan combustible. Entra con los tanques llenos.',
  ]],
];
