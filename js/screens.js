'use strict';
// Pantallas: título, instrucciones, archivo, vuelo (con briefing, pausa y mapa), hangar y final.

const _dimCache = {};
function dimc(hex, f = 0.42) {
  const k = hex + f;
  if (_dimCache[k]) return _dimCache[k];
  const n = parseInt(hex.slice(1), 16);
  const base = [8, 6, 5];
  const v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const out = '#' + v.map((c, i) => Math.round(base[i] + (c - base[i]) * f).toString(16).padStart(2, '0')).join('');
  _dimCache[k] = out;
  return out;
}
const now = () => performance.now() / 1000;
const blink = (p = 1) => (now() % p) < p / 2;

const Screens = {
  cur: null,
  set(s, arg) { this.cur = s; UI.drag = null; UI.pressed = null; FX.reset(); if (s.enter) s.enter(arg); Term.invalidate(); },
};

// ---------------------------------------------------------------- utilidades de módulos
function modTip(m, slotIdx) {
  const L = [];
  const q = m.quirks && m.quirks.length ? ' · ' + m.quirks.map(k => (QUIRKS[k].good ? '{n}' : '{r}') + QUIRKS[k].n + '{/}').join(', ') : '';
  L.push(`{k}${TIERS[m.tier].n}{/} · ${CAT[m.cat].n}${q}`);
  L.push(`{g}«${m.nick}» · ${m.origin}{/}`);
  L.push('');
  const hpc = m.hp < m.maxHp * 0.35 ? '{r}' : m.hp < m.maxHp ? '{y}' : '{w}';
  L.push(`Integridad ${hpc}${m.hp}/${m.maxHp}{/}   Masa {w}${m.mass}{/}   Cobertura {w}${m.cov}{/}`);
  if (m.cat === 'motor') L.push(`Empuje {w}${m.thrust}{/}   Consumo {w}${m.cons}{/}/turno base`);
  if (m.cat === 'tanque') L.push(`Capacidad {w}${m.cap}{/} de combustible`);
  if (m.cat === 'blindaje') L.push('Pieza de sacrificio: su gran cobertura atrae los impactos.');
  if (m.cat === 'arma') {
    L.push(`Daño {w}${m.dmg[0]}-${m.dmg[1]}{/}${m.shots > 1 ? ' ×' + m.shots : ''}   Alcance {w}${m.range}{/}   Precisión {w}${m.acc}%{/}`);
    L.push(`Munición ${m.maxAmmo ? `{w}${m.ammo}/${m.maxAmmo}{/} (solo al objetivo marcado)` : '{w}ilimitada{/}'}`);
    const arc = slotIdx != null ? ARCN[G.weaponArc(m, slotIdx)] : (m.arc === 'T' ? ARCN.T : 'según la ranura (morro/alas: frontal, cola: trasero)');
    L.push(`Arco: {w}${arc}{/}`);
    if (m.ground) L.push('{y}Solo contra objetivos de tierra.{/}');
  }
  if (m.cat === 'sistema') for (const k in m.sys) L.push(`${SYSN[k]} {w}+${m.sys[k]}{/}`);
  if (m.quirks) for (const k of m.quirks) L.push(`Rasgo ${QUIRKS[k].good ? '{n}' : '{r}'}${QUIRKS[k].n}{/}: ${QUIRKS[k].d}`);
  if (m.anom) L.push(`{c}Anómalo: ${ANOM[m.cat].d}{/}`);
  if (m.price != null) L.push(`{y}Precio: ${m.price} ¤ chatarra{/}`);
  if (m.fragPrice != null) L.push(`{c}Precio: ${m.fragPrice} ◊ fragmentos{/}`);
  if (slotIdx != null) L.push(`{g}Ranura: ${SLOTS[slotIdx].n}{/}`);
  return { title: modName(m), lines: L, col: TIERS[m.tier].c };
}
function hpColor(m) { const f = m.hp / m.maxHp; return f < 0.35 ? COL.red : f < 0.75 ? COL.yellow : COL.o1; }

// ---------------------------------------------------------------- logo
const LOGO_FONT = {
  T: ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
  O: [' ███ ', '█   █', '█   █', '█   █', ' ███ '],
  P: ['████ ', '█   █', '████ ', '█    ', '█    '],
  L: ['█    ', '█    ', '█    ', '█    ', '█████'],
  E: ['█████', '█    ', '████ ', '█    ', '█████'],
  V: ['█   █', '█   █', '█   █', ' █ █ ', '  █  '],
};
function drawLogo(cx, y, wide) {
  const word = 'TOPOLEV';
  const sx = wide ? 2 : 1;
  const lw = (5 * 7 + 2 * 6) * sx;
  const x0 = cx - Math.floor(lw / 2);
  const t = now();
  const glitchRow = (t % 4 < 0.12) ? Math.floor((t * 50) % 5) : -1;
  const cols = [COL.yellow, COL.o2, COL.o1, COL.o3, COL.o4];
  for (let r = 0; r < 5; r++) {
    let x = x0 + (r === glitchRow ? 2 : 0);
    for (const ch of word) {
      const row = LOGO_FONT[ch][r];
      for (let k = 0; k < 5; k++) {
        if (row[k] === '█') for (let s = 0; s < sx; s++) {
          Term.put(x + k * sx + s + 1, y + r + 1, '▓', COL.o6);
        }
      }
      x += 7 * sx;
    }
    x = x0 + (r === glitchRow ? 2 : 0);
    for (const ch of word) {
      const row = LOGO_FONT[ch][r];
      for (let k = 0; k < 5; k++) if (row[k] === '█') for (let s = 0; s < sx; s++) Term.put(x + k * sx + s, y + r, '█', r === glitchRow ? COL.cyan : cols[r]);
      x += 7 * sx;
    }
  }
  return lw;
}

// ---------------------------------------------------------------- TÍTULO
const Title = {
  enter() { this.t0 = now(); this.noise = makeNoise(1961); this.planeT = 0; },
  draw(dt) {
    const C = Term.cols, Rr = Term.rows, t = now();
    Term.clear(COL.bg);
    UI.disabled = !!Modal.cur;
    // paisaje de fondo
    const off = Math.floor(t * 3);
    const horizon = Rr - 9;
    for (let x = 0; x < C; x++) {
      const n = this.noise((x + off) / 14, 0.5, 4);
      const hgt = Math.floor(n * 9);
      for (let y = horizon - hgt; y < Rr; y++) {
        const d = y - (horizon - hgt);
        const c = d === 0 ? '▲' : d < 3 ? '^' : ((x + off + y) % 3 === 0 ? '♣' : (x + off * 1 + y) % 5 === 0 ? '♠' : '.');
        Term.put(x, y, c, dimc(d === 0 ? COL.o2 : d < 3 ? COL.o3 : COL.o4, 0.35 + 0.1 * Math.min(3, d) / 3));
      }
    }
    // estrellas
    for (let k = 0; k < 40; k++) {
      const x = Math.floor(hash2(k, 1, 7) * C), y = Math.floor(hash2(k, 2, 7) * (horizon - 6));
      if (hash2(k, Math.floor(t * 2), 3) > 0.15) Term.put(x, y, '·', COL.o5);
    }
    const logoY = Math.max(2, Math.floor(Rr / 2) - 14);
    Term.text(Math.floor(C / 2) - 8, logoY, 'L A   M I S I Ó N', COL.o2);
    drawLogo(Math.floor(C / 2), logoY + 2, C >= 110);
    const sub = 'М И С С И Я   Т О П О Л Е В';
    Term.text(Math.floor((C - sub.length) / 2), logoY + 9, sub, COL.o4);
    const tag = 'SIBERIA · OCTUBRE DE 1961 · OKB-TOPOLEV · ALTO SECRETO';
    Term.text(Math.floor((C - tag.length) / 2), logoY + 11, tag, COL.o5);

    // menú
    const my = logoY + 14, bw = 30, bx = Math.floor((C - bw) / 2);
    const has = Save.has();
    UI.button(bx, my, 'NUEVA MISIÓN', { w: bw, onClick: () => this.newGame() });
    UI.button(bx, my + 2, 'CONTINUAR', { w: bw, disabled: !has, onClick: () => this.cont() });
    UI.button(bx, my + 4, 'INSTRUCCIONES', { w: bw, onClick: () => Screens.set(Instr, Title) });
    UI.button(bx, my + 6, 'ARCHIVO DE MISIONES', { w: bw, onClick: () => Screens.set(Records) });
    const set = Main.settings;
    UI.button(bx, my + 9, `SONIDO: ${Sound.muted ? 'NO' : 'SÍ'}`, { w: 14, col: COL.o3, onClick: () => Main.toggleSound() });
    UI.button(bx + 16, my + 9, `CRT: ${set.nocrt ? 'NO' : 'SÍ'}`, { w: 14, col: COL.o3, onClick: () => Main.toggleCrt() });

    const foot = '+ / − tamaño de letra   ·   ratón y teclado   ·   la partida se guarda automáticamente';
    Term.text(Math.floor((C - foot.length) / 2), Rr - 1, foot, COL.o5);
    Term.text(1, Rr - 1, 'v1.0', COL.o6);

    // avión cruzando
    this.planeT += dt;
    if (Math.random() < 0.25) FX.parts.push({ x: Math.random() * C, y: -1, vx: -0.6, vy: 1.2 + Math.random(), life: 40, max: 40, ch: Math.random() < 0.8 ? '·' : '*', cols: ['#6b5642'], drag: 0, grav: 0, delay: 0, glow: false });
    FX.parts = FX.parts.filter(p => p.y < Rr + 1);
    UI.disabled = false;
    Modal.draw();
  },
  drawFx(ctx) {
    const C = Term.cols, Rr = Term.rows;
    const view = { ox: 0, oy: 0, camX: 0, camY: 0, w: C, h: Rr };
    const period = 14, k = (this.planeT % period) / period;
    const px = -6 + k * (C + 12), py = Math.max(2, Math.floor(Rr / 2) - 17) + Math.sin(k * 6) * 0.6;
    if (Math.random() < 0.9) FX.trail(px - 1, py, COL.o1);
    FX.draw(ctx, view);
    ctx.save();
    ctx.font = Term.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = COL.white; ctx.shadowColor = COL.o2; ctx.shadowBlur = 8;
    ctx.fillText('→', (px + 0.5) * Term.cw, (py + 0.5) * Term.ch);
    ctx.restore();
  },
  newGame() {
    if (Save.has()) {
      Modal.confirm('Ya hay una misión en curso. ¿Abandonarla y empezar otra?', () => { Save.clear(); this.start(); });
    } else this.start();
  },
  start() { G.newGame(); Screens.set(Flight); },
  cont() { if (G.load(Save.load())) Screens.set(G.st.phase === 'hangar' ? Hangar : Flight); },
  key(e) {
    if (Modal.cur) return Modal.key(e);
    if (e.key === 'Enter') { if (Save.has()) this.cont(); else this.newGame(); }
    if (e.key.toLowerCase() === 'i') Screens.set(Instr, Title);
  },
};

