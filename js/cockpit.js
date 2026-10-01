'use strict';
// Panel de cabina del T-0 en vuelo: brújula, estado, motor y célula, energía, radar, horizonte,
// módulos en rejilla y bodega en fichas.

const KIND_SHORT = {
  piston: 'Pistón', reactor: 'Reactor', turbohelice: 'Turbohél.', tanque: 'Tanque', autosellante: 'T.autosell.',
  ventral: 'D.ventral', placa: 'Placa', compuesto: 'Compuesto', laminado: 'Laminado', canon: 'Cañón', torreta: 'Torreta',
  cohetes: 'Cohetes', bombas: 'Bombas', radar: 'Radar', ecm: 'Interfer.', alerones: 'Alerones', garfio: 'Garfio',
  mira: 'Mira', resonador: 'Resonador', reparador: 'Reparac.', sigilo: 'Sigilo', postquemador: 'Postquem.',
};
function shortName(m) { return `${KIND_SHORT[m.kind] || m.base} ${m.model}`; }

// disposición de ranuras en la rejilla de dos columnas (izquierda, derecha)
const GRID = [[0, 1], [2, 5], [3, 4], [6, 7], [8, 9], [10, 11], [12, null]];
const COMPASS = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO' };
const BUSN = { mot: 'MOT', arm: 'ARM', sis: 'SIS' };
const BUSD = {
  mot: ['Empuje ×0.70 · consumo ×0.85 · calor ×0.6', 'Empuje ×0.85 · consumo ×0.92 · calor ×0.8', 'Empuje normal', 'Empuje ×1.12 · consumo ×1.10 · calor ×1.25', 'Empuje ×1.24 · consumo ×1.22 · calor ×1.5'],
  arm: ['Armas APAGADAS: no disparan', 'Precisión −15%', 'Precisión normal', 'Precisión +8%', 'Precisión +15%'],
  sis: ['Sistemas APAGADOS: sin radar, ECM, mira, resonador ni reparación', 'Sistemas al 50%', 'Sistemas al 100%', 'Sistemas al 125% · deshielo eléctrico', 'Sistemas al 150% · deshielo eléctrico'],
};

