'use strict';
// Generación procedural: sectores (terreno, ciudades, objetos, estructuras) y módulos.

const Gen = {
  sector(R, idx) {
    const def = SECTORS[idx];
    const W = MAP_W, H = MAP_H;
    const nE = makeNoise(R.int(1, 1e9)), nM = makeNoise(R.int(1, 1e9)), nD = makeNoise(R.int(1, 1e9));
    const t = new Array(W * H).fill('.');
    const I = (x, y) => y * W + x;
    const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

    // elevación y humedad normalizadas
    const E = new Float32Array(W * H), M = new Float32Array(W * H);
    let emin = 9, emax = -9, mmin = 9, mmax = -9;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const e = nE(x / 17, y / 12, 5), m = nM(x / 11, y / 9, 4);
      E[I(x, y)] = e; M[I(x, y)] = m;
      emin = Math.min(emin, e); emax = Math.max(emax, e); mmin = Math.min(mmin, m); mmax = Math.max(mmax, m);
    }
    for (let i = 0; i < W * H; i++) { E[i] = (E[i] - emin) / (emax - emin); M[i] = (M[i] - mmin) / (mmax - mmin); }

    const mtnT = 0.86 - def.mtn * 1.6, hillT = mtnT - 0.1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = I(x, y), e = E[i], m = M[i], d = nD(x / 3, y / 3, 2);
      let c;
      if (e > mtnT) c = '▲';
      else if (e > hillT) c = '^';
      else if (e < def.water) c = '≈';
      else if (m > 1 - def.forest) c = m > 1 - def.forest * 0.45 ? '♠' : '♣';
      else c = d < 0.33 ? ' ' : d < 0.55 ? '.' : d < 0.7 ? ',' : d < 0.8 ? "'" : ' ';
      t[i] = c;
    }

    // ríos: caminata aleatoria de norte a sur con inercia
    for (let r = 0; r < def.rivers; r++) {
      let x = R.int(18, W - 18), dir = 0;
      for (let y = 0; y < H; y++) {
        if (t[I(x, y)] !== '▲') t[I(x, y)] = '~';
        if (R.chance(0.35)) dir = clamp(dir + R.int(-1, 1), -1, 1);
        if (R.chance(0.55) && dir) { x = clamp(x + dir, 2, W - 3); if (t[I(x, y)] !== '▲') t[I(x, y)] = '~'; }
      }
    }

    const items = {}, ground = {};
    const free = (x, y) => inb(x, y) && !TER[t[I(x, y)]].block && !TER[t[I(x, y)]].water && t[I(x, y)] !== '=' && !items[I(x, y)] && !ground[I(x, y)];
    const randFree = (x0, x1, y0 = 2, y1 = H - 3, tries = 400) => {
      for (let k = 0; k < tries; k++) {
        const x = R.int(x0, x1), y = R.int(y0, y1);
        if (free(x, y)) return [x, y];
      }
      return null;
    };

    // ciudades
    const cityCenters = [];
    for (let c = 0; c < def.cities; c++) {
      const cw = R.int(7, 11) + def.citySize * 3, chh = R.int(4, 6) + def.citySize;
      const cx = R.int(18, W - 22 - cw), cy = R.int(3, H - 4 - chh);
      cityCenters.push([cx + (cw >> 1), cy + (chh >> 1)]);
      for (let y = cy; y < cy + chh; y++) for (let x = cx; x < cx + cw; x++) {
        const edge = (x === cx || x === cx + cw - 1 || y === cy || y === cy + chh - 1);
        if (edge && R.chance(0.35)) continue;
        t[I(x, y)] = ((x - cx) % 4 === 0 || (y - cy) % 3 === 0) ? ':' : (R.chance(0.65) ? '#' : '▪');
      }
      const f = randFree(cx + 1, cx + cw - 2, cy + 1, cy + chh - 2, 60);
      if (f) items[I(f[0], f[1])] = { type: 'factory' };
    }

    // bosque abatido radial (Tunguska)
    const nuc = def.nucleo ? [Math.floor(W * 0.6), Math.floor(H / 2)] : null;
    if (nuc) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = I(x, y), c = t[i];
        const dx = x - nuc[0], dy = (y - nuc[1]) * 1.8, d = Math.hypot(dx, dy);
        if (d < 5) { t[i] = '×'; continue; }
        if (c === '♣' || c === '♠' || (d < 26 && (c === '.' || c === ',' || c === "'" || c === ' ') && R.chance(0.55))) {
          const a = Math.atan2(dy, dx);
          const o = ((Math.round(a / (Math.PI / 4)) % 4) + 4) % 4;
          t[i] = ['-', '\\', '|', '/'][o];
        }
      }
    }

    // pistas
    const sy = R.int(10, H - 11), sx = 3;
    const ex = W - 13, ey = R.int(7, H - 8);
    const clear = (x0, y0, w, h) => {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inb(x, y)) {
        const c = t[I(x, y)];
        if (TER[c].block || TER[c].water || c === '^' || c === '§') t[I(x, y)] = '.';
      }
    };
    clear(sx - 2, sy - 3, 12, 7); clear(ex - 3, ey - 3, 14, 7);
    for (let x = sx; x < sx + 6; x++) t[I(x, sy)] = '=';
    const exit = [];
    for (let x = ex; x < ex + 8; x++) { t[I(x, ey)] = '='; exit.push(I(x, ey)); }

    // anomalías
    const anomCenters = [];
    for (let a = 0; a < def.anom; a++) {
      let ax, ay;
      if (nuc && a < 6) { const ang = a / 6 * Math.PI * 2 + R.float(-0.3, 0.3); ax = Math.round(nuc[0] + Math.cos(ang) * R.int(7, 10)); ay = Math.round(nuc[1] + Math.sin(ang) * R.int(4, 6)); }
      else { ax = R.int(25, W - 20); ay = R.int(4, H - 5); }
      anomCenters.push([ax, ay]);
      const n = R.int(3, 7);
      let x = ax, y = ay;
      for (let k = 0; k < n; k++) {
        if (inb(x, y) && t[I(x, y)] !== '=' && !TER[t[I(x, y)]].water) t[I(x, y)] = '§';
        x += R.int(-1, 1); y += R.int(-1, 1);
      }
    }

    // objetos
    if (nuc) { clear(nuc[0] - 1, nuc[1] - 1, 3, 3); items[I(nuc[0], nuc[1])] = { type: 'nucleo' }; }
    for (let k = 0; k < def.frags; k++) {
      const p = nuc && k < 4
        ? randFree(nuc[0] - 14, nuc[0] + 14, nuc[1] - 8, nuc[1] + 8)
        : randFree(14, W - 8);
      if (p) items[I(p[0], p[1])] = { type: 'frag' };
    }
    for (let k = 0; k < def.wrecks; k++) { const p = randFree(10, W - 6); if (p) items[I(p[0], p[1])] = { type: 'wreck' }; }
    // depósitos repartidos a lo largo del sector
    for (let k = 0; k < def.depots; k++) {
      const x0 = Math.floor(18 + (W - 36) * k / def.depots), x1 = Math.floor(18 + (W - 36) * (k + 1) / def.depots);
      const p = randFree(x0, x1); if (p) items[I(p[0], p[1])] = { type: 'depot' };
    }

    // estructuras de tierra
    const putGround = (type, near) => {
      let p = null;
      if (near && R.chance(0.6)) p = randFree(near[0] - 7, near[0] + 7, Math.max(2, near[1] - 5), Math.min(H - 3, near[1] + 5), 80);
      if (!p) p = randFree(22, W - 6);
      if (p) ground[I(p[0], p[1])] = { type, hp: GROUND[type].hp, maxHp: GROUND[type].hp };
    };
    for (let k = 0; k < def.radars; k++) putGround('radar', cityCenters.length ? R.pick(cityCenters) : null);
    const aaNear = cityCenters.concat([[ex + 3, ey]]);
    if (nuc) aaNear.push(nuc);
    for (let k = 0; k < def.aa; k++) putGround('aa', R.pick(aaNear));

    // tormentas
    const storms = [];
    for (let k = 0; k < def.storms; k++) {
      storms.push({ x: R.int(20, W - 15), y: R.int(5, H - 6), r: R.float(3, 6.5), vx: R.float(-0.6, 0.6), vy: R.float(-0.4, 0.4) });
    }

    return { w: W, h: H, t, seen: new Array(W * H).fill(0), items, ground, storms, exit, start: { x: sx + 5, y: sy }, exitPos: { x: ex + 4, y: ey }, nuc };
  },

  rollTier(R, sector, bonus = 0) {
    const s = sector + bonus;
    return R.weighted([[0, Math.max(0.5, 3 - s * 0.6)], [1, 5], [2, 1.5 + s * 0.9], [3, 0.3 + s * 0.45]]);
  },

  module(R, G, o = {}) {
    const sector = o.sector || 0;
    const cat = o.cat || R.weighted([['motor', 2], ['arma', 3], ['tanque', 1.6], ['blindaje', 1.6], ['sistema', 3.2]]);
    let pool = MOD_T[cat].filter(tp => (tp.min || 0) <= sector);
    if (o.kind) pool = MOD_T[cat].filter(tp => tp.kind === o.kind);
    const tp = R.weighted(pool.map(p => [p, p.w || 1]));
    const tier = o.tier != null ? o.tier : this.rollTier(R, sector, o.bonus || 0);
    const mult = TIERS[tier].mult;
    const model = R.pick(tp.models);
    const m = {
      uid: G.newUid(), cat, kind: tp.kind, tier, base: tp.base, model,
      nick: R.pick(NICKS), origin: `Fábrica nº ${R.int(1, 640)}, ${R.pick(CITIES)} (${R.int(1949, 1961)})`,
      mass: tp.mass, cov: tp.cov, maxHp: tp.hp * (cat === 'blindaje' ? mult : (0.85 + mult * 0.15)), quirks: [],
    };
    if (cat === 'motor') { m.thrust = tp.thrust * mult; m.cons = tp.cons * (cat === 'motor' ? (1.1 - (mult - 1) * 0.4) : 1); }
    if (cat === 'tanque') m.cap = tp.cap * mult;
    if (cat === 'arma') {
      m.dmg = [Math.round(tp.dmg[0] * mult), Math.round(tp.dmg[1] * mult)];
      m.range = tp.range; m.acc = Math.round(tp.acc + (mult - 1) * 30); m.shots = tp.shots;
      m.ammo = tp.ammo; m.maxAmmo = tp.ammo; m.arc = tp.arc || null; m.ground = !!tp.ground;
      if (tp.ammo && tier >= 3) { m.maxAmmo = tp.ammo + 2; m.ammo = m.maxAmmo; }
    }
    if (cat === 'sistema') {
      m.sys = {};
      for (const k in tp.sys) {
        const v = tp.sys[k];
        m.sys[k] = (k === 'man' || k === 'grab' || k === 'burner') ? v : (k === 'repair' ? (tier >= 3 ? 3 : v) : Math.round(v * mult));
      }
    }

    // rasgos
    let q = null;
    if (!o.noQuirk) {
      const goods = ['ligero', 'robusto', 'afinado', 'compacto'], bads = ['pesado', 'fragil', 'desajustado', 'voluminoso'];
      if (tier === 0) q = R.pick(bads);
      else if (tier === 1) q = R.chance(0.3) ? R.pick(R.chance(0.5) ? goods : bads) : null;
      else if (tier === 2) q = R.chance(0.5) ? R.pick(goods) : null;
      else q = R.pick(goods);
    }
    if (q) {
      m.quirks.push(q);
      const perf = q === 'afinado' ? 1.15 : q === 'desajustado' ? 0.85 : 1;
      if (q === 'ligero') m.mass *= 0.65;
      if (q === 'pesado') m.mass *= 1.4;
      if (q === 'robusto') m.maxHp *= 1.5;
      if (q === 'fragil') m.maxHp *= 0.65;
      if (q === 'compacto') m.cov *= 0.6;
      if (q === 'voluminoso') m.cov *= 1.5;
      if (perf !== 1) {
        if (m.thrust) m.thrust *= perf;
        if (m.cap) m.cap *= perf;
        if (cat === 'blindaje') m.maxHp *= perf;
        if (m.dmg) { m.dmg = [Math.max(1, Math.round(m.dmg[0] * perf)), Math.max(1, Math.round(m.dmg[1] * perf))]; m.acc = Math.round(m.acc + (perf - 1) * 40); }
        if (m.sys) for (const k in m.sys) if (!['man', 'grab', 'burner', 'repair'].includes(k)) m.sys[k] = Math.round(m.sys[k] * perf);
      }
    }
    if (tier === 4) {
      m.anom = ANOM[cat].id;
      m.model = 'Ψ-' + model;
      if (m.anom === 'vacio') m.cons = 0;
      if (m.anom === 'ojo') { m.sys.vision = (m.sys.vision || 0) + 5; m.sys.ecm = (m.sys.ecm || 0) + 10; m.sys.reso = Math.max(m.sys.reso || 0, 20); }
      if (m.anom === 'certero') m.acc += 25;
    }
    m.maxHp = Math.max(4, Math.round(m.maxHp));
    m.hp = m.maxHp;
    m.mass = Math.round(m.mass * 10) / 10;
    m.cov = Math.round(m.cov);
    if (m.thrust) m.thrust = Math.round(m.thrust * 10) / 10;
    if (m.cons) m.cons = Math.round(m.cons * 100) / 100;
    if (m.cap) m.cap = Math.round(m.cap);
    m.value = Math.round([8, 18, 30, 46, 70][tier] * (cat === 'sistema' || cat === 'motor' ? 1.15 : 1));
    return m;
  },
};

function modName(m) { return `${m.base} ${m.model}`; }
function modColor(m) { return TIERS[m.tier].c; }