// ---------------------------------------------------------------- MODAL genérico (confirmaciones)
const Modal = {
  cur: null,
  confirm(text, onYes) { this.cur = { text, onYes }; },
  draw() {
    if (!this.cur) return;
    Term.layer('top');
    const w = 56, lines = Term.wrap(this.cur.text, w - 6), h = lines.length + 6;
    const x = Math.floor((Term.cols - w) / 2), y = Math.floor((Term.rows - h) / 2);
    Term.box(x, y, w, h, COL.o2, COL.panel2, 'CONFIRMAR', COL.yellow, true);
    lines.forEach((l, j) => Term.rich(x + 3, y + 2 + j, l, COL.cream, COL.panel2));
    const wasDis = UI.disabled; UI.disabled = false;
    UI.button(x + 6, y + h - 2, 'SÍ', { w: 14, col: COL.red, onClick: () => { const f = this.cur.onYes; this.cur = null; f(); } });
    UI.button(x + w - 20, y + h - 2, 'NO', { w: 14, onClick: () => { this.cur = null; } });
    UI.disabled = wasDis;
    Term.layer('base');
  },
  key(e) {
    if (e.key === 'Escape' || e.key.toLowerCase() === 'n') this.cur = null;
    else if (e.key === 'Enter' || e.key.toLowerCase() === 's') { const f = this.cur.onYes; this.cur = null; f(); }
  },
};

// ---------------------------------------------------------------- INSTRUCCIONES
const Instr = {
  page: 0,
  enter(back) { this.back = back || Title; },
  draw() {
    const C = Term.cols, Rr = Term.rows;
    Term.clear(COL.bg);
    Term.fill(0, 0, C, 1, ' ', COL.o1, COL.o6);
    Term.text(2, 0, 'LA MISIÓN TOPOLEV', COL.o2, COL.o6);
    Term.text(22, 0, '· INSTRUCCIONES · MANUAL DE VUELO DEL T-0 «ZHURAVL»', COL.o3, COL.o6);
    const mw = 24;
    Term.box(1, 2, mw, INSTR.length * 2 + 3, COL.o4, COL.panel, 'ÍNDICE');
    INSTR.forEach((p, i) => {
      const y = 4 + i * 2, sel = i === this.page;
      const hov = UI.region(2, y, mw - 2, 1, { onClick: () => { this.page = i; Sound.play('click'); } });
      const label = ` ${String(i + 1).padStart(2, '0')}  ${p[0]}`;
      Term.text(2, y, label.padEnd(mw - 2), sel ? COL.bg : hov ? COL.o2 : COL.o3, sel ? COL.o1 : hov ? COL.hi : COL.panel);
    });
    const px = mw + 3, pw = Math.min(C - px - 2, 112), ph = Rr - 5;
    const [title, lines] = INSTR[this.page];
    Term.box(px, 2, pw, ph, COL.o4, COL.panel, title, COL.yellow, true);
    let y = 4;
    for (const l of lines) {
      for (const wl of Term.wrap(l, pw - 6)) { if (y < 2 + ph - 1) Term.rich(px + 3, y, wl, COL.cream, COL.panel); y++; }
    }
    UI.button(1, Rr - 2, '◄ VOLVER', { w: 14, onClick: () => Screens.set(this.back === Flight ? Flight : Title, 'keep') });
    UI.button(px, Rr - 2, '◄ ANTERIOR', { w: 16, disabled: this.page === 0, onClick: () => this.page-- });
    UI.button(px + 18, Rr - 2, 'SIGUIENTE ►', { w: 16, disabled: this.page === INSTR.length - 1, onClick: () => this.page++ });
    Term.text(px + 38, Rr - 2, '← → páginas · ESC volver', COL.o5);
  },
  key(e) {
    if (e.key === 'Escape') Screens.set(this.back === Flight ? Flight : Title, 'keep');
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') this.page = Math.min(INSTR.length - 1, this.page + 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') this.page = Math.max(0, this.page - 1);
  },
};

// ---------------------------------------------------------------- ARCHIVO (récords)
const Records = {
  draw() {
    const C = Term.cols, Rr = Term.rows;
    Term.clear(COL.bg);
    const w = Math.min(C - 4, 100), x = Math.floor((C - w) / 2), y = 3;
    Term.box(x, y, w, 20, COL.o4, COL.panel, 'ARCHIVO DE MISIONES · EXPEDIENTES DEL OKB-TOPOLEV', COL.yellow, true);
    const recs = Save.records();
    Term.text(x + 3, y + 2, '#   PUNTOS   SECTOR  ◊    DERRIBOS  FECHA       RESULTADO', COL.o3, COL.panel);
    Term.hline(x + 2, y + 3, w - 4, COL.o5, COL.panel);
    if (!recs.length) Term.text(x + 3, y + 5, 'Ningún piloto ha regresado todavía. Ni ha caído. Sé el primero.', COL.grey, COL.panel);
    recs.slice(0, 12).forEach((r, i) => {
      const col = r.won ? COL.cyan : i === 0 ? COL.o2 : COL.cream;
      const res = r.won ? 'MISIÓN CUMPLIDA' : (r.cause || 'Perdido');
      Term.text(x + 3, y + 4 + i, `${String(i + 1).padStart(2)}  ${String(r.score).padStart(7)}   ${r.sector}/5    ${String(r.frags).padStart(3)}  ${String(r.kills).padStart(6)}    ${String(r.date).padEnd(10)}  `, col, COL.panel);
      Term.text(x + 63, y + 4 + i, res, r.won ? COL.cyan : COL.grey, COL.panel, w - 66);
    });
    UI.button(x, y + 21, '◄ VOLVER', { w: 14, onClick: () => Screens.set(Title) });
  },
  key(e) { if (e.key === 'Escape' || e.key === 'Enter') Screens.set(Title); },
};

// ---------------------------------------------------------------- PANEL DEL AVIÓN (vuelo y hangar)
const ART = [
  '                 /-----\\                 ',
  '                 |     |                 ',
  "     .-------.   |     |   .-------.     ",
  '<====|       |===|     |===|       |====>',
  "     '-------'   |     |   '-------'     ",
  '                 |     |                 ',
  '           .-----|     |-----.           ',
  "           '-----|     |-----'           ",
  '                 \\_____/                 ',
];
const ART_POS = [[9, 3], [31, 3], [20, 0], [1, 3], [39, 3], [20, 8], [19, 2], [21, 2], [19, 4], [21, 4], [18, 6], [20, 6], [22, 6]];