const Cockpit = {
  hdg: null, bank: 0, pitch: 0,

  sep(x, y, w, title, col) {
    Term.put(x, y, '├', COL.o4); Term.hline(x + 1, y, w - 2, COL.o4); Term.put(x + w - 1, y, '┤', COL.o4);
    if (title) Term.rich(x + 2, y, ` ${title} `, col || COL.o2);
  },

  draw(x, y, w, h, dt) {
    const st = G.st, P = st.plane, S = G.calc();
    Panel.hoverSlot = -1;
    const ix = x + 2, iw = w - 4;
    Term.box(x, y, w, h, COL.o4, COL.panel, 'T-0 «ЖУРАВЛЬ»', COL.o2);
    const ph = G.dayPhase();
    const clock = ` ${ph === 'noche' ? '☾' : ph === 'día' ? '☼' : '◐'} ${G.clockStr()} `;
    Term.text(x + w - clock.length - 2, y, clock, ph === 'noche' ? COL.storm : COL.o3, COL.panel);
    let r = y + 1;

    this.compass(ix - 1, r, iw + 2, S, dt); r += 2;
    this.flightRows(ix, r, iw, S); r += 3;
    this.sep(x, r, w, 'MOTOR Y CÉLULA'); r++;
    this.engineRows(ix, r, iw, S); r += 2;
    const used = G.powerUsed(), free = S.gen - used;
    this.sep(x, r, w, `ENERGÍA {w}${used}/${S.gen}{/}${free < 0 ? ' {r}¡SOBRECARGA!{/}' : ''}`); r++;
    this.powerRow(ix, r, iw, S); r++;

    const cargoRows = Math.ceil(P.cargo.length / 3);
    const after = 1 + GRID.length + 1 + cargoRows + 1 + 3;
    const avail = (y + h - 1) - r - 1 - after;
    if (avail >= 5) {
      const rh = Math.min(avail, 16);
      const hw = 14;
      const on = S.radar && st.power.sis > 0;
      const range = on ? Math.max(S.detect, S.visR) : S.visR;
      this.sep(x, r, w, on ? `RADAR {w}${range}{/}` : st.blind > 0 ? '{y}RADAR APAGADO{/}' : `VISUAL {w}${range}{/}`);
      Term.put(x + w - hw - 2, r, '┬', COL.o4);
      Term.text(x + w - hw, r, ' ACTITUD ', COL.o2);
      r++;
      this.radar(x + 1, r, w - hw - 3, rh, S, on, range);
      for (let k = 0; k < rh; k++) Term.put(x + w - hw - 2, r + k, '│', COL.o4);
      this.horizon(x + w - hw - 1, r, hw, rh, dt, S);
      r += rh;
      Term.put(x + w - hw - 2, r, '┴', COL.o4);
    }
    this.sep(x, r, w, 'MÓDULOS'); if (avail >= 5) Term.put(x + w - 16, r, '┴', COL.o4); r++;
    this.modules(x + 1, r, w - 2); r += GRID.length;
    this.sep(x, r, w, `BODEGA ${P.cargo.filter(Boolean).length}/${P.cargo.length}`); r++;
    this.cargo(x + 1, r, w - 2); r += cargoRows;
    const bottom = y + h - 1;
    r = Math.max(r, bottom - 4);
    this.sep(x, r, w); r++;
    this.status(ix, r, iw, S);
  },

  // ---------------------------------------------------------------- brújula de cinta
  compass(x, y, w, S, dt) {
    const st = G.st, P = st.plane, map = st.map;
    const target = P.h * 45;
    if (this.hdg == null) this.hdg = target;
    const d = ((target - this.hdg + 540) % 360) - 180;
    this.hdg = (this.hdg + d * Math.min(1, dt * 6) + 360) % 360;
    const c = Math.floor(w / 2), dpc = 7.5;
    const offCol = deg => Math.round(c + ((((deg - this.hdg) % 360) + 540) % 360 - 180) / dpc);
    Term.fill(x, y, w, 2, ' ', COL.o1, COL.panel2);
    for (let i = 0; i < w; i++) {
      const deg = ((this.hdg + (i - c) * dpc) % 360 + 360) % 360;
      const r15 = deg % 15;
      if (r15 < dpc / 2 || r15 > 15 - dpc / 2) Term.put(x + i, y, (deg % 45 < dpc / 2 || deg % 45 > 45 - dpc / 2) ? '|' : '·', COL.o5, COL.panel2);
    }
    for (const k in COMPASS) {
      const col = offCol(+k), n = COMPASS[k];
      const sx = col - Math.floor((n.length - 1) / 2);
      if (sx >= 0 && sx + n.length <= w) Term.text(x + sx, y, n, Math.abs(col - c) <= 1 ? COL.white : (+k % 90 ? COL.o3 : COL.o2), COL.panel2);
    }
    Term.setBg(x + c, y, COL.hi2);
    // marcadores
    const mark = (bear, ch, col, edge) => {
      let cx = offCol(bear);
      if (cx < 0 || cx >= w) { if (!edge) return; cx = cx < 0 ? 0 : w - 1; ch = cx === 0 ? '◄' : '►'; }
      Term.put(x + cx, y + 1, ch, col, COL.panel2);
    };
    const bearing = (tx, ty) => (Math.atan2(ty - P.y, tx - P.x) * 180 / Math.PI + 90 + 360) % 360;
    Term.put(x + c, y + 1, '▲', COL.white, COL.panel2);
    if (st.wind) mark(st.wind.d * 45, '≈', COL.storm);
    for (const e of st.enemies) if (G.enemyVisible(e, S)) mark(bearing(e.x, e.y), e.id === st.targetId ? '◆' : '•', e.id === st.targetId ? COL.yellow : ENEMY[e.type].c);
    if (map.nuc && !st.nucleo && SECTORS[st.sector].nucleo) mark(bearing(map.nuc[0], map.nuc[1]), '◉', COL.cyan, true);
    mark(bearing(map.exitPos.x, map.exitPos.y), 'P', COL.yellow, true);
    if (UI.hit(x, y, w, 2)) {
      const pb = Math.round(bearing(map.exitPos.x, map.exitPos.y));
      UI.tip = { title: 'BRÚJULA', lines: [`Rumbo {w}${P.h * 45}° ${DIRN[P.h]}{/}. Pista {y}P{/} a ${pb}° (${cheb(P.x, P.y, map.exitPos.x, map.exitPos.y)} casillas).`, '{s}≈{/} hacia dónde sopla el viento · {r}•{/} contactos · {y}◆{/} objetivo', '{c}◉{/} el Núcleo · {y}◄ ►{/} destino fuera de la escala'] };
    }
  },

  // ---------------------------------------------------------------- vuelo, estructura, combustible
  flightRows(x, y, w, S) {
    const st = G.st, P = st.plane;
    // fila 1: velocidad, giro, altitud
    let cx = x;
    cx += Term.text(cx, y, 'VEL ', COL.o3);
    for (let k = 1; k <= Math.max(S.maxS, P.s, 1); k++) Term.put(cx++, y, k <= P.s ? '●' : '○', k > S.maxS ? COL.red : COL.o2);
    cx += Term.text(cx, y, ` ${P.s}/${S.maxS}`, COL.cream) + 2;
    cx += Term.text(cx, y, 'GIRO ', COL.o3);
    cx += Term.text(cx, y, `±${S.turnMax * 45}°`, S.turnMax >= 3 ? COL.white : COL.cream) + 2;
    cx += Term.text(cx, y, 'ALT ', COL.o3);
    Term.text(cx, y, (P.alt ? '▲ ALTA' : '▼ BAJA') + (st.pendingAlt ? (blink(0.5) ? ' ⇅' : '  ') : ''), P.alt ? COL.white : COL.o2);
    if (UI.hit(x, y, w, 1)) UI.tip = { title: 'VUELO', lines: [`Velocidad máxima ${S.maxS} (empuje ${S.thrust.toFixed(1)} / masa ${S.mass}).`, 'El giro máximo depende de la velocidad actual:', '{w}vel 1: ±135°   vel 2: ±90°   vel ≥3: ±45°{/}', `Alerones: +45° cada uno.${P.ice >= 60 ? ' {y}El hielo resta 45°.{/}' : ''}`, 'Los giros de 90° o más cuestan 1 de velocidad.'] };
    // fila 2: estructura y combustible
    const sf = P.structure / P.maxStructure;
    Term.text(x, y + 1, 'ESTR', COL.o3);
    Term.bar(x + 5, y + 1, 9, sf, sf < 0.3 ? (blink(0.6) ? COL.red : COL.dred) : sf < 0.6 ? COL.yellow : COL.o1);
    Term.text(x + 15, y + 1, String(Math.ceil(P.structure)).padStart(3), COL.cream);
    const ff = S.fuelCap ? P.fuel / S.fuelCap : 0;
    Term.text(x + 20, y + 1, 'COMB', COL.o3);
    Term.bar(x + 25, y + 1, 9, ff, ff < 0.2 ? (blink(0.6) ? COL.red : COL.yellow) : COL.yellow);
    Term.text(x + 35, y + 1, `${Math.floor(P.fuel)}/${Math.round(S.fuelCap)}`, COL.cream);
    // fila 3: consumo, autonomía, viento
    const use = G.fuelUse(S, P.s, P.alt);
    const aut = use > 0 ? Math.floor(P.fuel / use) : 999;
    const wm = Math.round((G.windMul(P.h) - 1) * 100);
    const leak = S.leak ? ` {r}FUGA −${S.leak}{/}` : '';
    Term.rich(x, y + 2, `{m}CONS{/} ${use.toFixed(2)}/t  {m}AUTON.{/} ${aut > 99 ? '∞' : aut + 't'}  {m}VIENTO{/} ${st.wind ? ARROWS[st.wind.d] : '-'} ${wm > 0 ? '{r}+' + wm : '{n}' + wm}%{/}${leak}`, COL.cream, null, w);
    if (UI.hit(x, y + 1, w, 2)) {
      const pista = cheb(P.x, P.y, G.st.map.exitPos.x, G.st.map.exitPos.y);
      UI.tip = { title: 'CÉLULA Y COMBUSTIBLE', lines: [`Estructura ${Math.ceil(P.structure)}/${P.maxStructure}. Combustible ${P.fuel.toFixed(1)}/${Math.round(S.fuelCap)}.`, `Consumo actual ${use.toFixed(2)} por turno: autonomía de {w}${aut > 99 ? '∞' : aut}{/} turnos.`, `La pista está a ~${Math.ceil(pista / Math.max(1, P.s))} turnos a esta velocidad.`, `Viento: ${wm > 0 ? 'en contra, +' + wm : 'a favor, ' + wm}% de consumo con este rumbo.`, P.radOpen ? '{y}Radiador abierto: +8% de consumo.{/}' : ''] };
    }
  },

  // ---------------------------------------------------------------- temperatura, radiador, hielo
  engineRows(x, y, w, S) {
    const st = G.st, P = st.plane;
    Term.text(x, y, 'TEMP', COL.o3);
    const tw = 14, lo = 25, hi = 125;
    for (let i = 0; i < tw; i++) {
      const tc = lo + (i + 0.5) * (hi - lo) / tw;
      const filled = tc <= P.temp;
      const zc = tc >= 100 ? COL.red : tc >= 85 ? COL.yellow : COL.o2;
      Term.put(x + 5 + i, y, filled ? '█' : '░', filled ? zc : (tc >= 100 ? COL.dred : tc >= 85 ? '#5a4a10' : COL.o6));
    }
    const tcol = P.temp > 100 ? (blink(0.4) ? COL.red : COL.white) : P.temp > 85 ? COL.yellow : COL.cream;
    Term.text(x + 20, y, `${Math.round(P.temp)}°`.padStart(4), tcol);
    UI.button(x + w - 15, y, P.radOpen ? 'RAD ABIERTO' : 'RAD CERRADO', { w: 15, col: P.radOpen ? COL.yellow : COL.o3, onClick: () => G.toggleRadiator(), tip: { title: 'RADIADOR (V)', lines: ['Abierto: enfría casi el doble, pero la resistencia', 'aumenta el consumo un 8%.', 'Los motores se calientan con la velocidad y la', 'energía del bus MOT. Por encima de 100° se dañan.', 'El aire de altitud alta, la noche y las tormentas enfrían.'] } });
    if (UI.hit(x, y, 25, 1)) UI.tip = { title: 'TEMPERATURA DE MOTORES', lines: [`${Math.round(P.temp)}°. Zona amarilla 85°, zona roja 100° (daños cada turno).`, 'Por encima de 90° el empuje cae un 12%.', 'Reduce velocidad o energía MOT, o abre el radiador (V).'] };
    // hielo y generador
    Term.text(x, y + 1, 'HIELO', COL.o3);
    Term.bar(x + 6, y + 1, 8, P.ice / 100, P.ice >= 90 ? COL.red : P.ice >= 60 ? COL.yellow : COL.storm, COL.o6);
    Term.text(x + 15, y + 1, `${Math.round(P.ice)}%`.padStart(4), P.ice >= 60 ? COL.yellow : COL.cream);
    const ice = P.ice >= 90 ? '{r}−1 VMÁX{/}' : P.ice >= 60 ? '{y}−45° GIRO{/}' : P.ice >= 30 ? '{s}+masa{/}' : '{g}limpio{/}';
    Term.rich(x + 21, y + 1, ice, COL.cream);
    Term.rich(x + w - 9, y + 1, `{m}GEN{/} ${S.gen}`, COL.cream);
    if (UI.hit(x, y + 1, w, 1)) UI.tip = { title: 'HIELO Y GENERADOR', lines: ['El hielo se acumula volando ALTO, más de noche, en tormentas', 'y en sectores fríos. 30%: más masa · 60%: −45° de giro · 90%: −1 vel.', 'Se elimina volando BAJO, con motores calientes o con el', 'deshielo eléctrico (energía SIS ≥ 3).', '', `Generador: ${S.gen} unidades (2 base + 2 por motor sano, 1 si está averiado).`] };
  },

  // ---------------------------------------------------------------- energía
  powerRow(x, y, w, S) {
    const st = G.st;
    let cx = x;
    for (const bus of ['mot', 'arm', 'sis']) {
      const v = st.power[bus];
      const hov = UI.hit(cx, y, 9, 1);
      Term.text(cx, y, BUSN[bus], hov ? COL.white : COL.o3);
      for (let k = 0; k < 4; k++) {
        const on = k < v;
        const col = bus === 'mot' ? COL.o1 : bus === 'arm' ? COL.red : COL.cyan;
        Term.put(cx + 4 + k, y, on ? '▮' : '▯', on ? col : COL.o5, hov ? COL.hi : null);
        UI.region(cx + 4 + k, y, 1, 1, { onClick: () => G.setPower(bus, v === k + 1 ? k : k + 1), onRight: () => G.setPower(bus, 0) });
      }
      UI.region(cx, y, 4, 1, { onClick: () => G.cyclePower(bus) });
      if (hov) UI.tip = { title: `ENERGÍA · ${BUSN[bus]} (tecla ${bus === 'mot' ? 1 : bus === 'arm' ? 2 : 3})`, lines: [`Nivel actual ${v}: {w}${BUSD[bus][v]}{/}`, '', ...BUSD[bus].map((d, i) => `${i === v ? '{y}►' : ' {g}'} ${i}: ${d}{/}`), '', 'Clic en un cuadro para fijar el nivel; clic derecho: 0.'] };
      cx += 10;
    }
    const free = S.gen - G.powerUsed();
    Term.rich(cx, y, free > 0 ? `{m}LIBRE{/} {w}${free}{/}` : free < 0 ? '{r}SOBRECARGA{/}' : '{g}LIBRE 0{/}', COL.cream);
  },

  // ---------------------------------------------------------------- radar
  radar(x, y, w, h, S, on, range) {
    const st = G.st, P = st.plane, map = st.map, t = now();
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    const sweep = (t * 1.8) % (Math.PI * 2);
    const TAU = Math.PI * 2;
    const behindOf = ang => ((sweep - ang) % TAU + TAU * 2) % TAU;
    const dist = (c, r) => Math.hypot((c - cx) / cx, (r - cy) / cy);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const u = (c - cx) / cx, v = (r - cy) / cy, d = Math.hypot(u, v);
      if (d > 1) { Term.put(x + c, y + r, ' ', COL.o5, COL.panel); continue; }
      const behind = behindOf(Math.atan2(v, u));
      let bg = '#0b0805';
      if (on) bg = behind < 0.12 ? '#41230a' : behind < 0.4 ? '#2a1708' : behind < 0.9 ? '#1a0e06' : '#0b0805';
      let ch = ' ', fg = COL.o6;
      const edge = dist(c + 1, r) > 1 || dist(c - 1, r) > 1 || dist(c, r + 1) > 1 || dist(c, r - 1) > 1;
      const mid = d <= 0.5 && (dist(c + 1, r) > 0.5 || dist(c - 1, r) > 0.5 || dist(c, r + 1) > 0.5 || dist(c, r - 1) > 0.5);
      if (edge) { ch = '·'; fg = COL.o4; }
      else if (mid) { ch = '·'; fg = '#4a2a0c'; }
      else if (Math.round(cx) === c || Math.round(cy) === r) { ch = '·'; fg = '#33190a'; }
      if (on && behind < 0.12 && !edge) { ch = '·'; fg = COL.o2; }
      Term.put(x + c, y + r, ch, fg, bg);
    }
    const toCell = (wx, wy, clampEdge) => {
      let u = (wx - P.x) * 0.72 / range, v = (wy - P.y) / range;
      const d = Math.hypot(u, v);
      if (d > 1) { if (!clampEdge) return null; u = u / d * 0.98; v = v / d * 0.98; }
      return [Math.round(cx + u * cx), Math.round(cy + v * cy), Math.atan2(v, u)];
    };
    const blip = (wx, wy, ch, col, opts = {}) => {
      const p = toCell(wx, wy, opts.edge);
      if (!p) return;
      const f = on && !opts.steady ? 1 - behindOf(p[2]) / TAU : 1;
      Term.put(x + p[0], y + p[1], ch, f > 0.6 ? col : dimc(col, 0.5 + 0.5 * f));
      if (opts.onClick) UI.region(x + p[0], y + p[1], 1, 1, { onClick: opts.onClick });
      if (opts.tip && UI.hit(x + p[0], y + p[1], 1, 1)) UI.tip = opts.tip;
    };
    // objetos e instalaciones conocidas
    for (const k in map.items) {
      if (!map.seen[k]) continue;
      const it = map.items[k], ix = k % map.w, iy = (k / map.w) | 0;
      const col = it.type === 'frag' || it.type === 'nucleo' ? COL.cyan : it.type === 'depot' || it.type === 'survivor' || it.type === 'cache' || it.type === 'signal' ? COL.yellow : null;
      if (col) blip(ix, iy, it.type === 'nucleo' ? '◉' : '·', col, { steady: true });
    }
    for (const gg of G.groundList()) if (map.seen[gg.idx]) blip(gg.x, gg.y, GROUND[gg.g.type].g, dimc(COL.red, 0.7), { steady: true, onClick: () => { st.targetId = gg.id; Sound.play('click'); } });
    blip(map.exitPos.x, map.exitPos.y, 'P', COL.yellow, { edge: true, steady: true });
    if (map.nuc && !st.nucleo && SECTORS[st.sector].nucleo) blip(map.nuc[0], map.nuc[1], '◉', COL.cyan, { edge: true, steady: true });
    for (const e of st.enemies) {
      if (!G.enemyVisible(e, S)) continue;
      const tg = e.id === st.targetId;
      const def = ENEMY[e.type];
      blip(e.x, e.y, tg ? '◆' : (e.aware > 0 || st.alert >= 50 ? '•' : '∙'), tg ? COL.yellow : def.c, {
        onClick: () => { st.targetId = e.id; Sound.play('click'); },
        tip: { title: def.n, lines: [`Distancia ${cheb(P.x, P.y, e.x, e.y)} · integridad ${e.hp}/${e.maxHp}`, e.aware > 0 || st.alert >= 50 ? '{r}Te ha localizado{/}' : '{g}Patrullando{/}', '{g}Clic: marcar objetivo{/}'] },
      });
    }
    Term.put(x + Math.round(cx), y + Math.round(cy), ARROWS[P.h], COL.white, '#0b0805');
    if (!on) Term.text(x + 1, y + h - 1, st.blind > 0 ? 'silencio' : S.radar ? 'SIS 0' : 'sin radar', COL.o5);
    if (UI.hit(x, y, w, h) && !UI.tip) UI.tip = { title: on ? 'RADAR DE A BORDO' : 'OBSERVACIÓN VISUAL', lines: [on ? `Alcance ${range} casillas. El barrido refresca los ecos.` : `Sin radar operativo: solo ves hasta ${range} casillas.`, '{r}•{/} contacto que te busca · {r}∙{/} patrulla · {y}◆{/} objetivo', '{y}P{/} pista · {c}·{/} fragmento · {y}·{/} suministros · {r}Ж Ш Ψ{/} instalaciones', 'Clic en un eco para marcarlo como objetivo.'] };
  },

  // ---------------------------------------------------------------- horizonte artificial
  horizon(x, y, w, h, dt, S) {
    const st = G.st, P = st.plane;
    const tb = st.phase === 'flight' ? clamp(st.pTurn, -3, 3) : 0;
    this.bank += (tb - this.bank) * Math.min(1, dt * 4);
    const tp = st.pendingAlt ? (P.alt ? -1 : 1) : 0;
    this.pitch += (tp - this.pitch) * Math.min(1, dt * 4);
    const ih = h - 2;
    const cx = (w - 1) / 2, cy = (ih - 1) / 2 + this.pitch * Math.max(1, ih / 5);
    const k = clamp(this.bank, -2.2, 2.2) * 0.3;
    const sl = k * 0.5, thick = Math.max(0.5, Math.abs(sl) / 2 + 0.05);
    for (let c = 0; c < w; c++) {
      const yl = cy - sl * (c - cx);
      for (let r = 0; r < ih; r++) {
        let ch = ' ', fg = COL.o5, bg = '#100c0a';
        if (r > yl + thick) { bg = '#2a1406'; if ((c + Math.round(r - yl)) % 5 === 0 && r - yl > 1.5) { ch = '·'; fg = '#4a2608'; } }
        else if (r >= yl - thick) { ch = Math.abs(k) < 0.12 ? '─' : k > 0 ? '/' : '\\'; fg = COL.o2; bg = '#2a1406'; }
        else if (Math.abs(c - cx) < 1 && Math.round(yl - r) % 2 === 0) { ch = '-'; fg = '#3a2a20'; }
        Term.put(x + c, y + r, ch, fg, bg);
      }
    }
    const my = y + Math.round((ih - 1) / 2), mx = x + Math.round(cx);
    Term.put(mx - 3, my, '─', COL.yellow); Term.put(mx - 2, my, '─', COL.yellow);
    Term.put(mx, my, 'o', COL.yellow);
    Term.put(mx + 2, my, '─', COL.yellow); Term.put(mx + 3, my, '─', COL.yellow);
    const deg = st.pTurn * 45;
    Term.text(x, y + ih, (deg ? `${Math.abs(deg)}°${deg < 0 ? 'I' : 'D'}` : 'nivel').padEnd(6), COL.o3);
    Term.text(x + 6, y + ih, (st.pendingAlt ? (P.alt ? '▼BAJA' : '▲ALTA') : '').padStart(w - 6), COL.yellow);
    Term.text(x, y + ih + 1, `${P.alt ? '3200' : ' 300'}m`, COL.o4);
    Term.text(x + w - 7, y + ih + 1, `${Math.round(60 + P.s * 95)}k/h`.padStart(7), COL.o4);
    if (UI.hit(x, y, w, h)) UI.tip = { title: 'HORIZONTE ARTIFICIAL', lines: ['Muestra la maniobra programada antes de ejecutarla:', 'se inclina con el giro y cabecea con el cambio de altitud.'] };
  },

  // ---------------------------------------------------------------- módulos en rejilla
  modules(x, y, w) {
    const st = G.st, P = st.plane;
    const colW = Math.floor((w - 1) / 2);
    GRID.forEach((pair, r) => pair.forEach((i, ci) => {
      if (i == null) return;
      const cx = x + ci * (colW + 1), ry = y + r;
      const m = P.slots[i], dst = { to: 'slot', i };
      const dropOk = UI.dropHover(cx, ry, colW, 1, p => G.canMove(p, dst));
      const hov = UI.region(cx, ry, colW, 1, {
        drag: m ? { payload: { from: 'slot', i }, label: modName(m), col: TIERS[m.tier].c } : null,
        drop: { accept: p => G.canMove(p, dst), onDrop: p => G.flightMove(p, dst) },
      });
      if (hov) Panel.hoverSlot = i;
      const bg = dropOk ? COL.hi2 : hov ? COL.hi : COL.panel;
      Term.fill(cx, ry, colW, 1, ' ', COL.o1, bg);
      Term.put(cx + 1, ry, CAT[SLOTS[i].cat].g, m ? hpColor(m) : COL.dgrey, bg);
      if (m) {
        if (isCrit(m)) Term.put(cx + 2, ry, '!', blink(0.6) ? COL.red : COL.yellow, bg);
        let n = shortName(m);
        if (m.maxAmmo) n += ` ·${m.ammo}`;
        if (i === 5 && m.arc !== 'T') n += ' ◄';
        Term.text(cx + 3, ry, n, TIERS[m.tier].c, bg, colW - 9);
        const f = m.hp / m.maxHp;
        for (let k = 0; k < 4; k++) Term.put(cx + colW - 5 + k, ry, f * 4 > k + 0.5 ? '▮' : f * 4 > k ? '▯' : '·', f * 4 > k ? hpColor(m) : COL.o6, bg);
        if (hov) UI.tip = modTip(m, i);
      } else {
        Term.text(cx + 3, ry, SLOTS[i].n.toLowerCase(), COL.dgrey, bg, colW - 4);
        if (hov && !UI.drag) UI.tip = { lines: [`Ranura vacía: ${CAT[SLOTS[i].cat].n.toUpperCase()}.`, 'Arrastra aquí un módulo compatible (cuesta 1 turno).'], title: SLOTS[i].n };
      }
    }));
  },

  // ---------------------------------------------------------------- bodega en fichas
  cargo(x, y, w) {
    const P = G.st.plane;
    const cw = Math.floor(w / 3);
    P.cargo.forEach((m, i) => {
      const cx = x + (i % 3) * cw, ry = y + Math.floor(i / 3);
      const dst = { to: 'cargo', i };
      const dropOk = UI.dropHover(cx, ry, cw - 1, 1, p => G.canMove(p, dst));
      const hov = UI.region(cx, ry, cw - 1, 1, {
        drag: m ? { payload: { from: 'cargo', i }, label: modName(m), col: TIERS[m.tier].c } : null,
        drop: { accept: p => G.canMove(p, dst), onDrop: p => G.flightMove(p, dst) },
        onRight: m ? () => { const a = G.autoEquip(i); if (a) G.flightMove({ from: 'cargo', i }, a.dst); } : null,
      });
      const bg = dropOk ? COL.hi2 : hov ? COL.hi : '#120a05';
      Term.fill(cx, ry, cw - 1, 1, ' ', COL.o1, bg);
      if (m) {
        Term.put(cx, ry, CAT[m.cat].g, COL.o3, bg);
        Term.text(cx + 2, ry, shortName(m), TIERS[m.tier].c, bg, cw - 3);
        if (hov) { const tp = modTip(m); tp.lines.push(`{g}Masa en bodega: ${m.mass}. Arrastra a una ranura o clic derecho para equipar.{/}`); UI.tip = tp; }
      } else Term.text(cx, ry, '·', COL.o6, bg);
    });
  },

  // ---------------------------------------------------------------- estado: objetivo, encargo, botones
  status(x, y, w, S) {
    const st = G.st;
    const tgt = st.targetId && (st.enemies.find(e => e.id === st.targetId) || G.groundById(st.targetId));
    if (tgt) {
      const n = tgt.type ? ENEMY[tgt.type].n : GROUND[tgt.g.type].n;
      const hp = tgt.type ? `${tgt.hp}/${tgt.maxHp}` : `${tgt.g.hp}/${tgt.g.maxHp}`;
      Term.rich(x, y, `{m}OBJ{/} {r}${n}{/} ${hp}${st.fireMode === 'hold' ? ' {y}· FUEGO RETENIDO{/}' : ''}`, COL.cream, null, w);
    } else Term.rich(x, y, `{m}OBJ{/} {g}ninguno (TAB / clic){/}${st.fireMode === 'hold' ? ' {y}· FUEGO RETENIDO{/}' : ''}`, COL.cream, null, w);
    const ci = G.contractInfo();
    if (ci) {
      Term.rich(x, y + 1, `{m}ENC{/} ${ci.ok ? '{n}' : '{y}'}${ci.progTxt}{/} {g}${ci.txt}{/}`, COL.cream, null, w);
      if (UI.hit(x, y + 1, w, 1)) UI.tip = { title: 'ENCARGO DEL MINISTERIO', lines: [ci.txt + '.', `Recompensa al aterrizar: ${ci.reward}.`, ci.live ? '' : '{g}Se comprueba al aterrizar.{/}'] };
    } else if (st.perks.length) Term.rich(x, y + 1, `{m}TAL{/} {g}${st.perks.map(k => PERKS[k].n).join(', ')}{/}`, COL.cream, null, w);
    const by = y + 2;
    const ejOk = UI.dropHover(x, by, 12, 1, p => p.from !== 'shop');
    if (UI.drag) Term.text(x, by, ejOk ? '►EYECTAR◄  ' : '[ EYECTAR ]', ejOk ? COL.bg : COL.red, ejOk ? COL.red : COL.panel);
    else Term.text(x, by, '[ EYECTAR ]', COL.dred);
    UI.region(x, by, 12, 1, { drop: { accept: p => p.from !== 'shop', onDrop: p => G.flightMove(p, { to: 'eject' }) } });
    if (UI.hit(x, by, 12, 1) && !UI.drag) UI.tip = { lines: ['Arrastra aquí un módulo para soltarlo en vuelo.', 'No cuesta turno. El módulo se pierde.'], title: 'EYECTAR', col: COL.red };
    UI.button(x + 13, by, `FUEGO:${st.fireMode === 'auto' ? 'AUTO' : 'RET.'}`, { w: 14, col: st.fireMode === 'auto' ? COL.o1 : COL.yellow, onClick: () => Flight.toggleFire(), tip: { lines: ['F: alterna disparo automático / retener fuego.', 'Disparar eleva la alerta.'] } });
    UI.button(x + 28, by, 'MAPA', { w: w - 28, onClick: () => { Flight.showMap = true; } });
  },
};