const Panel = {
  hoverSlot: -1,
  // mode: 'flight' | 'hangar'
  draw(x, y, w, h, mode) {
    const st = G.st, P = st.plane, S = G.calc();
    const inner = w - 2;
    const doMove = (src, dst) => {
      if (mode === 'flight') G.flightMove(src, dst);
      else { if (G.move(src, dst)) G.save(); else Sound.play('deny'); }
    };
    const hovPrev = this.hoverSlot;
    this.hoverSlot = -1;
    Term.box(x, y, w, h, COL.o4, COL.panel, 'T-0 «ЖУРАВЛЬ»', COL.o2);
    let cy = y + 1;
    // estado
    const sf = P.structure / P.maxStructure;
    Term.text(x + 2, cy, 'ESTRUCTURA', COL.o3);
    Term.bar(x + 14, cy, inner - 23, sf, sf < 0.3 ? (blink(0.6) ? COL.red : COL.dred) : sf < 0.6 ? COL.yellow : COL.o1);
    Term.text(x + w - 8, cy, `${String(Math.ceil(P.structure)).padStart(3)}/${P.maxStructure}`, COL.cream);
    cy++;
    const ff = S.fuelCap ? P.fuel / S.fuelCap : 0;
    Term.text(x + 2, cy, 'COMBUSTIBLE', COL.o3);
    Term.bar(x + 14, cy, inner - 23, ff, ff < 0.2 ? (blink(0.6) ? COL.red : COL.yellow) : COL.yellow);
    Term.text(x + w - 8, cy, `${String(Math.floor(P.fuel)).padStart(3)}/${Math.round(S.fuelCap)}`, COL.cream);
    cy++;
    if (mode === 'flight') {
      let sx = x + 2;
      sx += Term.text(sx, cy, 'VEL ', COL.o3);
      for (let k = 1; k <= Math.max(S.maxS, P.s); k++) Term.put(sx++, cy, k <= P.s ? '●' : '○', k > S.maxS ? COL.red : COL.o2);
      sx += Term.text(sx, cy, ` ${P.s}/${S.maxS}`, COL.cream) + 2;
      sx += Term.text(sx, cy, 'RUMBO ', COL.o3);
      sx += Term.text(sx, cy, `${ARROWS[P.h]} ${DIRN[P.h]}`, COL.white) + 2;
      sx += Term.text(sx, cy, 'ALT ', COL.o3);
      const altS = P.alt ? '▲ ALTA' : '▼ BAJA';
      Term.text(sx, cy, altS + (st.pendingAlt ? (blink(0.5) ? ' ⇅' : '  ') : ''), P.alt ? COL.white : COL.o2);
      cy++;
    }
    Term.rich(x + 2, cy, `{m}MASA{/} ${S.mass}  {m}EMPUJE{/} ${S.thrust.toFixed(1)}  {m}VMÁX{/} ${S.maxS}  {m}GIRO{/} ±${S.man * 45}°`, COL.cream);
    cy++;
    if (mode === 'hangar') { Term.rich(x + 2, cy, `{m}CONSUMO{/} ${G.fuelUse(S, Math.max(1, S.maxS - 1), 1).toFixed(2)}/t  {m}VISIÓN{/} ${12 + S.vision}  {m}INTERF.{/} ${S.ecm}`, COL.cream); cy++; }

    // esquema
    const artOn = h >= 38;
    if (artOn) {
      Term.hline(x + 1, cy, inner, COL.o5); cy++;
      const ax = x + Math.floor((w - ART[0].length) / 2);
      ART.forEach((l, j) => Term.text(ax, cy + j, l, COL.o5));
      ART_POS.forEach(([px, py], i) => {
        const m = P.slots[i];
        const g = m ? CAT[m.cat].g : '·';
        const hl = hovPrev === i;
        const fg = m ? hpColor(m) : COL.dgrey;
        const dropOk = UI.dropHover(ax + px, cy + py, 1, 1, p => G.canMove(p, { to: 'slot', i }));
        Term.put(ax + px, cy + py, g, hl || dropOk ? COL.bg : fg, hl || dropOk ? (dropOk ? COL.yellow : fg) : COL.panel);
        const hov = UI.region(ax + px, cy + py, 1, 1, {
          drag: m ? { payload: { from: 'slot', i }, label: modName(m), col: TIERS[m.tier].c } : null,
          drop: { accept: p => G.canMove(p, { to: 'slot', i }), onDrop: p => doMove(p, { to: 'slot', i }) },
        });
        if (hov) { this.hoverSlot = i; if (m) UI.tip = modTip(m, i); else UI.tip = { lines: [`Ranura vacía: ${CAT[SLOTS[i].cat].n}`], title: SLOTS[i].n }; }
      });
      cy += ART.length;
    }

    // módulos
    Term.put(x, cy, '├', COL.o4); Term.hline(x + 1, cy, inner, COL.o4); Term.put(x + w - 1, cy, '┤', COL.o4);
    Term.text(x + 2, cy, ' MÓDULOS ', COL.o2);
    cy++;
    for (let i = 0; i < SLOTS.length; i++) {
      const m = P.slots[i], ry = cy + i;
      const dst = { to: 'slot', i };
      const dropOk = UI.dropHover(x + 1, ry, inner, 1, p => G.canMove(p, dst));
      const hov = UI.region(x + 1, ry, inner, 1, {
        drag: m ? { payload: { from: 'slot', i }, label: modName(m), col: TIERS[m.tier].c } : null,
        drop: { accept: p => G.canMove(p, dst), onDrop: p => doMove(p, dst) },
      });
      if (hov) this.hoverSlot = i;
      const hl = hov || hovPrev === i;
      const bg = dropOk ? COL.hi2 : hl ? COL.hi : COL.panel;
      Term.fill(x + 1, ry, inner, 1, ' ', COL.o1, bg);
      Term.put(x + 2, ry, CAT[SLOTS[i].cat].g, m ? hpColor(m) : COL.dgrey, bg);
      if (m) {
        let name = modName(m);
        if (m.cat === 'arma') name += m.maxAmmo ? ` ·${m.ammo}` : '';
        if (m.cat === 'arma' && m.arc !== 'T') name += i === 5 ? ' ◄' : '';
        Term.text(x + 4, ry, name, TIERS[m.tier].c, bg, inner - 15);
        Term.bar(x + w - 12, ry, 6, m.hp / m.maxHp, hpColor(m), COL.o6, bg);
        Term.text(x + w - 5, ry, String(Math.ceil(m.hp)).padStart(3), COL.cream, bg);
        if (hov) UI.tip = modTip(m, i);
      } else {
        Term.text(x + 4, ry, `· ${SLOTS[i].n.toLowerCase()} vacío`, COL.dgrey, bg);
        if (hov && !UI.drag) UI.tip = { lines: [`Arrastra aquí un módulo de tipo ${CAT[SLOTS[i].cat].n.toUpperCase()}.`], title: SLOTS[i].n };
      }
    }
    cy += SLOTS.length;

    // bodega
    const used = P.cargo.filter(Boolean).length;
    Term.put(x, cy, '├', COL.o4); Term.hline(x + 1, cy, inner, COL.o4); Term.put(x + w - 1, cy, '┤', COL.o4);
    Term.text(x + 2, cy, ` BODEGA ${used}/${CARGO_SIZE} `, COL.o2);
    cy++;
    for (let i = 0; i < CARGO_SIZE; i++) {
      const m = P.cargo[i], ry = cy + i;
      const dst = { to: 'cargo', i };
      const dropOk = UI.dropHover(x + 1, ry, inner, 1, p => G.canMove(p, dst));
      const hov = UI.region(x + 1, ry, inner, 1, {
        drag: m ? { payload: { from: 'cargo', i }, label: modName(m), col: TIERS[m.tier].c } : null,
        drop: { accept: p => G.canMove(p, dst), onDrop: p => doMove(p, dst) },
        onRight: m ? () => { const a = G.autoEquip(i); if (a) doMove({ from: 'cargo', i }, a.dst); } : null,
      });
      const bg = dropOk ? COL.hi2 : hov ? COL.hi : COL.panel;
      Term.fill(x + 1, ry, inner, 1, ' ', COL.o1, bg);
      Term.text(x + 2, ry, String(i + 1), COL.o5, bg);
      if (m) {
        Term.put(x + 4, ry, CAT[m.cat].g, COL.o3, bg);
        Term.text(x + 6, ry, modName(m), TIERS[m.tier].c, bg, inner - 17);
        Term.bar(x + w - 12, ry, 6, m.hp / m.maxHp, hpColor(m), COL.o6, bg);
        Term.text(x + w - 5, ry, String(m.mass).padStart(3), COL.grey, bg);
        if (hov) { const tp = modTip(m); tp.lines.push('{g}Arrastra a una ranura o clic derecho para equipar.{/}'); UI.tip = tp; }
      } else Term.text(x + 4, ry, '· libre', COL.o6, bg);
    }
    cy += CARGO_SIZE;
    return cy;
  },
};

// ---------------------------------------------------------------- VUELO
const Flight = {
  camX: 0, camY: 0, showMap: false, pause: false, hoverOpt: null, briefT0: 0, endT: 0,
  enter(arg) {
    if (arg !== 'keep') { this.snapCam = true; this.pause = false; this.showMap = false; }
    this.briefT0 = now();
    this.endT = 0;
  },
  layout() {
    const C = Term.cols, Rr = Term.rows;
    const sideW = 46, logH = Rr >= 44 ? 10 : 8;
    return {
      map: { x: 0, y: 1, w: C - sideW, h: Rr - 1 - logH },
      side: { x: C - sideW, y: 1, w: sideW, h: Rr - 1 },
      log: { x: 0, y: Rr - logH, w: C - sideW, h: logH },
    };
  },
  draw(dt) {
    const st = G.st;
    if (!st) { Screens.set(Title); return; }
    if (st.phase === 'hangar') { Screens.set(Hangar); return; }
    if ((st.phase === 'dead' || st.phase === 'won')) {
      if (!this.endT) this.endT = now();
      if (now() - this.endT > 2.2) { Screens.set(End); return; }
    }
    const L = this.L = this.layout();
    const P = st.plane, S = G.calc();
    Term.clear(COL.bg);
    const modal = this.pause || this.showMap || st.phase === 'briefing' || Modal.cur;
    UI.disabled = !!modal || st.phase === 'dead' || st.phase === 'won';

    // cámara
    const tx = P.x - L.map.w / 2 + DX[P.h] * L.map.w * 0.12, ty = P.y - L.map.h / 2 + DY[P.h] * L.map.h * 0.12;
    const cxT = st.map.w <= L.map.w ? -(L.map.w - st.map.w) / 2 : clamp(tx, -2, st.map.w - L.map.w + 2);
    const cyT = st.map.h <= L.map.h ? -(L.map.h - st.map.h) / 2 : clamp(ty, -1, st.map.h - L.map.h + 1);
    if (this.snapCam) { this.camX = cxT; this.camY = cyT; this.snapCam = false; }
    const k = 1 - Math.exp(-dt * 5);
    this.camX += (cxT - this.camX) * k; this.camY += (cyT - this.camY) * k;
    this.icx = Math.round(this.camX); this.icy = Math.round(this.camY);

    // posiciones interpoladas
    const kk = 1 - Math.exp(-dt * 9);
    P.dx = P.dx == null ? P.x : P.dx + (P.x - P.dx) * kk;
    P.dy = P.dy == null ? P.y : P.dy + (P.y - P.dy) * kk;
    for (const e of st.enemies) { e.dx = e.dx == null ? e.x : e.dx + (e.x - e.dx) * kk; e.dy = e.dy == null ? e.y : e.dy + (e.y - e.dy) * kk; }

    this.drawTopBar(S);
    this.drawMap(L, S);
    this.drawLog(L, S);
    UI.disabled = !!modal || st.phase === 'dead' || st.phase === 'won';
    const end = Panel.draw(L.side.x, L.side.y, L.side.w, L.side.h, 'flight');
    this.drawSideButtons(L, end, S);
    UI.disabled = false;

    // ambiente
    if (Math.random() < 0.5) FX.parts.push({ x: this.icx + Math.random() * L.map.w, y: this.icy - 1, vx: -0.4, vy: 1 + Math.random() * 0.8, life: 30, max: 30, ch: '·', cols: ['#4a3b2e'], drag: 0, grav: 0, delay: 0, glow: false, snow: true });
    FX.parts = FX.parts.filter(p => !p.snow || p.y < this.icy + L.map.h + 1);
    if (st.phase === 'flight' && Math.random() < dt * (3 + P.s * 5)) FX.trail(P.dx - DX[P.h] * 0.6, P.dy - DY[P.h] * 0.6, P.alt ? COL.o1 : COL.o3);

    if (st.phase === 'briefing') this.drawBriefing();
    if (this.showMap) this.drawSectorMap(S);
    if (this.pause) this.drawPause();
    Modal.draw();
  },

  drawTopBar(S) {
    const st = G.st, C = Term.cols;
    Term.fill(0, 0, C, 1, ' ', COL.o1, COL.o6);
    let x = 1;
    x += Term.text(x, 0, 'LA MISIÓN TOPOLEV', COL.o2, COL.o6) + 1;
    Term.put(x, 0, '║', COL.o4, COL.o6); x += 2;
    x += Term.text(x, 0, `SECTOR ${st.sector + 1}/5 · ${SECTORS[st.sector].name}`, COL.cream, COL.o6) + 1;
    Term.put(x, 0, '║', COL.o4, COL.o6); x += 2;
    x += Term.text(x, 0, `TURNO ${st.turn}`, COL.o3, COL.o6) + 1;
    Term.put(x, 0, '║', COL.o4, COL.o6); x += 2;
    x += Term.text(x, 0, `◊ ${st.frags}`, COL.cyan, COL.o6) + 2;
    x += Term.text(x, 0, `¤ ${st.scrap}`, COL.o2, COL.o6) + 2;
    if (st.nucleo) x += Term.text(x, 0, blink(1) ? '◉ NÚCLEO' : '◉ núcleo', COL.cyan, COL.o6) + 2;
    Term.put(x, 0, '║', COL.o4, COL.o6); x += 2;
    x += Term.text(x, 0, 'ALERTA ', st.alert >= 50 ? COL.red : COL.o3, COL.o6);
    const ac = st.alert >= 75 ? (blink(0.5) ? COL.red : COL.dred) : st.alert >= 50 ? COL.red : st.alert >= 25 ? COL.o1 : COL.o3;
    Term.bar(x, 0, 12, st.alert / 100, ac, COL.o5, COL.o6); x += 13;
    x += Term.text(x, 0, `${Math.round(st.alert)}%`, ac, COL.o6) + 2;
    x += Term.text(x, 0, `PUNTOS ${st.score}`, COL.o4, COL.o6);
    const menuW = 10;
    if (C - menuW - 1 > x) UI.button(C - menuW - 1, 0, 'MENÚ', { w: menuW, col: COL.o2, bg: COL.o6, onClick: () => { this.pause = true; } });
  },

  drawMap(L, S) {
    const st = G.st, P = st.plane, map = st.map;
    const { x: ox, y: oy, w, h } = L.map;
    const cx = this.icx, cy = this.icy;
    const t = now();
    const opts = st.phase === 'flight' ? G.options() : [];
    const pend = st.phase === 'flight' ? G.pendingOption(opts) : null;
    // terreno
    for (let vy = 0; vy < h; vy++) for (let vx = 0; vx < w; vx++) {
      const wx = cx + vx, wy = cy + vy, sx = ox + vx, sy = oy + vy;
      if (wx < 0 || wy < 0 || wx >= map.w || wy >= map.h) { Term.put(sx, sy, ((wx + wy) & 1) ? ' ' : '·', '#120a05', COL.bg); continue; }
      const idx = wy * map.w + wx;
      if (!map.seen[idx]) { Term.put(sx, sy, (wx % 6 === 0 && wy % 3 === 0) ? '+' : ' ', '#1d1007', COL.bg); continue; }
      const vis = G.visDist(wx, wy) <= S.visR;
      const c = map.t[idx], ter = TER[c];
      let ch = c, fg = vis ? ter.c : dimc(ter.c), bg = ter.bg ? (vis ? ter.bg : COL.bg) : COL.bg;
      if (ter.anom && vis) { fg = blink(0.8) && hash2(wx, wy, Math.floor(t * 3)) > 0.5 ? COL.white : COL.purple; }
      if (vis && ter.water && hash2(wx, wy, Math.floor(t)) > 0.93) fg = COL.cream;
      const it = map.items[idx];
      if (it) {
        const d = ITEMS[it.type];
        ch = d.g; fg = vis ? d.c : dimc(d.c, 0.6);
        if ((it.type === 'frag' || it.type === 'nucleo') && blink(1.2)) fg = it.type === 'nucleo' ? COL.white : COL.cyan;
      }
      const gr = map.ground[idx];
      if (gr) { ch = GROUND[gr.type].g; fg = vis ? GROUND[gr.type].c : dimc(COL.red, 0.5); }
      if (vis && !it && !gr) {
        const sl = G.stormLevel(wx, wy);
        if (sl) { ch = sl === 2 ? '▒' : '░'; fg = sl === 2 ? COL.storm : dimc(COL.storm, 0.7); }
      }
      if (map.exit.includes(idx)) { fg = blink(1) ? COL.yellow : '#ffd08a'; }
      Term.put(sx, sy, ch, fg, bg);
    }

    // previsualización de maniobras
    this.hoverOpt = null;
    if (st.phase === 'flight' && !this.pause && !this.showMap) {
      const toS = (wx, wy) => [ox + wx - cx, oy + wy - cy];
      const inView = (sx, sy) => sx >= ox && sy >= oy && sx < ox + w && sy < oy + h;
      let hov = null;
      for (const o of opts) {
        const [sx, sy] = toS(o.ex, o.ey);
        if (inView(sx, sy) && UI.hit(sx, sy, 1, 1)) hov = o;
      }
      this.hoverOpt = hov;
      const order = opts.slice().sort((a, b) => (a === pend || a === hov) - (b === pend || b === hov));
      for (const o of order) {
        const isP = o === pend, isH = o === hov;
        const strong = isP || isH;
        o.path.forEach(([px, py], j) => {
          const [sx, sy] = toS(px, py);
          if (!inView(sx, sy)) return;
          if (j < o.path.length - 1) { if (strong) Term.put(sx, sy, '·', isH ? COL.white : COL.o2); }
        });
        const [sx, sy] = toS(o.ex, o.ey);
        if (!inView(sx, sy)) continue;
        const bad = o.path.some(([px, py]) => P.alt === 0 && px >= 0 && py >= 0 && px < map.w && py < map.h && TER[map.t[py * map.w + px]].block && map.seen[py * map.w + px]);
        const fg = isH ? COL.bg : isP ? COL.white : bad ? COL.red : COL.o3;
        const bg = isH ? COL.o2 : isP ? COL.hi2 : COL.hi;
        Term.put(sx, sy, ARROWS[o.nh], fg, bg);
        UI.region(sx, sy, 1, 1, { onClick: () => G.doTurn(o) });
      }
      if (hov) UI.tip = this.optTip(hov, S, P);
    }

    // regiones e info de enemigos/terreno
    if (!UI.disabled && UI.hit(ox, oy, w, h) && !this.hoverOpt && !UI.drag) {
      const wx = UI.m.cx - ox + cx, wy = UI.m.cy - oy + cy;
      Term.setBg(UI.m.cx, UI.m.cy, COL.hi2);
      const onEnemy = st.enemies.some(en => en.x === wx && en.y === wy && G.enemyVisible(en, S));
      if (onEnemy || now() - (UI.m.t || 0) > 0.35) {
        const tip = this.cellTip(wx, wy, S);
        if (tip) UI.tip = tip;
      }
    }
    for (const e of st.enemies) {
      if (!G.enemyVisible(e, S)) continue;
      const sx = ox + e.x - cx, sy = oy + e.y - cy;
      UI.region(sx, sy, 1, 1, { onClick: () => { st.targetId = e.id; Sound.play('click'); } });
    }
    for (const gg of G.groundList()) {
      if (!map.seen[gg.idx]) continue;
      UI.region(ox + gg.x - cx, oy + gg.y - cy, 1, 1, { onClick: () => { st.targetId = gg.id; Sound.play('click'); } });
    }

    // indicador de destino (pista o Núcleo)
    const goal = (SECTORS[st.sector].nucleo && !st.nucleo && map.nuc) ? { x: map.nuc[0], y: map.nuc[1], n: 'NÚCLEO', c: COL.cyan } : { x: map.exitPos.x, y: map.exitPos.y, n: 'PISTA', c: COL.yellow };
    const gsx = ox + goal.x - cx, gsy = oy + goal.y - cy;
    if (gsx < ox || gsy < oy || gsx >= ox + w || gsy >= oy + h) {
      const ccx = ox + w / 2, ccy = oy + h / 2;
      const dx = gsx - ccx, dy = gsy - ccy;
      const sc = Math.min((w / 2 - 2) / Math.abs(dx || 1e-6), (h / 2 - 1) / Math.abs(dy || 1e-6));
      const ix = Math.round(ccx + dx * sc), iy = Math.round(ccy + dy * sc);
      const a8 = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 2) % 8 + 8) % 8;
      const dist = cheb(P.x, P.y, goal.x, goal.y);
      const label = `${ARROWS[a8]} ${goal.n} ${dist}`;
      const lx = clamp(ix - (dx > 0 ? label.length - 1 : 0), ox, ox + w - label.length);
      Term.text(lx, clamp(iy, oy, oy + h - 1), label, blink(1.4) ? goal.c : dimc(goal.c, 0.7), COL.bg);
    }
    // leyenda de altitud en la esquina
    const altTxt = P.alt ? ' ▲ ALTA ' : ' ▼ BAJA ';
    Term.text(ox + 1, oy, altTxt, COL.bg, P.alt ? COL.cream : COL.o2);
    if (st.pendingAlt) Term.text(ox + 9, oy, blink(0.5) ? (P.alt ? ' ⇩ DESCENSO PROGRAMADO ' : ' ⇧ ASCENSO PROGRAMADO ') : '', COL.yellow, COL.bg);
    if (st.fireMode === 'hold') Term.text(ox + 1, oy + 1, ' FUEGO RETENIDO ', COL.bg, COL.yellow);
  },

  optTip(o, S, P) {
    const st = G.st;
    const L = [];
    const turnTxt = o.turn === 0 ? 'mantener rumbo' : `girar ${Math.abs(o.turn) * 45}° a la ${o.turn < 0 ? 'izquierda' : 'derecha'}`;
    const thrTxt = o.glide ? 'planeo (sin empuje)' : o.ns > P.s ? 'acelerar' : o.ns < P.s ? (Math.abs(o.turn) >= 2 && o.thr >= 0 ? 'viraje cerrado (−1)' : 'desacelerar') : 'velocidad constante';
    L.push(`${turnTxt} · ${thrTxt}`);
    L.push(`Rumbo {w}${ARROWS[o.nh]} ${DIRN[o.nh]}{/}   Velocidad {w}${o.ns}{/}`);
    const alt = st.pendingAlt ? 1 - P.alt : P.alt;
    L.push(`Consumo estimado {y}${G.fuelUse(S, o.ns, alt).toFixed(1)}{/}`);
    const map = st.map;
    const crash = alt === 0 && o.path.some(([px, py]) => map.seen[py * map.w + px] && TER[map.t[py * map.w + px]].block);
    if (crash) L.push('{r}¡La trayectoria cruza montañas en altitud baja!{/}');
    const anom = o.path.some(([px, py]) => map.seen[py * map.w + px] && TER[map.t[py * map.w + px]].anom);
    if (anom) L.push('{p}La trayectoria atraviesa una anomalía.{/}');
    const pick = alt === 0 && o.path.some(([px, py]) => map.items[py * map.w + px]);
    if (pick) L.push(o.ns <= S.grabLim ? '{c}Recogerás objetos en la trayectoria.{/}' : `{y}Objetos en la trayectoria: frena a ${S.grabLim} para recoger restos/depósitos.{/}`);
    if (alt === 0 && o.ns <= 2 && o.path.some(([px, py]) => map.exit.includes(py * map.w + px))) L.push('{y}Aterrizaje en la pista.{/}');
    L.push('{g}Clic para ejecutar{/}');
    return { title: 'MANIOBRA', lines: L };
  },

  cellTip(wx, wy, S) {
    const st = G.st, map = st.map, P = st.plane;
    if (wx < 0 || wy < 0 || wx >= map.w || wy >= map.h) return null;
    const idx = wy * map.w + wx;
    const e = st.enemies.find(en => en.x === wx && en.y === wy && G.enemyVisible(en, S));
    if (e) {
      const def = ENEMY[e.type], L = [];
      L.push(def.d);
      L.push(`Integridad {w}${e.hp}/${e.maxHp}{/}   Velocidad {w}${e.s}{/}   Rumbo {w}${ARROWS[e.h]}{/}`);
      L.push(`Distancia {w}${cheb(P.x, P.y, e.x, e.y)}{/}   ${e.aware > 0 || st.alert >= 50 ? '{r}Te ha localizado{/}' : '{g}Patrullando{/}'}`);
      let best = null;
      P.slots.forEach((w, i) => {
        if (!w || w.cat !== 'arma' || w.ground) return;
        const c = G.hitChance(w, e, S, i);
        const ok = cheb(P.x, P.y, e.x, e.y) <= w.range && G.arcOk(P.x, P.y, P.h, e.x, e.y, G.weaponArc(w, i));
        if (!best || c > best.c) best = { c, w, ok };
      });
      if (best) L.push(`Impacto (${best.w.base.toLowerCase()}): {w}${best.c}%{/} ${best.ok ? '{n}en arco{/}' : '{g}fuera de arco/alcance{/}'}`);
      L.push(st.targetId === e.id ? '{y}OBJETIVO MARCADO{/}' : '{g}Clic: marcar como objetivo{/}');
      return { title: def.n, lines: L, col: def.c };
    }
    if (!map.seen[idx]) return { lines: ['{g}Territorio sin reconocer.{/}'] };
    const L = [];
    const ter = TER[map.t[idx]];
    let title = ter.n;
    if (ter.block) L.push('{r}Peligrosa en altitud baja.{/}');
    if (ter.forest) L.push('En altitud baja te oculta del radar y de los cazas.');
    if (ter.anom) L.push('{p}Distorsiona el espacio: te teletransporta.{/}');
    if (map.exit.includes(idx)) { title = SECTORS[st.sector].field; L.push('Pista de salida. Aterriza en altitud BAJA a velocidad ≤ 2.'); }
    const it = map.items[idx];
    if (it) { title = ITEMS[it.type].n; L.push(...Term.wrap(ITEMS[it.type].d, 46)); }
    const gr = map.ground[idx];
    if (gr) {
      const gd = GROUND[gr.type];
      title = gd.n;
      L.push(...Term.wrap(gd.d, 46));
      L.push(`Integridad {w}${gr.hp}/${gr.maxHp}{/}   Distancia {w}${cheb(P.x, P.y, wx, wy)}{/}`);
      L.push(st.targetId === 'g' + idx ? '{y}OBJETIVO MARCADO{/}' : '{g}Clic: marcar como objetivo (bombas / vuelo bajo){/}');
      return { title, lines: L, col: COL.red };
    }
    if (G.visDist(wx, wy) <= S.visR && G.inStorm(wx, wy)) L.push('{s}Tormenta: oculta del radar; granizo y turbulencia.{/}');
    if (!G.isVisible(wx, wy, S)) L.push('{g}Fuera de tu visión (recuerdo).{/}');
    if (wx === P.x && wy === P.y) { title = 'T-0 «Zhuravl»'; L.unshift('Tu avión. La flecha indica el rumbo.'); }
    return { title, lines: L.length ? L : ['{g}Sin novedad.{/}'] };
  },

  drawLog(L, S) {
    const st = G.st, P = st.plane;
    const { x, y, w, h } = L.log;
    Term.box(x, y, w, h, COL.o4, COL.panel, 'DIARIO DE VUELO', COL.o2);
    // línea de maniobra programada
    if (st.phase === 'flight') {
      const o = G.pendingOption();
      const turnTxt = o.turn === 0 ? 'rumbo fijo' : `${o.turn < 0 ? '◄' : '►'} ${Math.abs(o.turn) * 45}°`;
      const thrTxt = o.glide ? 'planeo' : o.thr > 0 ? '▲ acelerar' : o.thr < 0 ? '▼ frenar' : '= velocidad';
      Term.rich(x + 2, y + 1, `{m}PROGRAMADO:{/} {w}${turnTxt}{/} · {w}${thrTxt}{/} → {w}${ARROWS[o.nh]} vel ${o.ns}{/}   {g}[ESPACIO] ejecutar{/}`, COL.cream, COL.panel, w - 4);
    }
    const lines = st.log.slice(-(h - 4));
    lines.forEach((m, j) => {
      const age = st.turn - m.turn;
      const col = age > 3 ? dimc(m.col, 0.6) : m.col;
      Term.text(x + 2, y + 2 + j + (h - 4 - lines.length), (age === 0 ? '› ' : '  ') + m.text, col, COL.panel, w - 4);
    });
    Term.rich(x + 2, y + h - 1, ' {w}←→{/} girar {w}↑↓{/} acelerador {w}ESPACIO{/} ejecutar {w}X{/} altitud {w}TAB{/} objetivo {w}F{/} fuego {w}M{/} mapa {w}ESC{/} menú ', COL.o3, COL.panel, w - 4);
  },

  drawSideButtons(L, cy, S) {
    const st = G.st, x = L.side.x, w = L.side.w;
    Term.put(x, cy, '├', COL.o4); Term.hline(x + 1, cy, w - 2, COL.o4); Term.put(x + w - 1, cy, '┤', COL.o4);
    cy++;
    const ejOk = UI.dropHover(x + 2, cy, 12, 1, p => p.from !== 'shop');
    if (UI.drag) {
      Term.text(x + 2, cy, ejOk ? '►EYECTAR◄  ' : '[ EYECTAR ]', ejOk ? COL.bg : COL.red, ejOk ? COL.red : COL.panel);
    } else Term.text(x + 2, cy, '[ EYECTAR ]', COL.dred);
    UI.region(x + 2, cy, 12, 1, { drop: { accept: p => p.from !== 'shop', onDrop: p => G.flightMove(p, { to: 'eject' }) } });
    if (UI.hit(x + 2, cy, 12, 1) && !UI.drag) UI.tip = { lines: ['Arrastra aquí un módulo para soltarlo en vuelo.', 'No cuesta turno. El módulo se pierde.'], title: 'EYECTAR', col: COL.red };
    UI.button(x + 15, cy, `FUEGO:${st.fireMode === 'auto' ? 'AUTO' : 'RET.'}`, { w: 14, col: st.fireMode === 'auto' ? COL.o1 : COL.yellow, onClick: () => this.toggleFire(), tip: { lines: ['F: alterna disparo automático / retener fuego.', 'Disparar eleva la alerta.'] } });
    UI.button(x + 30, cy, 'MAPA', { w: 14, onClick: () => { this.showMap = true; } });
    cy++;
    const tgt = st.targetId && (st.enemies.find(e => e.id === st.targetId) || G.groundById(st.targetId));
    if (cy < L.side.y + L.side.h - 1) {
      if (tgt) {
        const n = tgt.type ? ENEMY[tgt.type].n : GROUND[tgt.g.type].n;
        const hp = tgt.type ? `${tgt.hp}/${tgt.maxHp}` : `${tgt.g.hp}/${tgt.g.maxHp}`;
        Term.rich(x + 2, cy, `{m}OBJETIVO:{/} {r}${n}{/} ${hp}`, COL.cream, COL.panel, w - 4);
      } else Term.rich(x + 2, cy, '{m}OBJETIVO:{/} {g}ninguno (TAB / clic){/}', COL.cream, COL.panel, w - 4);
      cy++;
    }
    const rest = L.side.y + L.side.h - 1 - cy;
    const tips = [
      '{g}Arrastra módulos entre ranuras y bodega.{/}',
      '{g}Reconfigurar en vuelo cuesta 1 turno.{/}',
      '{g}Clic en una flecha del mapa: ejecutarla.{/}',
    ];
    for (let k = 0; k < Math.min(rest, tips.length); k++) Term.rich(x + 2, cy + k, tips[k], COL.grey, COL.panel, w - 4);
  },

  toggleFire() { const st = G.st; st.fireMode = st.fireMode === 'auto' ? 'hold' : 'auto'; G.log(st.fireMode === 'auto' ? 'Fuego automático.' : 'Fuego retenido.', COL.yellow); },

  drawFx(ctx) {
    const st = G.st;
    if (!st || !this.L) return;
    const L = this.L, P = st.plane, S = G.calc();
    const view = { ox: L.map.x, oy: L.map.y, camX: this.icx, camY: this.icy, w: L.map.w, h: L.map.h };
    const cw = Term.cw, chh = Term.ch;
    const toPx = (wx, wy) => [(view.ox + wx - view.camX) * cw, (view.oy + wy - view.camY) * chh];
    ctx.save();
    ctx.beginPath(); ctx.rect(view.ox * cw, view.oy * chh, view.w * cw, view.h * chh); ctx.clip();
    ctx.font = Term.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const t = now();
    // fragmentos: destellos
    if (Math.random() < 0.3) {
      for (const k in st.map.items) {
        const it = st.map.items[k];
        if (it.type !== 'frag' && it.type !== 'nucleo') continue;
        const x = k % st.map.w, y = (k / st.map.w) | 0;
        if (G.visDist(x, y) <= S.visR && Math.random() < 0.15) FX.sparkle(x, y, COL.cyan);
      }
    }
    // enemigos
    for (const e of st.enemies) {
      if (!G.enemyVisible(e, S)) continue;
      const def = ENEMY[e.type];
      const [px, py] = toPx(e.dx, e.dy);
      const inVis = G.visDist(e.x, e.y) <= S.visR;
      ctx.fillStyle = COL.bg; ctx.fillRect(px, py, cw, chh);
      ctx.fillStyle = inVis ? def.c : dimc(def.c, 0.6);
      ctx.shadowColor = def.c; ctx.shadowBlur = inVis ? 8 : 0;
      ctx.fillText(inVis ? def.g : '?', px + cw / 2, py + chh / 2 + 1);
      ctx.shadowBlur = 0;
      // indicador de rumbo
      ctx.globalAlpha = 0.6; ctx.fillStyle = def.c;
      ctx.fillRect(px + cw / 2 + DX[e.h] * cw * 0.45 - 1, py + chh / 2 + DY[e.h] * chh * 0.42 - 1, 2, 2);
      ctx.globalAlpha = 1;
      // barra de vida
      if (e.hp < e.maxHp) { ctx.fillStyle = COL.dred; ctx.fillRect(px, py + chh - 2, cw, 2); ctx.fillStyle = COL.red; ctx.fillRect(px, py + chh - 2, cw * e.hp / e.maxHp, 2); }
    }
    // objetivo marcado
    const tgt = st.targetId && (st.enemies.find(e => e.id === st.targetId) || G.groundById(st.targetId));
    if (tgt) {
      const [px, py] = toPx(tgt.dx != null ? tgt.dx : tgt.x, tgt.dy != null ? tgt.dy : tgt.y);
      const pulse = 0.5 + 0.5 * Math.sin(t * 8);
      ctx.fillStyle = pulse > 0.5 ? COL.yellow : COL.red;
      ctx.fillText('[', px - cw * 0.5, py + chh / 2 + 1);
      ctx.fillText(']', px + cw * 1.5, py + chh / 2 + 1);
    }
    // jugador
    if (st.phase !== 'dead') {
      const [px, py] = toPx(P.dx, P.dy);
      ctx.fillStyle = P.alt ? COL.hi2 : COL.o6; ctx.fillRect(px, py, cw, chh);
      ctx.fillStyle = P.alt ? COL.white : COL.o2;
      ctx.shadowColor = COL.o1; ctx.shadowBlur = 10;
      ctx.fillText(ARROWS[P.h], px + cw / 2, py + chh / 2 + 1);
      ctx.shadowBlur = 0;
      if (!P.alt) { ctx.globalAlpha = 0.35; ctx.fillStyle = COL.o2; ctx.fillText('·', px + cw / 2 + 2, py + chh / 2 + 4); ctx.globalAlpha = 1; }
    }
    ctx.restore();
    FX.draw(ctx, view);
  },

  drawBriefing() {
    const st = G.st, def = SECTORS[st.sector];
    Term.layer('top');
    const w = Math.min(84, Term.cols - 4), x = Math.floor((Term.cols - w) / 2);
    const txt = [
      `{y}ORDEN DE MISIÓN Nº ${String(st.seed % 100000).padStart(5, '0')}-${st.sector + 1}{/}`,
      '',
      ...(st.sector === 0 ? TEXT.lore.concat(['']) : []),
      `{b}SECTOR ${st.sector + 1}/5 · ${def.name.toUpperCase()}{/}`,
      def.desc,
      '',
      `{m}Objetivo:{/} aterrizar en {y}${def.field}{/}, al este.`,
      def.nucleo ? '{m}Objetivo principal:{/} recuperar el {c}◉ Núcleo{/} del epicentro.' : `{m}Secundario:{/} recuperar {c}◊ fragmentos{/} (${def.frags} estimados en el sector).`,
      `{m}Inteligencia:{/} ${def.radars} radares Ж, ${def.aa} baterías Ш, ${def.storms} frentes de tormenta${def.anom ? ', anomalías §' : ''}.`,
    ];
    const lines = [];
    for (const l of txt) lines.push(...Term.wrap(l, w - 6));
    const h = lines.length + 6;
    const y = Math.max(1, Math.floor((Term.rows - h) / 2));
    Term.box(x, y, w, h, COL.o2, COL.panel2, 'OKB-TOPOLEV · ALTO SECRETO', COL.yellow, true);
    // efecto máquina de escribir
    let budget = Math.floor((now() - this.briefT0) * 140);
    this._briefTotal = lines.reduce((a, l) => a + Term.richLen(l), 0);
    for (let j = 0; j < lines.length; j++) {
      const len = Term.richLen(lines[j]);
      if (budget <= 0) break;
      if (budget >= len) Term.rich(x + 3, y + 2 + j, lines[j], COL.cream, COL.panel2);
      else {
        Term.rich(x + 3, y + 2 + j, lines[j], COL.cream, COL.panel2, budget);
        Term.put(x + 3 + budget, y + 2 + j, blink(0.3) ? '█' : ' ', COL.o2, COL.panel2);
      }
      budget -= len;
    }
    if (budget < 0 && Math.floor(now() * 30) !== this._lastType) { this._lastType = Math.floor(now() * 30); Sound.play('type'); }
    UI.button(x + w - 22, y + h - 2, 'DESPEGAR ►', { w: 18, col: COL.yellow, onClick: () => this.startFlight() });
    Term.text(x + 3, y + h - 2, 'ENTER: despegar', COL.o4, COL.panel2);
    Term.layer('base');
  },
  startFlight() {
    const st = G.st;
    if (st.phase !== 'briefing') return;
    if ((now() - this.briefT0) * 140 < (this._briefTotal || 0)) { this.briefT0 = now() - 1000; return; }
    st.phase = 'flight';
    G.lock = performance.now() + 200;
    G.save();
    Sound.play('land');
  },

  drawPause() {
    Term.layer('top');
    const w = 40, h = 15, x = Math.floor((Term.cols - w) / 2), y = Math.floor((Term.rows - h) / 2);
    Term.box(x, y, w, h, COL.o2, COL.panel2, 'MENÚ', COL.yellow, true);
    const bx = x + 5, bw = w - 10;
    UI.button(bx, y + 2, 'CONTINUAR', { w: bw, onClick: () => { this.pause = false; } });
    UI.button(bx, y + 4, 'INSTRUCCIONES', { w: bw, onClick: () => { this.pause = false; Screens.set(Instr, Flight); } });
    UI.button(bx, y + 6, `SONIDO: ${Sound.muted ? 'NO' : 'SÍ'}`, { w: bw, onClick: () => Main.toggleSound() });
    UI.button(bx, y + 8, 'GUARDAR Y SALIR', { w: bw, onClick: () => { G.save(); this.pause = false; Screens.set(Title); } });
    UI.button(bx, y + 10, 'ABANDONAR MISIÓN', { w: bw, col: COL.red, onClick: () => Modal.confirm('¿Abandonar la misión? El T-0 se dará por perdido y la partida se borrará.', () => { this.pause = false; G.die('Misión abandonada por el piloto.'); }) });
    Term.text(x + 3, y + h - 2, `Semilla ${G.st.seed}`, COL.o5, COL.panel2);
    Term.layer('base');
  },

  drawSectorMap(S) {
    const st = G.st, map = st.map, P = st.plane;
    Term.layer('top');
    const sx = Math.max(1, Math.ceil(map.w / (Term.cols - 6))), sy = Math.max(1, Math.ceil(map.h / (Term.rows - 6)));
    const mw = Math.ceil(map.w / sx), mh = Math.ceil(map.h / sy);
    const x = Math.floor((Term.cols - mw - 4) / 2), y = Math.floor((Term.rows - mh - 4) / 2);
    Term.fill(0, 1, Term.cols, Term.rows - 1, ' ', COL.bg, '#050302');
    Term.box(x, y, mw + 4, mh + 4, COL.o2, COL.bg, `MAPA DEL SECTOR · ${SECTORS[st.sector].name}`, COL.yellow, true);
    for (let my = 0; my < mh; my++) for (let mx = 0; mx < mw; mx++) {
      const wx = mx * sx, wy = my * sy, idx = wy * map.w + wx;
      if (!map.seen[idx]) { Term.put(x + 2 + mx, y + 2 + my, ' ', COL.bg, COL.bg); continue; }
      const c = map.t[idx];
      let ch = c, fg = dimc(TER[c].c, 0.75);
      const it = map.items[idx];
      if (it) { ch = ITEMS[it.type].g; fg = ITEMS[it.type].c; }
      if (map.ground[idx]) { ch = GROUND[map.ground[idx].type].g; fg = COL.red; }
      if (map.exit.includes(idx)) fg = COL.yellow;
      Term.put(x + 2 + mx, y + 2 + my, ch, fg, TER[c].bg || COL.bg);
    }
    Term.put(x + 2 + Math.floor(P.x / sx), y + 2 + Math.floor(P.y / sy), ARROWS[P.h], blink(0.5) ? COL.white : COL.o2, COL.hi2);
    Term.text(x + 2, y + mh + 3, ' M / ESC: cerrar ', COL.o3, COL.bg);
    UI.region(0, 0, Term.cols, Term.rows, { onClick: () => { this.showMap = false; } });
    Term.layer('base');
  },

  key(e) {
    const st = G.st;
    if (!st) return;
    if (Modal.cur) return Modal.key(e);
    const k = e.key, kl = k.toLowerCase();
    if (st.phase === 'briefing') { if (k === 'Enter' || k === ' ') this.startFlight(); if (k === 'Escape') this.pause = !this.pause; return; }
    if (this.showMap) { if (kl === 'm' || k === 'Escape') this.showMap = false; return; }
    if (this.pause) { if (k === 'Escape') this.pause = false; return; }
    if (k === 'Escape') { this.pause = true; return; }
    if (st.phase !== 'flight') return;
    const S = G.calc();
    if (k === 'ArrowLeft' || kl === 'a') { st.pTurn = Math.max(-S.man, st.pTurn - 1); Sound.play('hover'); }
    else if (k === 'ArrowRight' || kl === 'd') { st.pTurn = Math.min(S.man, st.pTurn + 1); Sound.play('hover'); }
    else if (k === 'ArrowUp' || kl === 'w') { st.pThr = Math.min(1, st.pThr + 1); Sound.play('hover'); }
    else if (k === 'ArrowDown' || kl === 's') { st.pThr = Math.max(-1, st.pThr - 1); Sound.play('hover'); }
    else if (k === ' ' || k === 'Enter') G.doTurn(G.pendingOption());
    else if (kl === 'x') { st.pendingAlt = !st.pendingAlt; Sound.play('click'); }
    else if (k === 'Tab') G.cycleTarget();
    else if (kl === 'f') this.toggleFire();
    else if (kl === 'm') this.showMap = true;
  },
};

// ---------------------------------------------------------------- HANGAR
const Hangar = {
  enter() { this.t0 = now(); },
  draw() {
    const st = G.st;
    if (!st || st.phase !== 'hangar') { Screens.set(st ? Flight : Title); return; }
    const C = Term.cols, Rr = Term.rows, P = st.plane, S = G.calc();
    Term.clear(COL.bg);
    UI.disabled = !!Modal.cur;
    // barra superior
    Term.fill(0, 0, C, 1, ' ', COL.o1, COL.o6);
    let x = 1;
    x += Term.text(x, 0, 'HANGAR', COL.yellow, COL.o6) + 1;
    Term.put(x, 0, '║', COL.o4, COL.o6); x += 2;
    x += Term.text(x, 0, st.hangar.name, COL.cream, COL.o6) + 1;
    Term.put(x, 0, '║', COL.o4, COL.o6); x += 2;
    x += Term.text(x, 0, `SECTORES COMPLETADOS ${st.sector + 1}/5`, COL.o3, COL.o6) + 2;
    x += Term.text(x, 0, `◊ ${st.frags} fragmentos`, COL.cyan, COL.o6) + 2;
    x += Term.text(x, 0, `¤ ${st.scrap} chatarra`, COL.o2, COL.o6) + 2;
    x += Term.text(x, 0, `PUNTOS ${st.score}`, COL.o4, COL.o6);

    // columna avión
    const pw = 46;
    const ph = Rr - 2;
    const end = Panel.draw(1, 1, pw, ph, 'hangar');
    if (end + 2 < ph) {
      Term.rich(3, end + 1, '{g}Arrastra y suelta los módulos.{/}', COL.grey, COL.panel, pw - 4);
      Term.rich(3, end + 2, '{g}Clic derecho en la bodega: equipar.{/}', COL.grey, COL.panel, pw - 4);
    }

    // columna almacén + servicios
    const mx = pw + 2, mw = Math.min(48, Math.floor((C - mx - 2) / 2) + 6);
    let y = 1;
    Term.box(mx, y, mw, 13, COL.o4, COL.panel, 'ALMACÉN DEL AERÓDROMO', COL.o2);
    st.hangar.shop.forEach((m, i) => {
      const ry = y + 2 + i * 2;
      if (!m) { Term.text(mx + 2, ry, '· vendido', COL.o6); return; }
      const afford = m.fragPrice ? st.frags >= m.fragPrice : st.scrap >= m.price;
      const hov = UI.region(mx + 1, ry, mw - 2, 1, {
        drag: afford ? { payload: { from: 'shop', i }, label: modName(m), col: TIERS[m.tier].c } : null,
        onClick: () => {
          const free = st.plane.cargo.indexOf(null);
          if (free >= 0 && G.move({ from: 'shop', i }, { to: 'cargo', i: free })) { G.save(); Sound.play('pick'); } else Sound.play('deny');
        },
      });
      const bg = hov ? COL.hi : COL.panel;
      Term.fill(mx + 1, ry, mw - 2, 1, ' ', COL.o1, bg);
      Term.put(mx + 2, ry, CAT[m.cat].g, COL.o3, bg);
      Term.text(mx + 4, ry, modName(m), TIERS[m.tier].c, bg, mw - 15);
      const price = m.fragPrice ? `${m.fragPrice}◊` : `${m.price}¤`;
      Term.text(mx + mw - 2 - price.length, ry, price, afford ? (m.fragPrice ? COL.cyan : COL.yellow) : COL.dgrey, bg);
      Term.text(mx + 4, ry + 1, `${TIERS[m.tier].n}${m.quirks.length ? ' · ' + QUIRKS[m.quirks[0]].n : ''}`, COL.o5, COL.panel, mw - 8);
      if (hov) { const tp = modTip(m); tp.lines.push(afford ? '{g}Clic: comprar a la bodega · Arrastrar: a ranura o bodega{/}' : '{r}No te lo puedes permitir.{/}'); UI.tip = tp; }
    });
    y += 14;
    // desguace
    const scrapOk = UI.dropHover(mx, y, mw, 3, p => p.from !== 'shop');
    Term.box(mx, y, mw, 3, scrapOk ? COL.yellow : COL.o4, scrapOk ? COL.hi2 : COL.panel, 'DESGUACE', scrapOk ? COL.yellow : COL.o2);
    Term.text(mx + 2, y + 1, UI.drag ? '► suelta aquí para convertir en chatarra' : 'Arrastra aquí un módulo: chatarra', scrapOk ? COL.yellow : COL.o4, scrapOk ? COL.hi2 : COL.panel);
    UI.region(mx, y, mw, 3, { drop: { accept: p => p.from !== 'shop', onDrop: p => { if (G.move(p, { to: 'scrap' })) { G.save(); FX.burst(mx + mw / 2, y + 1, { n: 12, chars: '¤*·', speed: 5 }); } } } });
    y += 4;
    // servicios
    Term.box(mx, y, mw, 11, COL.o4, COL.panel, 'SERVICIOS', COL.o2);
    const tw = mw - 20;
    const rc = G.repairCost();
    Term.rich(mx + 2, y + 2, `Reparar todo: {w}${rc}{/} ¤`, COL.cream, null, tw);
    Term.rich(mx + 2, y + 3, '{g}1 ¤ por cada 3 puntos{/}', COL.cream, null, tw);
    UI.button(mx + mw - 17, y + 2, 'REPARAR', { w: 15, disabled: rc === 0 || st.scrap === 0, onClick: () => { G.repairAll(); Sound.play('pick'); } });
    const fi = G.refuelInfo();
    Term.rich(mx + 2, y + 5, `Reserva gratis: {y}${Math.round(st.hangar.reserve)}{/}`, COL.cream, null, tw);
    Term.rich(mx + 2, y + 6, fi.need > 0.5 ? `{g}Faltan ${Math.ceil(fi.need)}${fi.cost ? ' · extra ' + fi.cost + ' ¤' : ' · sin coste'}{/}` : '{g}Depósitos llenos{/}', COL.cream, null, tw);
    UI.button(mx + mw - 17, y + 5, 'REPOSTAR', { w: 15, disabled: fi.need <= 0.5, onClick: () => { G.refuel(); Sound.play('pick'); } });
    const ac = G.rearmCost();
    Term.rich(mx + 2, y + 8, `Rearmar: {w}${ac}{/} ¤`, COL.cream, null, tw);
    Term.rich(mx + 2, y + 9, '{g}cohetes 2 ¤ · bombas 3 ¤{/}', COL.cream, null, tw);
    UI.button(mx + mw - 17, y + 8, 'REARMAR', { w: 15, disabled: ac === 0 || st.scrap < 2, onClick: () => { G.rearm(); Sound.play('pick'); } });
    y += 12;

    // columna informe
    const rx = mx + mw + 1, rw = C - rx - 1;
    if (rw >= 30) {
      const next = SECTORS[st.sector + 1];
      Term.box(rx, 1, rw, Rr - 5, COL.o4, COL.panel, 'INFORME', COL.o2);
      const lines = [
        `{b}Sector ${st.sector + 1} superado.{/}`,
        `Turnos de vuelo: {w}${st.totalTurns}{/}   Derribos: {w}${st.kills}{/}`,
        `Fragmentos recuperados: {c}${st.stats.frags}{/}`,
        `Instalaciones destruidas: {w}${st.stats.ground}{/}`,
        `Módulos perdidos: {w}${st.stats.modsLost}{/}`,
        '',
        `{y}PRÓXIMO SECTOR ${st.sector + 2}/5{/}`,
        `{b}${next.name}{/}`,
        next.desc,
        '',
        `{m}Destino:{/} ${next.field}`,
        `{m}Radares:{/} ${next.radars}  {m}Antiaéreos:{/} ${next.aa}  {m}Tormentas:{/} ${next.storms}`,
        '',
        `{m}Previsión de tu T-0:{/} velocidad máx. {w}${S.maxS}{/}, autonomía aprox. {w}${S.cons > 0 ? Math.floor(P.fuel / G.fuelUse(S, Math.max(1, S.maxS - 1), 1)) : '∞'}{/} turnos.`,
      ];
      let ly = 3;
      for (const l of lines) for (const wl of Term.wrap(l, rw - 4)) { if (ly < Rr - 7) Term.rich(rx + 2, ly, wl, COL.cream, COL.panel); ly++; }
      if (S.maxS === 0) Term.rich(rx + 2, Rr - 7, '{r}¡Sin empuje! Monta un motor o reposta.{/}', COL.cream, COL.panel, rw - 4);
      UI.button(rx + Math.floor((rw - 24) / 2), Rr - 3, 'DESPEGAR ►', { w: 24, col: COL.yellow, onClick: () => this.takeOff() });
    } else {
      UI.button(mx, Rr - 3, 'DESPEGAR ►', { w: 24, col: COL.yellow, onClick: () => this.takeOff() });
    }
    UI.button(1, Rr - 1, 'MENÚ', { w: 10, col: COL.o3, onClick: () => Modal.confirm('¿Guardar y volver al menú principal?', () => { G.save(); Screens.set(Title); }) });
    UI.disabled = false;
    Modal.draw();
  },
  takeOff() {
    const S = G.calc();
    const go = () => { G.takeOff(); Screens.set(Flight); };
    if (S.maxS === 0) Modal.confirm('El T-0 no tiene empuje (sin motores o sin combustible). Despegar ahora es un suicidio. ¿Seguro?', go);
    else go();
  },
  drawFx(ctx) {
    if (Math.random() < 0.2) FX.parts.push({ x: Math.random() * Term.cols, y: -1, vx: -0.3, vy: 1 + Math.random(), life: 60, max: 60, ch: '·', cols: ['#3a2c20'], drag: 0, grav: 0, delay: 0, glow: false });
    FX.parts = FX.parts.filter(p => p.y < Term.rows + 1);
    FX.draw(ctx, { ox: 0, oy: 0, camX: 0, camY: 0, w: Term.cols, h: Term.rows });
  },
  key(e) {
    if (Modal.cur) return Modal.key(e);
    if (e.key === 'Escape') Modal.confirm('¿Guardar y volver al menú principal?', () => { G.save(); Screens.set(Title); });
  },
};

// ---------------------------------------------------------------- FINAL
const End = {
  enter() { this.t0 = now(); this.won = G.st && G.st.phase === 'won'; },
  draw() {
    const st = G.st, C = Term.cols, Rr = Term.rows;
    Term.clear(COL.bg);
    if (!st) { Screens.set(Title); return; }
    const w = Math.min(80, C - 4), x = Math.floor((C - w) / 2), y = Math.max(1, Math.floor(Rr / 2) - 13);
    const col = this.won ? COL.cyan : COL.red;
    const big = this.won ? 'MISIÓN CUMPLIDA' : 'T-0 PERDIDO';
    Term.box(x, y, w, 24, col, COL.panel, this.won ? 'INFORME FINAL · OKB-TOPOLEV' : 'INFORME DE PÉRDIDA · OKB-TOPOLEV', col, true);
    const bigS = big.split('').join(' ');
    Term.text(x + Math.floor((w - bigS.length) / 2), y + 2, bigS, blink(1.2) ? col : dimc(col, 0.7), COL.panel);
    const lines = Term.wrap(st.cause, w - 8);
    lines.forEach((l, j) => Term.text(x + 4, y + 4 + j, l, COL.cream, COL.panel));
    const rows = [
      ['Sector alcanzado', `${st.sector + 1}/5 · ${SECTORS[st.sector].name}`],
      ['Turnos de vuelo', st.totalTurns],
      ['Fragmentos recuperados', st.stats.frags],
      ['Núcleo', st.nucleo ? 'RECUPERADO' : 'no'],
      ['Derribos', st.kills],
      ['Instalaciones destruidas', st.stats.ground],
      ['Disparos / impactos', `${st.stats.shots} / ${st.stats.hits}`],
      ['Daño recibido', st.stats.dmgTaken],
      ['Módulos perdidos', st.stats.modsLost],
    ];
    rows.forEach(([k, v], j) => {
      Term.text(x + 6, y + 7 + j, k.padEnd(28, '.'), COL.o4, COL.panel);
      Term.text(x + 35, y + 7 + j, String(v), COL.cream, COL.panel);
    });
    Term.text(x + 6, y + 17, 'PUNTUACIÓN'.padEnd(28, '.'), COL.o2, COL.panel);
    Term.text(x + 35, y + 17, String(st.score), COL.yellow, COL.panel);
    if (st.recordPos != null && st.recordPos >= 0 && st.recordPos < 12) Term.text(x + 6, y + 19, `Registrado en el archivo en la posición ${st.recordPos + 1}.`, COL.o3, COL.panel);
    UI.button(x + 6, y + 21, 'NUEVA MISIÓN', { w: 22, onClick: () => { G.newGame(); Screens.set(Flight); } });
    UI.button(x + w - 28, y + 21, 'MENÚ PRINCIPAL', { w: 22, onClick: () => { G.st = null; Screens.set(Title); } });
    if (Math.random() < (this.won ? 0.3 : 0.15)) {
      const px = x + Math.random() * w, py = y + Math.random() * 3;
      FX.burst(px, py, { n: 8, speed: 4, life: 1, cols: this.won ? [COL.white, COL.cyan, COL.dcyan] : [COL.o2, COL.o3, COL.o5] });
    }
  },
  drawFx(ctx) { FX.draw(ctx, { ox: 0, oy: 0, camX: 0, camY: 0, w: Term.cols, h: Term.rows }); },
  key(e) { if (e.key === 'Enter' || e.key === 'Escape') { G.st = null; Screens.set(Title); } },
};
