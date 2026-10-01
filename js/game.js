'use strict';
// Estado y reglas: vuelo, combate, IA, alerta, recogidas, hangar, guardado.

const G = {
  st: null, R: null, lock: 0, events: [],

  // ---------- ciclo de vida ----------
  newGame(seed) {
    seed = seed != null ? seed : (Math.random() * 1e9) | 0;
    this.R = new Rng(seed);
    const st = this.st = {
      v: 1, seed, rs: 0, sector: 0, turn: 0, totalTurns: 0, scrap: 30, frags: 0, kills: 0, score: 0, nucleo: false,
      enemies: [], nid: 1, uid: 1, alert: 0, alertLvl: 0, targetId: null, fireMode: 'auto', pendingAlt: false,
      pTurn: 0, pThr: 0, log: [], phase: 'briefing', hangar: null, cause: '', hints: {},
      perks: [], items: { flares: 2, kits: 1 }, clock: 7.5, wind: { d: 2, s: 1 }, evadeCd: 0, pendingEvade: false,
      evading: false, flare: 0, blind: 0, event: null, sec: null, contract: null, kitTurn: -1,
      power: { mot: 2, arm: 2, sis: 2 }, bank: 0,
      stats: { frags: 0, dmgTaken: 0, shots: 0, hits: 0, ground: 0, modsLost: 0 },
    };
    st.plane = {
      x: 0, y: 0, h: 2, s: 2, alt: 1, structure: 100, maxStructure: 100, fuel: 0, temp: 45, ice: 0, radOpen: false,
      slots: new Array(SLOTS.length).fill(null), cargo: new Array(CARGO_SIZE).fill(null),
    };
    const R = this.R, P = st.plane;
    const mk = (cat, kind, tier = 1) => Gen.module(R, this, { cat, kind, tier, noQuirk: true });
    P.slots[0] = mk('motor', 'piston'); P.slots[1] = mk('motor', 'piston');
    P.slots[2] = mk('arma', 'canon'); P.slots[3] = mk('arma', 'cohetes');
    P.slots[6] = mk('tanque', 'tanque');
    P.slots[8] = mk('blindaje', 'placa');
    P.slots[10] = mk('sistema', 'radar');
    P.cargo[0] = mk('arma', 'torreta', 0);
    P.fuel = this.calc().fuelCap;
    this.startSector();
  },

  load(data) {
    if (!data || data.v !== 1) return false;
    this.st = data;
    this.migrate(data);
    this.R = new Rng(data.rs);
    const P = data.plane;
    P.dx = P.x; P.dy = P.y;
    for (const e of data.enemies) { e.dx = e.x; e.dy = e.y; }
    return true;
  },

  // partidas guardadas con versiones anteriores
  migrate(st) {
    const d = { perks: [], items: { flares: 2, kits: 1 }, clock: 7.5, wind: { d: 2, s: 1 }, evadeCd: 0, pendingEvade: false, evading: false, flare: 0, blind: 0, event: null, contract: null, kitTurn: -1 };
    for (const k in d) if (st[k] === undefined) st[k] = d[k];
    if (!st.sec) st.sec = { kills: 0, radars: 0, sams: 0, frags: 0, mods: 0, events: 0 };
    if (!st.power) st.power = { mot: 2, arm: 2, sis: 2 };
    if (st.bank == null) st.bank = 0;
    const P = st.plane;
    if (P) { if (P.temp == null) P.temp = 45; if (P.ice == null) P.ice = 0; if (P.radOpen == null) P.radOpen = false; }
    if (st.map) for (const k in st.map.ground) if (st.map.ground[k].cd == null) st.map.ground[k].cd = 0;
  },

  save() {
    if (!this.st) return;
    this.st.rs = this.R.s;
    if (this.st.phase === 'dead' || this.st.phase === 'won') { Save.clear(); return; }
    Save.save(this.st);
  },

  newUid() { return this.st ? this.st.uid++ : 0; },

  startSector() {
    const st = this.st, def = SECTORS[st.sector], P = st.plane;
    st.map = Gen.sector(this.R, st.sector);
    P.x = st.map.start.x; P.y = st.map.start.y; P.h = 2; P.s = 2; P.alt = 1; P.dx = P.x; P.dy = P.y;
    st.enemies = []; st.alert = 0; st.alertLvl = 0; st.turn = 0; st.targetId = null; st.pendingAlt = false;
    st.pTurn = 0; st.pThr = 0; st.log = [];
    st.wind = st.sector === 0 ? { d: 2, s: 1 } : { d: this.R.int(0, 7), s: this.R.int(1, 2) };
    st.sec = { kills: 0, radars: 0, sams: 0, frags: 0, mods: 0, events: 0 };
    st.event = null; st.blind = 0; st.flare = 0; st.evading = false; st.pendingEvade = false; st.evadeCd = 0;
    st.contract = this.genContract();
    P.temp = 45; P.ice = 0; P.radOpen = false; st.bank = 0;
    for (let k = 0; k < def.patrols; k++) this.spawnEnemy(this.R.weighted(def.pool), 'patrol');
    this.reveal();
    st.phase = 'briefing';
    this.log(`Sector ${st.sector + 1}/5: ${def.name}. Destino: ${def.field} (este).`, COL.o2);
    if (st.sector === 0) {
      this.log('Mando OKB: «Zhuravl, ← → para virar, ↑ ↓ para el acelerador, ESPACIO para ejecutar.»', COL.o3);
      this.log('Mando OKB: «Las flechas del mapa son sus destinos posibles: también puede hacer clic en ellas.»', COL.o3);
      this.log('Mando OKB: «Para recoger fragmentos ◊ y aterrizar, baje a altitud BAJA con X.»', COL.o3);
    }
    if (st.sector === 4) this.log('El Núcleo está en el centro del epicentro. Sin él no habrá aterrizaje.', COL.cyan);
    this.save();
  },

  log(text, col = COL.cream) {
    const st = this.st;
    st.log.push({ text, col, turn: st.turn });
    if (st.log.length > 60) st.log.shift();
  },
  hint(key, text) {
    if (this.st.hints[key]) return;
    this.st.hints[key] = 1;
    this.log(text, COL.grey);
  },

  // ---------- estadísticas derivadas ----------
  calc() {
    const P = this.st.plane;
    const s = {
      thrust: 0, cons: 0, fuelCap: 40, mass: 12, man: 1, vision: 0, detect: 0, ecm: 0, aim: 0, reso: 0, repair: 0,
      stealth: 0, burner: 0, grab: 0, engines: 0, weapons: 0, armor: 0, fountain: 0, regen: 0,
    };
    const st = this.st, has = k => st.perks && st.perks.includes(k);
    const pw = st.power || { mot: 2, arm: 2, sis: 2 };
    s.leak = 0; s.crit = 0; s.gen = 2; s.radar = false;
    P.slots.forEach((m, i) => {
      if (!m) return;
      s.mass += m.mass;
      const crit = isCrit(m);
      if (crit) s.crit++;
      if (m.cat === 'motor') { s.thrust += m.thrust * (crit ? 0.6 : 1); s.cons += m.cons; s.engines++; s.gen += crit ? 1 : 2; }
      else if (m.cat === 'tanque') { s.fuelCap += m.cap; if (m.anom === 'fuente') s.fountain += 0.6; if (crit) s.leak += 0.5; }
      else if (m.cat === 'arma') s.weapons++;
      else if (m.cat === 'blindaje') { s.armor++; if (m.anom === 'regen') s.regen++; }
      else if (m.cat === 'sistema' && !crit && !(st.blind > 0 && m.kind === 'radar')) { for (const k in m.sys) s[k] = (s[k] || 0) + m.sys[k]; if (m.sys.detect) s.radar = true; }
    });
    // energía: el bus de sistemas escala sensores, contramedidas y reparación
    const sm = PWR.sis[pw.sis];
    for (const k of ['vision', 'detect', 'ecm', 'aim', 'reso', 'stealth']) s[k] = Math.round(s[k] * sm);
    s.repair = Math.floor(s.repair * sm);
    if (pw.sis === 0) s.radar = false;
    s.thrust *= PWR.motT[pw.mot]; s.cons *= PWR.motC[pw.mot];
    if ((P.temp || 0) > 90) s.thrust *= 0.88;
    s.armAcc = PWR.armA[pw.arm]; s.armOff = pw.arm === 0;
    s.pw = pw;
    if (has('halcon')) s.vision += 3;
    if (has('tirador')) s.aim += 10;
    if (has('navegante')) s.cons *= 0.88;
    if (has('fantasma')) s.stealth += 20;
    if (has('mecanico')) s.repair += 1;
    s.night = this.dayPhase() === 'noche';
    for (const m of P.cargo) if (m) s.mass += m.mass;
    s.mass += P.fuel / 25 + (P.ice || 0) / 12;
    s.mass = Math.round(s.mass * 10) / 10;
    s.ratio = s.thrust / s.mass;
    let mx = s.thrust <= 0 ? 0 : s.ratio >= 0.8 ? 4 : s.ratio >= 0.55 ? 3 : s.ratio >= 0.38 ? 2 : 1;
    if (mx > 0 && s.burner) { mx = Math.min(5, mx + s.burner); s.cons *= 1.35; }
    if (mx > 1 && (P.ice || 0) >= 90) mx--;
    if (P.fuel <= 0 && s.cons > 0) mx = 0;
    s.maxS = mx;
    s.man = Math.min(3, s.man);
    s.turnMax = this.turnSteps(P.s, s);
    s.stealth = Math.min(70, s.stealth);
    s.grabLim = 2 + Math.min(2, s.grab);
    s.visR = Math.max(4, (P.alt ? 12 : 8) + s.vision - (s.night ? 4 : 0));
    s.detR = Math.max(s.visR, s.detect);
    s.fuelUse = this.fuelUse(s, P.s, P.alt);
    return s;
  },
  fuelUse(s, speed, alt, h) {
    if (h == null) h = this.st.plane.h;
    return s.cons * (0.6 + 0.4 * speed) * (alt ? 1 : 1.2) * this.windMul(h) * (this.st.plane.radOpen ? 1.08 : 1);
  },
  // giro máximo en pasos de 45° según la velocidad actual (más lento = más cerrado)
  turnSteps(speed, s) {
    let t = clamp(4 - speed, 1, 3) + ((s ? s.man : 1) - 1);
    if ((this.st.plane.ice || 0) >= 60) t--;
    return clamp(t, 1, 4);
  },
  // energía del generador
  powerUsed() { const p = this.st.power; return p.mot + p.arm + p.sis; },
  setPower(bus, v) {
    const st = this.st, S = this.calc();
    v = clamp(v, 0, 4);
    const other = this.powerUsed() - st.power[bus];
    if (other + v > S.gen) { Sound.play('deny'); return false; }
    st.power[bus] = v;
    Sound.play('click');
    this.save();
    return true;
  },
  cyclePower(bus) {
    const st = this.st, S = this.calc();
    const free = S.gen - this.powerUsed();
    if (st.power[bus] < 4 && free > 0) return this.setPower(bus, st.power[bus] + 1);
    return this.setPower(bus, 0);
  },
  fixPower() {
    const st = this.st, S = this.calc();
    let over = this.powerUsed() - S.gen, cut = false;
    for (const b of ['sis', 'arm', 'mot']) while (over > 0 && st.power[b] > 0) { st.power[b]--; over--; cut = true; }
    if (cut) this.log(`Caída del generador (${S.gen} unidades): se recorta la energía.`, COL.yellow);
  },
  toggleRadiator() {
    const P = this.st.plane;
    P.radOpen = !P.radOpen;
    this.log(P.radOpen ? 'Radiador ABIERTO: refrigeración máxima, +8% de consumo por resistencia.' : 'Radiador CERRADO.', COL.o3);
    Sound.play('click');
    this.save();
  },
  // temperatura de motores e hielo, una vez por turno
  thermal(S) {
    const st = this.st, P = st.plane, R = this.R;
    const r = S.maxS ? P.s / S.maxS : 0;
    const heat = S.engines && P.fuel > 0 ? 1 + 7 * r * r * PWR.motH[st.power.mot] + (S.burner ? 3 : 0) : 0;
    const storm = this.inStorm(P.x, P.y);
    const cool = (P.radOpen ? 11 : 6) * (P.alt ? 1.2 : 1) * (S.night ? 1.1 : 1) * (storm ? 1.3 : 1);
    const amb = P.alt ? 25 : 35;
    const t0 = P.temp;
    P.temp = clamp(P.temp + heat - cool, amb, 130);
    if (P.temp > 100) {
      const eng = P.slots.map((m, i) => [m, i]).filter(([m]) => m && m.cat === 'motor');
      if (eng.length) {
        const [m, i] = R.pick(eng);
        const dmg = R.int(2, 4) + Math.floor((P.temp - 100) / 10);
        m.hp -= dmg;
        this.log(`¡SOBRECALENTAMIENTO! ${modName(m)} −${dmg}. Abre el radiador (V) o reduce potencia.`, COL.red);
        FX.burst(P.x, P.y, { n: 6, chars: '°·', cols: [COL.white, COL.grey], speed: 2, grav: -1 });
        if (m.hp <= 0) { P.slots[i] = null; st.stats.modsLost++; st.sec.mods++; this.log(`¡${modName(m)} se ha gripado!`, COL.red); FX.explosion(P.x, P.y, false); Sound.play('boom'); }
      }
    } else if (P.temp > 85 && t0 <= 85) { this.log('Temperatura de motores en zona amarilla (85°).', COL.yellow); Sound.play('alarm'); }
    // hielo
    const cold = SECTORS[st.sector].cold || 0.5;
    let di = P.alt ? cold * 1.2 + (S.night ? 2 : 0) + (storm ? 5 : 0) : -4;
    if (st.power.sis >= 3) di -= 7;
    if (P.temp > 80) di -= 2;
    const i0 = P.ice;
    P.ice = clamp(P.ice + di, 0, 100);
    for (const th of [30, 60, 90]) if (i0 < th && P.ice >= th) {
      this.log(th === 30 ? 'Hielo en las alas (30%): el T-0 pesa más.' : th === 60 ? 'Hielo al 60%: los alerones responden peor (−45° de giro).' : '¡Hielo al 90%! Pierdes velocidad máxima. Baja o activa el deshielo (SIS ≥ 3).', th >= 60 ? COL.yellow : COL.storm);
    }
  },
  // viento: a favor ahorra hasta un 20%, en contra cuesta hasta un 20%
  windMul(h) {
    const w = this.st.wind;
    if (!w) return 1;
    return 1 - 0.08 * w.s * Math.cos(((h - w.d + 8) % 8) * Math.PI / 4);
  },
  dayPhase() {
    const c = this.st.clock;
    if (c >= 21 || c < 5) return 'noche';
    if (c >= 18.5 || c < 7) return 'crepúsculo';
    return 'día';
  },
  clockStr() { const c = this.st.clock; return `${String(Math.floor(c)).padStart(2, '0')}:${String(Math.round((c % 1) * 60)).padStart(2, '0')}`; },

  // ---------- maniobras ----------
  options() {
    const st = this.st, P = st.plane, S = this.calc();
    const res = [], seen = {};
    const glide = S.maxS === 0;
    for (let turn = -S.turnMax; turn <= S.turnMax; turn++) {
      for (const thr of [0, -1, 1]) {
        if (glide && thr !== 0) continue;
        let ns;
        if (glide) ns = (P.s - 1 <= 0 && P.alt === 1) ? 1 : P.s - 1;
        else ns = clamp(P.s + thr - (Math.abs(turn) >= 2 && !st.perks.includes('as') ? 1 : 0), 1, S.maxS);
        const nh = (P.h + turn + 8) % 8;
        const key = nh + ':' + ns;
        if (seen[key]) continue;
        seen[key] = 1;
        const path = [];
        let x = P.x, y = P.y;
        for (let i = 0; i < ns; i++) { x += DX[nh]; y += DY[nh]; path.push([x, y]); }
        res.push({ turn, thr, nh, ns, path, ex: x, ey: y, glide, dive: glide && P.s - 1 <= 0 && P.alt === 1 });
      }
    }
    return res;
  },
  pendingOption(opts) {
    const st = this.st;
    opts = opts || this.options();
    let best = opts.find(o => o.turn === st.pTurn && o.thr === st.pThr);
    if (!best) best = opts.find(o => o.turn === st.pTurn && o.thr === 0) || opts.find(o => o.turn === 0 && o.thr === 0) || opts[0];
    return best;
  },

  // ---------- turno ----------
  canAct() { return this.st && this.st.phase === 'flight' && !this.st.event && performance.now() >= this.lock; },

  doTurn(opt) {
    if (!this.canAct()) return;
    const st = this.st, P = st.plane, R = this.R;
    let S = this.calc();
    st.turn++; st.totalTurns++;
    this.lock = performance.now() + 230;
    st.pTurn = 0; st.pThr = 0;
    Sound.play('turn');
    const phase0 = this.dayPhase();
    st.clock = (st.clock + 0.25) % 24;
    if (this.dayPhase() !== phase0) {
      const ph = this.dayPhase();
      this.log(ph === 'noche' ? 'Cae la noche: menos visión para todos. Los antiaéreos disparan a ciegas.' : ph === 'día' ? 'Amanece sobre la taiga.' : 'Crepúsculo.', COL.o3);
    }
    if (st.evadeCd > 0) st.evadeCd--;
    if (st.blind > 0) { st.blind--; if (!st.blind) this.log('Radar de nuevo en línea.', COL.o3); }
    st.evading = false;
    if (st.pendingEvade) {
      st.pendingEvade = false;
      st.evading = true;
      const refl = st.perks.includes('reflejos');
      st.evadeCd = refl ? 2 : 4;
      if (!refl) P.fuel = Math.max(0, P.fuel - 2);
      this.log('¡Tonel! Maniobra evasiva: los enemigos apuntan peor, pero no disparas este turno.', COL.yellow);
      FX.ring(P.x, P.y, 2, COL.white);
    }

    // altitud
    if (st.pendingAlt) {
      st.pendingAlt = false;
      P.alt = 1 - P.alt;
      if (P.alt) { P.fuel = Math.max(0, P.fuel - 1.5 * (S.cons > 0 ? 1 : 0)); this.log('Ascenso a altitud ALTA.', COL.o2); }
      else this.log('Descenso a altitud BAJA.', COL.o2);
      FX.burst(P.x, P.y, { n: 8, speed: 3, chars: '·°', cols: [COL.white, COL.grey], life: 0.6 });
      S = this.calc();
    }

    st.bank = opt.turn;
    P.h = opt.nh;
    P.s = opt.ns;
    const sick = P.slots.find(m => m && m.cat === 'motor' && isCrit(m));
    if (sick && P.s > 1 && R.chance(0.12)) { P.s--; this.log(`${modName(sick)} petardea: pierdes velocidad.`, COL.yellow); FX.burst(P.x, P.y, { n: 6, chars: '·*', cols: [COL.grey, COL.dgrey], speed: 2 }); }
    if (opt.dive && P.alt === 1) {
      // sin velocidad en altitud alta: picado para ganar velocidad
      P.alt = 0;
      this.log('Picado: el T-0 cambia altura por velocidad. Altitud BAJA.', COL.yellow);
    }

    if (P.s <= 0) {
      // planeo terminado
      if (P.alt === 0 && st.map.exit.includes(P.y * st.map.w + P.x)) { this.land(); return; }
      return this.die('El T-0 entra en pérdida y se estrella contra la taiga.');
    }

    // movimiento paso a paso
    const map = st.map;
    let landed = false;
    for (let i = 0; i < P.s; i++) {
      const nx = P.x + DX[P.h], ny = P.y + DY[P.h];
      if (nx < 1 || ny < 1 || nx >= map.w - 1 || ny >= map.h - 1) {
        P.h = (P.h + 4) % 8;
        this.log('Frontera del sector: viraje forzado de 180°.', COL.yellow);
        break;
      }
      P.x = nx; P.y = ny;
      const idx = ny * map.w + nx, ter = TER[map.t[idx]];
      if (Math.random() < 0.8) FX.trail(P.x - DX[P.h] * 0.5, P.y - DY[P.h] * 0.5);
      if (ter.anom) { this.warp(); break; }
      if (P.alt === 0) {
        if (ter.block) {
          const dmg = R.int(6, 11);
          this.log(`¡Impacto contra la ladera! El T-0 rebota y gana altura.`, COL.red);
          this.damagePlayer(dmg, 'una montaña', true);
          P.alt = 1;
          FX.burst(P.x, P.y, { n: 14, chars: '▲^*·', speed: 5 });
          if (st.phase !== 'flight') return;
        }
        this.pickupAt(nx, ny, S);
        if (S.reso) for (let d = 0; d < 8; d++) { const it = map.items[(ny + DY[d]) * map.w + nx + DX[d]]; if (it && it.type === 'frag') this.pickupAt(nx + DX[d], ny + DY[d], S); }
        if (map.exit.includes(idx) && P.s <= 2) {
          if (SECTORS[st.sector].nucleo && !st.nucleo) this.hint('nonuc' + st.turn, 'Mando: «Negativo, Zhuravl. Sin el Núcleo no aterrice.»');
          else { landed = true; break; }
        } else if (map.exit.includes(idx) && P.s > 2) this.hint('fastland', 'Demasiado rápido para aterrizar: velocidad ≤ 2 sobre la pista.');
      } else if (map.exit.includes(idx)) this.hint('altland', 'Para aterrizar: altitud BAJA (X) y velocidad ≤ 2 sobre la pista.');
    }
    if (landed) { this.land(); return; }

    // combustible
    S = this.calc();
    const use = S.fuelUse * (P.s > 0 ? 1 : 0);
    P.fuel = Math.max(0, P.fuel - use - S.leak + S.fountain);
    if (S.leak) this.hint('leak' + st.sector, 'Un tanque dañado pierde combustible. Repáralo o vacíalo.');
    P.fuel = Math.min(P.fuel, S.fuelCap);
    if (P.fuel <= 0 && S.cons > 0 && !st.hints['nofuel' + st.sector]) {
      st.hints['nofuel' + st.sector] = 1;
      this.log('¡SIN COMBUSTIBLE! Los motores se apagan. Planeo...', COL.red);
      Sound.play('alarm');
    } else if (P.fuel > 0 && P.fuel < S.fuelCap * 0.2 && !st.hints['lowfuel' + st.sector]) {
      st.hints['lowfuel' + st.sector] = 1;
      this.log('Combustible bajo (20%). Busca un depósito ⌂ o la pista.', COL.yellow);
    }

    this.thermal(S);
    this.fixPower();
    this.reveal();

    // disparo del jugador
    this.playerFire(S);

    // enemigos
    this.enemiesAct();
    if (st.phase !== 'flight') return;
    this.groundAct(S);
    if (st.phase !== 'flight') return;

    // entorno
    this.environment(S);
    if (st.phase !== 'flight') return;
    this.updateAlert();

    // radio
    if (R.chance(0.05)) {
      const msg = R.pick(RADIO).replace('{f}', SECTORS[st.sector].field.split(' ').pop()).replace('{q}', `${String.fromCharCode(65 + R.int(0, 7))}-${R.int(1, 9)}`);
      this.log('[RADIO] ' + msg, COL.o4);
    }

    if (st.flare) { st.flare = 0; for (const e of st.enemies) e.aware = 0; }
    if (st.turn >= 6 && st.sec.events < 2 && !st.event && R.chance(0.045)) this.triggerEvent();

    if (st.targetId && !st.enemies.find(e => e.id === st.targetId) && !this.groundById(st.targetId)) st.targetId = null;
    this.save();
  },

  // ---------- consumibles y evasiva ----------
  toggleEvade() {
    const st = this.st;
    if (st.phase !== 'flight') return false;
    if (st.evadeCd > 0 && !st.pendingEvade) { this.log(`Evasiva no disponible (${st.evadeCd} turnos).`, COL.grey); Sound.play('deny'); return false; }
    st.pendingEvade = !st.pendingEvade;
    Sound.play('click');
    return true;
  },
  useFlare() {
    const st = this.st, P = st.plane;
    if (!this.canAct()) return false;
    if (st.items.flares <= 0 || st.flare) { Sound.play('deny'); return false; }
    st.items.flares--;
    st.flare = 1;
    st.alert = Math.max(0, st.alert - 10);
    this.log('Bengalas lanzadas: los sistemas de puntería enemigos pierden el blanco.', COL.yellow);
    for (let k = 0; k < 4; k++) FX.burst(P.x, P.y, { n: 8, speed: 6 + k, chars: '*·+', cols: [COL.white, COL.yellow, COL.o2, COL.o3], life: 1.6, grav: 1.2 });
    FX.flash(0.15);
    Sound.play('rocket');
    this.save();
    return true;
  },
  useKit() {
    const st = this.st, P = st.plane;
    if (!this.canAct()) return false;
    if (st.items.kits <= 0 || st.kitTurn === st.turn) { Sound.play('deny'); return false; }
    st.items.kits--; st.kitTurn = st.turn;
    P.structure = Math.min(P.maxStructure, P.structure + 20);
    const worst = P.slots.filter(m => m && m.hp < m.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (worst) worst.hp = Math.min(worst.maxHp, worst.hp + 12);
    this.log(`Kit de reparación: +20 estructura${worst ? ', ' + modName(worst) + ' +12' : ''}.`, COL.green);
    FX.burst(P.x, P.y, { n: 12, chars: '+·', cols: [COL.white, COL.green, COL.o3], speed: 3 });
    Sound.play('pick');
    this.save();
    return true;
  },
  gainScrap(n) {
    const v = Math.round(n * (this.st.perks.includes('chatarrero') ? 1.4 : 1));
    this.st.scrap += v;
    return v;
  },

  // ---------- encargos del Ministerio ----------
  genContract() {
    const st = this.st, def = SECTORS[st.sector], R = this.R;
    const pool = [
      ['frags', 3, () => Math.max(2, def.frags - 2)],
      ['kills', 3, () => 2 + st.sector],
      ['stealth', 2, () => 30],
      ['intact', 2, () => 0],
      ['explore', 2, () => 45 + st.sector * 3],
    ];
    if (def.radars) pool.push(['radar', 3, () => Math.min(2, def.radars)]);
    if (def.sams) pool.push(['sam', 3, () => 1]);
    const pick = R.weighted(pool.map(p => [p, p[1]]));
    return { type: pick[0], n: pick[2](), scrap: R.int(20, 32) + st.sector * 6, frags: R.chance(0.4) ? 1 : 0, paid: false };
  },
  contractInfo(c) {
    const st = this.st;
    c = c || st.contract;
    if (!c) return null;
    const sec = st.sec || {};
    let prog = 0, txt = '', ok = false, live = true;
    switch (c.type) {
      case 'frags': prog = sec.frags; txt = `Recupera ${c.n} fragmentos en este sector`; ok = prog >= c.n; break;
      case 'kills': prog = sec.kills; txt = `Derriba ${c.n} aparatos de la Dirección K`; ok = prog >= c.n; break;
      case 'radar': prog = sec.radars; txt = `Destruye ${c.n} estación${c.n > 1 ? 'es' : ''} de radar Ж`; ok = prog >= c.n; break;
      case 'sam': prog = sec.sams; txt = 'Destruye un lanzamisiles SAM Ψ'; ok = prog >= c.n; break;
      case 'stealth': prog = Math.round(st.alert); txt = `Aterriza con la alerta por debajo del ${c.n}%`; ok = st.alert < c.n; live = false; break;
      case 'intact': prog = sec.mods; txt = 'No pierdas ningún módulo en este sector'; ok = sec.mods === 0; live = false; break;
      case 'explore': {
        const seen = st.map ? st.map.seen.reduce((a, b) => a + b, 0) / st.map.seen.length * 100 : 0;
        prog = Math.floor(seen); txt = `Reconoce el ${c.n}% del sector`; ok = seen >= c.n; break;
      }
    }
    const progTxt = c.type === 'stealth' ? `alerta ${prog}%` : c.type === 'intact' ? (ok ? 'intacto' : `${prog} perdidos`) : c.type === 'explore' ? `${prog}%/${c.n}%` : `${Math.min(prog, c.n)}/${c.n}`;
    return { txt, ok, progTxt, live, reward: `+${c.scrap} ¤${c.frags ? ` · +${c.frags} ◊` : ''}` };
  },

  // ---------- eventos de radio ----------
  placeAhead(type, dmin, dmax) {
    const st = this.st, P = st.plane, map = st.map, R = this.R;
    for (let k = 0; k < 80; k++) {
      const h = (P.h + R.int(-1, 1) + 8) % 8, d = R.int(dmin, dmax);
      const x = clamp(P.x + Math.round(DX[h] * d * 1.2 + R.int(-3, 3)), 3, map.w - 4);
      const y = clamp(P.y + Math.round(DY[h] * d * 0.8 + R.int(-2, 2)), 3, map.h - 4);
      const i = y * map.w + x, t = TER[map.t[i]];
      if (t.block || t.water || t.anom || map.items[i] || map.ground[i] || map.exit.includes(i)) continue;
      map.items[i] = { type };
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) map.seen[(y + dy) * map.w + x + dx] = 1;
      return { x, y };
    }
    return null;
  },
  triggerEvent() {
    const st = this.st, R = this.R;
    const pool = [['socorro', 3], ['suministro', 3], ['falsa', 2], ['silencio', st.alert >= 20 ? 3 : 1]];
    if (Object.keys(st.map.ground).length && st.scrap >= 15) pool.push(['desertor', 2]);
    st.event = { id: R.weighted(pool) };
    st.sec.events++;
    this.log('[RADIO] Transmisión prioritaria entrante...', COL.yellow);
    Sound.play('alarm');
  },
  eventDef(ev) {
    const st = this.st;
    const E = {
      socorro: {
        title: 'SEÑAL DE SOCORRO',
        text: 'Una baliza de emergencia: «...aquí Halcón-4, derribado... herido... cualquier aparato soviético...». Un piloto de reconocimiento del OKB está en tierra, no muy lejos de tu rumbo.',
        opts: [['RESCATARLO', 'Marca su posición @. Vuela bajo y despacio para recogerlo. Te recompensará.'], ['IGNORAR', 'La misión es lo primero.']],
      },
      desertor: {
        title: 'UN DESERTOR',
        text: 'Una voz nerviosa en una frecuencia civil: «Soy operador de la Dirección K. Tengo las coordenadas de todas las instalaciones del sector. Quince unidades de chatarra en el próximo lanzamiento y son suyas.»',
        opts: [['PAGAR 15 ¤', 'Revela todas las estaciones de radar, antiaéreos y SAM del sector.'], ['RECHAZAR', 'Quizá avise a sus antiguos jefes...']],
      },
      silencio: {
        title: 'ORDEN DE SILENCIO',
        text: 'Mando OKB: «Zhuravl, la Dirección K triangula sus emisiones. Apague el radar de a bordo seis turnos y perderán la pista.»',
        opts: [['APAGAR EL RADAR', 'Alerta −25. Tu radar queda fuera de servicio 6 turnos.'], ['MANTENERLO', 'Prefieres ver lo que se acerca.']],
      },
      suministro: {
        title: 'LANZAMIENTO DE SUMINISTROS',
        text: 'Un Li-2 del Ministerio cruza el sector a gran altura: «Zhuravl, podemos dejarle caer un contenedor. ¿Qué necesita?»',
        opts: [['COMBUSTIBLE', 'Un depósito ⌂ cae por delante de tu rumbo.'], ['PIEZAS Y PERTRECHOS', 'Un contenedor ■ con un módulo, una bengala y un kit.']],
      },
      falsa: {
        title: 'FRECUENCIA DESCONOCIDA',
        text: 'En la banda reservada del OKB suena una señal en bucle: tres pitidos, una pausa, tres pitidos. Nadie del Mando la reconoce.',
        opts: [['INVESTIGAR', 'Marca el origen ?. Puede ser un hallazgo... o una trampa.'], ['IGNORAR', 'Demasiado conveniente.']],
      },
    };
    return E[ev.id];
  },
  resolveEvent(choice) {
    const st = this.st, R = this.R, map = st.map;
    const ev = st.event;
    if (!ev) return;
    st.event = null;
    Sound.play('click');
    switch (ev.id) {
      case 'socorro':
        if (choice === 0) { const p = this.placeAhead('survivor', 10, 18); this.log(p ? 'Posición de Halcón-4 marcada en el mapa (@).' : 'La baliza se apaga antes de poder triangularla.', COL.yellow); }
        else this.log('Dejas atrás la baliza. Nadie lo sabrá nunca.', COL.grey);
        break;
      case 'desertor':
        if (choice === 0 && st.scrap >= 15) {
          st.scrap -= 15;
          for (const k in map.ground) { const x = k % map.w, y = (k / map.w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = (y + dy) * map.w + x + dx; if (i >= 0 && i < map.seen.length) map.seen[i] = 1; } }
          this.log('Coordenadas recibidas: todas las instalaciones enemigas aparecen en tu mapa (M).', COL.yellow);
        } else if (R.chance(0.4)) { st.alert = Math.min(100, st.alert + 12); this.log('El desertor cumple su amenaza: la Dirección K sabe dónde buscarte.', COL.red); }
        else this.log('La frecuencia queda en silencio.', COL.grey);
        break;
      case 'silencio':
        if (choice === 0) { st.alert = Math.max(0, st.alert - 25); st.blind = 6; this.log('Radar apagado. Vuelas a ciegas, pero invisible a sus triangulaciones.', COL.yellow); }
        else this.log('Mantienes el radar encendido.', COL.grey);
        break;
      case 'suministro':
        if (this.placeAhead(choice === 0 ? 'depot' : 'cache', 8, 14)) this.log(choice === 0 ? 'Un depósito ⌂ desciende en paracaídas delante de ti.' : 'Un contenedor ■ desciende en paracaídas delante de ti.', COL.yellow);
        break;
      case 'falsa':
        if (choice === 0) { this.placeAhead('signal', 10, 18); this.log('Origen de la señal marcado (?).', COL.yellow); }
        else this.log('Cambias de frecuencia.', COL.grey);
        break;
    }
    this.save();
  },

  // ---------- visión ----------
  reveal() {
    const st = this.st, P = st.plane, map = st.map, S = this.calc();
    const r = S.visR;
    for (let y = Math.max(0, P.y - r); y <= Math.min(map.h - 1, P.y + r); y++)
      for (let x = Math.max(0, P.x - r * 1.4 | 0); x <= Math.min(map.w - 1, P.x + r * 1.4 | 0); x++)
        if (this.visDist(x, y) <= r) map.seen[y * map.w + x] = 1;
  },
  visDist(x, y) { const P = this.st.plane; return Math.hypot((x - P.x) * 0.72, y - P.y); },
  isVisible(x, y, S) { S = S || this.calc(); return this.visDist(x, y) <= S.visR; },
  enemyVisible(e, S) {
    S = S || this.calc();
    const d = this.visDist(e.x, e.y);
    return d <= S.visR || (S.detect > 0 && d <= S.detect);
  },

  // ---------- recogidas ----------
  pickupAt(x, y, S) {
    const st = this.st, map = st.map, P = st.plane, R = this.R;
    const idx = y * map.w + x, it = map.items[idx];
    if (!it) return;
    const slowOk = P.s <= S.grabLim;
    if (it.type === 'frag') {
      delete map.items[idx];
      st.frags++; st.stats.frags++; st.score += 100; st.sec.frags++;
      this.log('Fragmento del Objeto recuperado. ◊ +1', COL.cyan);
      FX.burst(x, y, { n: 22, speed: 5, chars: '◊·+*', cols: [COL.white, COL.cyan, COL.cyan, COL.dcyan], life: 1.1 });
      FX.ring(x, y, 3, COL.cyan);
      FX.text(x, y - 1, '+◊', COL.cyan);
      Sound.play('frag');
    } else if (it.type === 'nucleo') {
      delete map.items[idx];
      st.nucleo = true; st.score += 1500;
      this.log('EL NÚCLEO ESTÁ A BORDO. Todo el epicentro despierta. ¡Hacia la pista de evacuación!', COL.cyan);
      FX.burst(x, y, { n: 60, speed: 12, chars: '◊◉·+*', cols: [COL.white, COL.cyan, COL.purple, COL.dcyan], life: 1.8 });
      FX.ring(x, y, 8, COL.cyan); FX.flash(0.5); FX.shake(8);
      Sound.play('warp');
      st.alert = Math.min(100, st.alert + 45);
      for (let k = 0; k < 3; k++) this.spawnEnemy('eco', 'wave');
    } else if (it.type === 'signal') {
      delete map.items[idx];
      if (R.chance(0.55)) {
        st.frags += 2; st.stats.frags += 2; st.sec.frags += 2; st.score += 200;
        this.log('La señal procedía de dos fragmentos del Objeto que resuenan entre sí. ◊ +2', COL.cyan);
        FX.burst(x, y, { n: 30, speed: 6, chars: '◊·+*', cols: [COL.white, COL.cyan, COL.dcyan], life: 1.2 });
        Sound.play('frag');
      } else {
        this.log('¡Emboscada! La señal era un cebo de la Dirección K.', COL.red);
        for (let k = 0; k < 2; k++) this.spawnEnemy(R.weighted(SECTORS[st.sector].pool), 'wave');
        st.alert = Math.min(100, st.alert + 15);
        Sound.play('alarm'); FX.shake(4);
      }
    } else if (!slowOk) {
      this.hint('grab', `Demasiado rápido para recoger ${ITEMS[it.type].n.toLowerCase()} (velocidad máx. ${S.grabLim}).`);
    } else if (it.type === 'depot') {
      delete map.items[idx];
      const amt = R.int(26, 40);
      P.fuel = Math.min(this.calc().fuelCap, P.fuel + amt);
      this.log(`Repostaje en vuelo desde un depósito: +${amt} de combustible.`, COL.yellow);
      FX.burst(x, y, { n: 14, chars: '·°', cols: [COL.yellow, COL.o2, COL.o3], speed: 4 });
      Sound.play('pick');
    } else if (it.type === 'survivor') {
      delete map.items[idx];
      const sc = this.gainScrap(20);
      st.alert = Math.max(0, st.alert - 15); st.score += 250;
      st.items.kits++;
      this.log(`Halcón-4 a bordo. «Le debo una, Zhuravl»: le pasa sus mapas y su botiquín. +${sc} ¤, +1 kit, alerta −15.`, COL.yellow);
      const r = 14;
      for (let yy = Math.max(0, y - r); yy < Math.min(map.h, y + r); yy++) for (let xx = Math.max(0, x - r * 2); xx < Math.min(map.w, x + r * 2); xx++) map.seen[yy * map.w + xx] = 1;
      FX.burst(x, y, { n: 16, chars: '+·', cols: [COL.white, COL.yellow, COL.o2], speed: 4 });
      Sound.play('land');
    } else if (it.type === 'cache') {
      delete map.items[idx];
      st.items.flares++; st.items.kits++;
      const m = Gen.module(R, this, { sector: st.sector, bonus: 1 });
      const free = P.cargo.indexOf(null);
      if (free >= 0) P.cargo[free] = m; else this.gainScrap(Math.round(m.value / 3));
      this.log(`Contenedor enganchado: +1 bengala, +1 kit${free >= 0 ? ', ' + modName(m) + ' a la bodega' : ''}.`, COL.yellow);
      FX.burst(x, y, { n: 14, chars: '■*·', speed: 4 });
      Sound.play('pick');
    } else if (it.type === 'wreck' || it.type === 'factory') {
      delete map.items[idx];
      const scrap = this.gainScrap(R.int(3, 9) + (it.type === 'factory' ? 6 : 0));
      if (R.chance(0.15)) { st.items.flares++; this.log('Entre los restos: una caja de bengalas.', COL.yellow); }
      const m = Gen.module(R, this, { sector: st.sector, bonus: it.type === 'factory' ? 1.5 : 0 });
      const free = P.cargo.indexOf(null);
      if (free >= 0) {
        P.cargo[free] = m;
        this.log(`Garfio: ${modName(m)} [${TIERS[m.tier].n}] a la bodega. +${scrap} chatarra.`, COL.o2);
      } else {
        this.gainScrap(Math.round(m.value / 3));
        this.log(`Bodega llena: ${modName(m)} desguazado en vuelo. +${scrap + Math.round(m.value / 3)} chatarra.`, COL.o3);
      }
      FX.burst(x, y, { n: 12, chars: '%*·', speed: 4 });
      FX.text(x, y - 1, '+' + scrap + '¤', COL.o2);
      Sound.play('pick');
    }
  },

  warp() {
    const st = this.st, P = st.plane, R = this.R, map = st.map;
    FX.burst(P.x, P.y, { n: 24, speed: 7, chars: '§·°', cols: [COL.white, COL.purple, COL.dpurple], life: 1.2 });
    for (let k = 0; k < 30; k++) {
      const nx = clamp(P.x + R.int(-8, 8), 2, map.w - 3), ny = clamp(P.y + R.int(-6, 6), 2, map.h - 3);
      const t = TER[map.t[ny * map.w + nx]];
      if (!t.anom && !(t.block && P.alt === 0)) {
        P.x = nx; P.y = ny; P.dx = nx; P.dy = ny;
        break;
      }
    }
    P.h = (P.h + R.int(-1, 1) + 8) % 8;
    this.log('Distorsión espacial: el T-0 reaparece en otro punto. Los instrumentos giran como locos.', COL.purple);
    FX.burst(P.x, P.y, { n: 24, speed: 7, chars: '§·°', cols: [COL.white, COL.purple, COL.dpurple], life: 1.2 });
    FX.ring(P.x, P.y, 4, COL.purple);
    Sound.play('warp');
    this.reveal();
  },

  // ---------- combate ----------
  arcOk(x, y, h, tx, ty, arc) {
    if (arc === 'T') return true;
    if (tx === x && ty === y) return true;
    const hh = arc === 'R' ? (h + 4) % 8 : h;
    const a = Math.atan2(ty - y, tx - x);
    const ha = Math.atan2(DY[hh], DX[hh]);
    let d = Math.abs(a - ha);
    if (d > Math.PI) d = Math.PI * 2 - d;
    return d <= Math.PI * 0.39;
  },
  weaponArc(m, slotIdx) { return m.arc === 'T' ? 'T' : (SLOTS[slotIdx].arc || 'F'); },

  groundList() {
    const map = this.st.map, out = [];
    for (const k in map.ground) { const g = map.ground[k]; out.push({ id: 'g' + k, idx: +k, x: k % map.w, y: (k / map.w) | 0, g }); }
    return out;
  },
  groundById(id) {
    if (typeof id !== 'string' || id[0] !== 'g') return null;
    const k = id.slice(1), g = this.st.map.ground[k];
    return g ? { id, idx: +k, x: k % this.st.map.w, y: (k / this.st.map.w) | 0, g } : null;
  },

  hitChance(w, tgt, S, slotIdx) {
    const P = this.st.plane;
    S = S || this.calc();
    const d = cheb(P.x, P.y, tgt.x, tgt.y);
    let c = w.acc + S.aim + (S.armAcc || 0) - Math.max(0, d - 1) * 3;
    if (!tgt.g && w.anom !== 'certero') c -= (tgt.s || 0) * 4;
    return clamp(Math.round(c), 5, 97);
  },

  // candidatos para un arma
  weaponTargets(w, i, S) {
    const st = this.st, P = st.plane, arc = this.weaponArc(w, i), out = [];
    if (!w.ground) for (const e of st.enemies) {
      if (!this.enemyVisible(e, S)) continue;
      const d = cheb(P.x, P.y, e.x, e.y);
      if (d <= w.range && this.arcOk(P.x, P.y, P.h, e.x, e.y, arc)) out.push({ e, d, id: e.id, x: e.x, y: e.y, s: e.s });
    }
    if (w.ground || P.alt === 0) for (const gg of this.groundList()) {
      if (!st.map.seen[gg.idx]) continue;
      const d = cheb(P.x, P.y, gg.x, gg.y);
      if (d <= w.range && (w.ground || this.arcOk(P.x, P.y, P.h, gg.x, gg.y, arc))) out.push({ g: gg, d, id: gg.id, x: gg.x, y: gg.y, s: 0 });
    }
    return out;
  },

  playerFire(S) {
    const st = this.st, P = st.plane, R = this.R;
    if (st.fireMode === 'hold' || st.evading) return;
    if (S.armOff) { if (this.weaponTargets && st.enemies.length) this.hint('armoff' + st.sector, 'Bus de ARMAS sin energía: las armas no disparan.'); return; }
    let delay = 0, fired = false;
    for (let i = 0; i < SLOTS.length; i++) {
      const w = P.slots[i];
      if (!w || w.cat !== 'arma') continue;
      if (w.ammo != null && w.ammo <= 0) continue;
      const cands = this.weaponTargets(w, i, S);
      if (!cands.length) continue;
      let tgt = cands.find(c => c.id === st.targetId);
      if (!tgt) {
        if (w.ammo != null) continue; // munición limitada: solo al objetivo marcado
        cands.sort((a, b) => a.d - b.d);
        tgt = cands[0];
      }
      if (isCrit(w) && R.chance(0.35)) { this.log(`${modName(w)} se encasquilla.`, COL.yellow); FX.text(P.x, P.y - 1, 'clac', COL.grey); continue; }
      for (let k = 0; k < (w.shots || 1); k++) {
        if (w.ammo != null) { if (w.ammo <= 0) break; w.ammo--; }
        const ch = this.hitChance(w, tgt, S, i);
        const hit = R.next() * 100 < ch;
        const dmg = R.int(w.dmg[0], w.dmg[1]);
        st.stats.shots++;
        st.alert = Math.min(100, st.alert + 1.5);
        fired = true;
        const isRocket = w.kind === 'cohetes', isBomb = w.kind === 'bombas';
        const tx = tgt.x + (hit ? 0 : (Math.random() - 0.5) * 2.5), ty = tgt.y + (hit ? 0 : (Math.random() - 0.5) * 2.5);
        const dl = delay;
        FX.proj(P.x, P.y, tx, ty, {
          delay: dl, dur: isRocket ? 0.35 : isBomb ? 0.3 : 0.16, col: isRocket ? COL.o2 : COL.yellow, ch: isRocket ? '•' : isBomb ? '▼' : null, smoke: isRocket,
          onEnd: () => {
            if (hit) { FX.burst(tx, ty, { n: isRocket || isBomb ? 16 : 6, speed: isRocket || isBomb ? 6 : 3, life: 0.6 }); FX.text(tx, ty - 0.6, '-' + dmg, COL.yellow); Sound.play(isRocket || isBomb ? 'hit' : 'shot'); }
            else FX.text(tx, ty - 0.6, 'fallo', COL.grey);
          },
        });
        if (k === 0) Sound.play(isRocket ? 'rocket' : 'shot', dl);
        delay += 0.09;
        if (hit) {
          st.stats.hits++;
          if (tgt.e) this.damageEnemy(tgt.e, dmg, dl + 0.2);
          else this.damageGround(tgt.g, dmg, dl + 0.2);
        }
        if (tgt.e && !st.enemies.includes(tgt.e)) break;
        if (tgt.g && !st.map.ground[tgt.g.idx]) break;
      }
      if (w.ammo === 0) this.log(`${modName(w)}: sin munición.`, COL.yellow);
    }
    if (fired) this.lock = performance.now() + 230 + delay * 1000;
  },

  damageEnemy(e, dmg, delay = 0) {
    const st = this.st, def = ENEMY[e.type], R = this.R;
    e.hp -= dmg;
    e.aware = Math.max(e.aware, 6);
    if (e.hp > 0) return;
    st.enemies = st.enemies.filter(x => x !== e);
    st.kills++; st.score += def.score; st.sec.kills++;
    const sc = this.gainScrap(def.scrap);
    this.log(`${def.n} derribado. +${sc} chatarra.`, COL.o2);
    FX.explosion(e.x, e.y, def.hp >= 30, delay);
    FX.text(e.x, e.y - 1, '+' + sc + '¤', COL.o2, delay + 0.2);
    Sound.play('boom', delay);
    if (st.targetId === e.id) st.targetId = null;
    // restos al suelo
    const map = st.map, idx = e.y * map.w + e.x;
    if (R.chance(def.anom ? 0.15 : 0.3) && !map.items[idx] && !TER[map.t[idx]].block && !TER[map.t[idx]].water)
      map.items[idx] = { type: 'wreck' };
    if (def.anom && R.chance(0.35) && !map.items[idx]) { map.items[idx] = { type: 'frag' }; this.log('El Eco se disuelve y deja un fragmento.', COL.cyan); }
  },

  damageGround(gg, dmg, delay = 0) {
    const st = this.st, def = GROUND[gg.g.type];
    gg.g.hp -= dmg;
    if (gg.g.hp > 0) return;
    delete st.map.ground[gg.idx];
    st.score += def.score; st.stats.ground++;
    if (gg.g.type === 'radar') st.sec.radars++;
    if (gg.g.type === 'sam') st.sec.sams++;
    const sc = this.gainScrap(def.scrap);
    this.log(`${def.n} destruida. +${sc} chatarra.`, COL.o2);
    FX.explosion(gg.x, gg.y, true, delay);
    Sound.play('boom', delay);
    if (st.targetId === gg.id) st.targetId = null;
  },

  damagePlayer(dmg, src, noArmor) {
    const st = this.st, P = st.plane, R = this.R;
    const parts = [{ i: -1, cov: 22 }];
    if (!noArmor) P.slots.forEach((m, i) => { if (m) parts.push({ i, cov: m.cov }); });
    else P.slots.forEach((m, i) => { if (m && m.cat !== 'blindaje') parts.push({ i, cov: m.cov }); });
    const pick = R.weighted(parts.map(p => [p, p.cov]));
    let crit = false;
    if (R.chance(0.07)) { dmg *= 2; crit = true; }
    st.stats.dmgTaken += dmg;
    FX.shake(crit ? 6 : 3);
    FX.burst(P.x, P.y, { n: crit ? 14 : 7, speed: 4, life: 0.5, cols: [COL.white, COL.red, COL.dred] });
    FX.text(P.x, P.y - 1, (crit ? '¡' : '') + '-' + dmg, COL.red);
    Sound.play('hit');
    if (crit) { FX.flash(0.25); this.log('¡Impacto crítico!', COL.red); }
    if (pick.i < 0) {
      P.structure -= dmg;
      this.log(`Fuselaje alcanzado por ${src}: −${dmg} estructura.`, COL.red);
    } else {
      const m = P.slots[pick.i];
      m.hp -= dmg;
      if (m.hp <= 0) {
        P.slots[pick.i] = null;
        st.stats.modsLost++; st.sec.mods++;
        this.log(`¡${modName(m)} DESTRUIDO por ${src}!`, COL.red);
        FX.explosion(P.x, P.y, false);
        Sound.play('boom');
        const S = this.calc();
        P.fuel = Math.min(P.fuel, S.fuelCap);
        if (m.cat === 'motor' && S.engines === 0) this.log('No quedan motores. El T-0 planea...', COL.red);
      } else {
        this.log(`${modName(m)} alcanzado por ${src}: −${dmg}.`, COL.o3);
        if (isCrit(m) && m.hp + dmg >= m.maxHp * 0.35) this.log(`AVERÍA: ${modName(m)} en estado crítico (${CRIT_TXT[m.cat]}).`, COL.yellow);
      }
    }
    if (P.structure <= 0) { P.structure = 0; this.die(`Derribado por ${src}.`); }
  },

  // ---------- enemigos ----------
  spawnEnemy(type, mode) {
    const st = this.st, P = st.plane, map = st.map, R = this.R, def = ENEMY[type];
    let x, y;
    for (let k = 0; k < 50; k++) {
      if (mode === 'patrol') { x = R.int(30, map.w - 8); y = R.int(4, map.h - 5); }
      else {
        const a = R.float(0, Math.PI * 2), d = R.int(16, 22);
        x = Math.round(P.x + Math.cos(a) * d * 1.3); y = Math.round(P.y + Math.sin(a) * d * 0.7);
      }
      x = clamp(x, 2, map.w - 3); y = clamp(y, 2, map.h - 3);
      if (cheb(x, y, P.x, P.y) >= 10) break;
    }
    const h = mode === 'patrol' ? R.int(0, 7) : this.dirTo(x, y, P.x, P.y);
    const e = {
      id: 'e' + (st.nid++), type, x, y, dx: x, dy: y, h, s: Math.min(2, def.spd), hp: def.hp, maxHp: def.hp,
      aware: mode === 'patrol' ? 0 : 8, wp: null,
    };
    st.enemies.push(e);
    return e;
  },
  dirTo(x, y, tx, ty) {
    const a = Math.atan2(ty - y, tx - x);
    return ((Math.round(a / (Math.PI / 4)) + 2) % 8 + 8) % 8;
  },

  enemiesAct() {
    const st = this.st, P = st.plane, R = this.R, map = st.map;
    const S = this.calc();
    let delay = 0.15;
    for (const e of st.enemies.slice()) {
      if (!st.enemies.includes(e)) continue;
      const def = ENEMY[e.type];
      const d = cheb(e.x, e.y, P.x, P.y);
      let sight = def.sight - (P.alt === 0 ? 3 : 0) - (P.alt === 0 && TER[map.t[P.y * map.w + P.x]].forest ? 2 : 0);
      if (this.inStorm(P.x, P.y)) sight = Math.min(sight, 3);
      if (S.night) sight -= 3;
      if (st.flare) sight = 0;
      if (d <= sight) e.aware = 6;
      const aware = e.aware > 0 || st.alert >= 50;
      if (e.aware > 0) e.aware--;

      // destino deseado
      let tx, ty;
      const px = P.x + DX[P.h] * P.s, py = P.y + DY[P.h] * P.s;
      if (aware) {
        if (def.scout) {
          const ang = Math.atan2(e.y - py, e.x - px);
          tx = px + Math.cos(ang) * 6; ty = py + Math.sin(ang) * 6;
        } else if (e.hp < e.maxHp * 0.25 && !def.anom) {
          tx = e.x + (e.x - P.x) * 2; ty = e.y + (e.y - P.y) * 2;
        } else {
          tx = px - DX[P.h] * 2; ty = py - DY[P.h] * 2;
        }
      } else {
        if (!e.wp || cheb(e.x, e.y, e.wp[0], e.wp[1]) < 3) e.wp = [R.int(10, map.w - 10), R.int(4, map.h - 5)];
        tx = e.wp[0]; ty = e.wp[1];
      }

      // elegir maniobra
      let best = null, bestScore = -1e9;
      for (let turn = -def.man; turn <= def.man; turn++) for (let ds = -1; ds <= 1; ds++) {
        const ns = clamp(e.s + ds, 1, def.spd), nh = (e.h + turn + 8) % 8;
        const ex = clamp(e.x + DX[nh] * ns, 1, map.w - 2), ey = clamp(e.y + DY[nh] * ns, 1, map.h - 2);
        let sc = -Math.hypot(ex - tx, ey - ty);
        if (aware && def.w.length) {
          const w = def.w[0];
          if (cheb(ex, ey, px, py) <= w.range && this.arcOk(ex, ey, nh, px, py, w.arc)) sc += 5;
          if (def.smart && cheb(ex, ey, px, py) <= 4 && this.arcOk(px, py, P.h, ex, ey, 'F')) sc -= 4;
        }
        if (ex === px && ey === py) sc -= 3;
        sc += Math.random() * 0.6;
        if (sc > bestScore) { bestScore = sc; best = { nh, ns, ex, ey }; }
      }
      e.h = best.nh; e.s = best.ns; e.x = best.ex; e.y = best.ey;

      // disparo
      if (aware && def.w.length) {
        for (const w of def.w) {
          const dd = cheb(e.x, e.y, P.x, P.y);
          if (dd > w.range || !this.arcOk(e.x, e.y, e.h, P.x, P.y, w.arc)) continue;
          for (let k = 0; k < w.shots; k++) {
            let ch = w.acc - P.s * 4 - S.ecm - Math.max(0, dd - 1) * 3 - (P.alt === 0 ? 20 : 0) - (st.evading ? 30 : 0) - (st.flare ? 40 : 0);
            ch = clamp(ch, 5, 95);
            const hit = R.next() * 100 < ch;
            const dmg = R.int(w.dmg[0], w.dmg[1]);
            const dl = delay;
            const src = def.n;
            const ox = P.x + (hit ? 0 : (Math.random() - 0.5) * 2.5), oy = P.y + (hit ? 0 : (Math.random() - 0.5) * 2.5);
            FX.proj(e.x, e.y, ox, oy, { delay: dl, dur: 0.16, col: def.anom ? COL.purple : COL.red });
            Sound.play('shot', dl);
            delay += 0.1;
            if (hit) {
              this.damagePlayer(dmg, src);
              if (w.drain) { P.fuel = Math.max(0, P.fuel - w.drain); this.log(`El Eco drena ${w.drain} de combustible.`, COL.purple); }
              if (st.phase !== 'flight') return;
            }
          }
        }
      }
      if (def.scout && d <= def.sight && aware) { st.alert = Math.min(100, st.alert + 4); st._detected = true; }
      // despawn lejano
      if (!aware && d > 45) e.far = (e.far || 0) + 1; else e.far = 0;
      if (e.far > 12) st.enemies = st.enemies.filter(x => x !== e);
    }
    this.lock = Math.max(this.lock, performance.now() + delay * 1000 + 80);
  },

  groundAct(S) {
    const st = this.st, P = st.plane, R = this.R, map = st.map;
    const inStorm = this.inStorm(P.x, P.y);
    const forest = P.alt === 0 && TER[map.t[P.y * map.w + P.x]].forest;
    let delay = 0.3;
    for (const gg of this.groundList()) {
      const d = cheb(P.x, P.y, gg.x, gg.y);
      if (gg.g.type === 'radar') {
        let r = (P.alt ? 14 : 5) * (1 - S.stealth / 100);
        if (forest) r *= 0.5;
        if (inStorm) r = 0;
        if (d <= r) {
          st.alert = Math.min(100, st.alert + 5);
          st._detected = true;
          if (!st.hints['radar' + st.turn]) { st.hints['radar' + st.turn] = 1; }
          if (!gg.g.warned) { gg.g.warned = 1; this.log('Un radar Ж te ha detectado. La alerta aumenta.', COL.red); Sound.play('alarm'); }
        }
      } else if (gg.g.type === 'aa') {
        const def = GROUND.aa;
        if (d > def.range) continue;
        let ch = def.acc + (P.alt === 0 ? 25 : 0) - P.s * 4 - S.ecm - (S.night ? 10 : 0) - (st.evading ? 30 : 0) - (st.flare ? 40 : 0);
        ch = clamp(ch, 5, 90);
        const hit = R.next() * 100 < ch;
        const dmg = R.int(def.dmg[0], def.dmg[1]);
        const ox = P.x + (hit ? 0 : (Math.random() - 0.5) * 3), oy = P.y + (hit ? 0 : (Math.random() - 0.5) * 3);
        const dl = delay;
        FX.proj(gg.x, gg.y, ox, oy, { delay: dl, dur: 0.22, col: COL.red, ch: '°' });
        setTimeout(() => FX.burst(ox, oy, { n: 6, chars: '*·°', speed: 3, life: 0.5, cols: [COL.white, COL.grey, COL.dgrey] }), (dl + 0.22) * 1000);
        Sound.play('shot', dl);
        delay += 0.12;
        if (hit) { this.damagePlayer(dmg, 'fuego antiaéreo'); if (st.phase !== 'flight') return; }
      } else if (gg.g.type === 'sam') {
        const def = GROUND.sam;
        if (gg.g.cd > 0) { gg.g.cd--; continue; }
        if (P.alt !== 1 || d > def.range) continue;
        gg.g.cd = def.reload;
        let ch = def.acc - P.s * 4 - S.ecm - (st.evading ? 30 : 0) - (st.flare ? 40 : 0);
        ch = clamp(ch, 5, 90);
        const hit = R.next() * 100 < ch;
        const dmg = R.int(def.dmg[0], def.dmg[1]);
        const ox = P.x + (hit ? 0 : (Math.random() - 0.5) * 4), oy = P.y + (hit ? 0 : (Math.random() - 0.5) * 4);
        const dl = delay;
        FX.proj(gg.x, gg.y, ox, oy, { delay: dl, dur: 0.55, col: COL.white, ch: '•', smoke: true, onEnd: () => FX.burst(ox, oy, { n: hit ? 16 : 8, speed: 5, life: 0.7 }) });
        Sound.play('rocket', dl);
        if (!gg.g.warned) { gg.g.warned = 1; this.log('¡Lanzamiento de misil! Un SAM Ψ te tiene en el punto de mira. Baja de altitud.', COL.red); }
        delay += 0.3;
        if (hit) { this.damagePlayer(dmg, 'un misil SAM'); if (st.phase !== 'flight') return; }
        else this.log('El misil pasa de largo.', COL.grey);
      }
    }
    this.lock = Math.max(this.lock, performance.now() + delay * 1000);
  },

  inStorm(x, y) {
    for (const s of this.st.map.storms) if (Math.hypot((x - s.x) * 0.7, y - s.y) <= s.r) return true;
    return false;
  },
  stormLevel(x, y) {
    let best = 0;
    for (const s of this.st.map.storms) {
      const d = Math.hypot((x - s.x) * 0.7, y - s.y);
      if (d <= s.r) best = Math.max(best, d < s.r * 0.55 ? 2 : 1);
    }
    return best;
  },

  environment(S) {
    const st = this.st, P = st.plane, R = this.R, map = st.map;
    for (const s of map.storms) {
      s.x += s.vx + (st.wind ? DX[st.wind.d] * 0.2 * st.wind.s : 0); s.y += s.vy + (st.wind ? DY[st.wind.d] * 0.15 * st.wind.s : 0);
      s.x = clamp(s.x, 6, map.w - 6); s.y = clamp(s.y, 3, map.h - 3);
      if (s.x < 8 || s.x > map.w - 8) s.vx *= -1;
      if (s.y < 4 || s.y > map.h - 4) s.vy *= -1;
    }
    if (this.inStorm(P.x, P.y)) {
      this.hint('storm', 'Tormenta: el radar no te ve, pero el granizo golpea el fuselaje.');
      if (R.chance(0.3)) { this.log('Granizo.', COL.storm); this.damagePlayer(R.int(1, 3), 'el granizo'); if (st.phase !== 'flight') return; }
      if (R.chance(0.25) && P.s > 1) { P.s--; this.log('Turbulencia: pierdes velocidad.', COL.storm); }
    }
    // reparación
    if (S.repair > 0) {
      let pts = S.repair;
      const damaged = P.slots.filter(m => m && m.hp < m.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      for (const m of damaged) { if (pts <= 0) break; const k = Math.min(pts, m.maxHp - m.hp); m.hp += k; pts -= k; }
      if (pts > 0 && P.structure < P.maxStructure) P.structure = Math.min(P.maxStructure, P.structure + Math.ceil(pts / 2));
    }
    for (const m of P.slots) if (m && m.anom === 'regen' && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + 2);
    // resonador: revela fragmentos
    if (S.reso) for (const k in map.items) {
      const it = map.items[k];
      if (it.type !== 'frag') continue;
      const x = k % map.w, y = (k / map.w) | 0;
      if (eucl(x, y, P.x, P.y) <= S.reso) map.seen[k] = 1;
    }
  },

  updateAlert() {
    const st = this.st, P = st.plane, def = SECTORS[st.sector], R = this.R;
    if (!st._detected) st.alert = Math.max(0, st.alert - (P.alt === 0 ? 1.5 : 0.75));
    st._detected = false;
    const lvl = Math.floor(st.alert / 25);
    if (lvl > st.alertLvl) {
      st.alertLvl = lvl;
      const n = Math.min(lvl, 3);
      let spawned = 0;
      for (let k = 0; k < n; k++) if (st.enemies.length < def.maxE) { this.spawnEnemy(R.weighted(def.pool), 'wave'); spawned++; }
      if (spawned) {
        this.log(`ALERTA ${lvl * 25}%: la Dirección K envía ${spawned} aparato${spawned > 1 ? 's' : ''}.`, COL.red);
        Sound.play('alarm');
      }
    } else if (st.alert < st.alertLvl * 25 - 12) st.alertLvl = Math.max(0, st.alertLvl - 1);
    if (st.alert >= 75 && st.turn % 9 === 0 && st.enemies.length < def.maxE) {
      this.spawnEnemy(R.weighted(def.pool), 'wave');
      this.log('Más contactos en el radar enemigo.', COL.red);
    }
  },

  // ---------- final de sector / muerte ----------
  land() {
    const st = this.st, P = st.plane;
    st.score += 300;
    const ci = this.contractInfo();
    if (ci && st.contract && !st.contract.paid) {
      st.contract.paid = true;
      if (ci.ok) {
        st.scrap += st.contract.scrap; st.frags += st.contract.frags; st.score += 200;
        st.contract.result = 'ok';
        this.log(`Encargo del Ministerio cumplido: ${ci.reward}.`, COL.green);
      } else { st.contract.result = 'fail'; this.log('Encargo del Ministerio no cumplido.', COL.grey); }
    }
    Sound.play('land');
    FX.burst(P.x, P.y, { n: 20, chars: '·°', cols: [COL.white, COL.grey], speed: 4 });
    if (SECTORS[st.sector].nucleo) {
      st.phase = 'won';
      st.score += 3000 + Math.round(P.structure * 5 + P.fuel * 2);
      st.cause = 'El Núcleo llega a la pista «Rassvet». Misión cumplida.';
      this.finish(true);
      return;
    }
    this.log(`Aterrizaje en ${SECTORS[st.sector].field}.`, COL.o2);
    this.enterHangar();
  },

  die(cause) {
    const st = this.st;
    if (st.phase === 'dead') return;
    st.phase = 'dead';
    st.cause = cause;
    FX.explosion(st.plane.x, st.plane.y, true);
    FX.flash(0.6);
    Sound.play('boom');
    this.finish(false);
  },

  finish(won) {
    const st = this.st;
    st.recordPos = Save.addRecord({
      score: st.score, sector: st.sector + 1, frags: st.stats.frags, kills: st.kills, won,
      date: new Date().toLocaleDateString('es-ES'), cause: st.cause, seed: st.seed,
    });
    Save.clear();
  },

  // ---------- hangar ----------
  enterHangar() {
    const st = this.st, R = this.R;
    st.phase = 'hangar';
    const shop = [];
    for (let k = 0; k < 4; k++) {
      const m = Gen.module(R, this, { sector: st.sector + 1, bonus: 0.5 });
      m.price = Math.round(m.value * 1.6);
      shop.push(m);
    }
    const an = Gen.module(R, this, { sector: st.sector + 1, tier: 4 });
    an.fragPrice = 2 + Math.floor(st.sector / 2);
    shop.push(an);
    const disc = st.perks.includes('contrabandista') ? 0.75 : 1;
    for (const m of shop) if (m.price) m.price = Math.round(m.price * disc);
    const avail = Object.keys(PERKS).filter(k => !st.perks.includes(k));
    R.shuffle(avail);
    st.hangar = { name: SECTORS[st.sector].field, reserve: R.int(30, 55), shop, perkChoices: avail.slice(0, 3), contract: st.contract };
    this.save();
  },
  priceMul() { return this.st.perks.includes('contrabandista') ? 0.75 : 1; },
  choosePerk(k) {
    const st = this.st, P = st.plane;
    if (!st.hangar || !st.hangar.perkChoices || !st.hangar.perkChoices.includes(k)) return;
    st.perks.push(k);
    st.hangar.perkChoices = null;
    if (k === 'estibador') P.cargo.push(null, null);
    if (k === 'temple') { P.maxStructure += 25; P.structure += 25; }
    this.log(`Nuevo talento: ${PERKS[k].n}.`, COL.yellow);
    Sound.play('frag');
    this.save();
  },
  consumablePrice(k) { return Math.round(CONSUMABLES[k].price * this.priceMul()); },
  buyConsumable(k) {
    const st = this.st, p = this.consumablePrice(k);
    if (st.scrap < p) { Sound.play('deny'); return false; }
    st.scrap -= p; st.items[k]++;
    Sound.play('pick');
    this.save();
    return true;
  },
  upgradeCost(m) {
    if (!m || m.anom || m.tier >= 3) return null;
    return Math.round([12, 22, 36][m.tier] * this.priceMul());
  },
  upgrade(src) {
    const st = this.st, m = this.getMod(src), cost = this.upgradeCost(m);
    if (cost == null || st.scrap < cost || src.from === 'shop') { Sound.play('deny'); return false; }
    st.scrap -= cost;
    const r = TIERS[m.tier + 1].mult / TIERS[m.tier].mult;
    if (m.thrust) m.thrust = Math.round(m.thrust * r * 10) / 10;
    if (m.cons) m.cons = Math.round(m.cons * 0.95 * 100) / 100;
    if (m.cap) m.cap = Math.round(m.cap * r);
    if (m.dmg) { m.dmg = [Math.round(m.dmg[0] * r) || 1, Math.max(Math.round(m.dmg[1] * r), Math.round(m.dmg[0] * r) || 1)]; m.acc += 5; }
    if (m.maxAmmo && m.tier + 1 >= 3) { m.maxAmmo += 2; m.ammo += 2; }
    if (m.sys) for (const k in m.sys) if (!['man', 'grab', 'burner', 'repair'].includes(k)) m.sys[k] = Math.round(m.sys[k] * r);
    const gain = Math.round(m.maxHp * (m.cat === 'blindaje' ? r - 1 : 0.1));
    m.maxHp += gain; m.hp = Math.min(m.maxHp, m.hp + gain);
    if (m.tier === 0) m.quirks = m.quirks.filter(q => QUIRKS[q].good);
    m.tier++;
    m.value = Math.round(m.value * 1.4);
    this.log(`Taller: ${modName(m)} mejorado a ${TIERS[m.tier].n}.`, COL.o2);
    Sound.play('land');
    this.save();
    return true;
  },

  repairCost() {
    const P = this.st.plane;
    let miss = P.maxStructure - P.structure;
    for (const m of P.slots) if (m) miss += m.maxHp - m.hp;
    for (const m of P.cargo) if (m) miss += m.maxHp - m.hp;
    return Math.ceil(miss / 3);
  },
  repairAll() {
    const st = this.st, P = st.plane;
    let cost = this.repairCost();
    if (!cost) return false;
    let budget = st.scrap * 3;
    const fix = (cur, max) => { const k = Math.min(max - cur, budget); budget -= k; return cur + k; };
    P.structure = fix(P.structure, P.maxStructure);
    for (const m of P.slots.concat(P.cargo)) if (m) m.hp = fix(m.hp, m.maxHp);
    const spent = Math.ceil((st.scrap * 3 - budget) / 3);
    st.scrap -= Math.min(st.scrap, spent);
    this.save();
    return true;
  },
  refuelInfo() {
    const st = this.st, S = this.calc();
    const need = Math.max(0, S.fuelCap - st.plane.fuel);
    const free = Math.min(need, st.hangar.reserve);
    const paid = need - free;
    return { need, free, paid, cost: Math.ceil(paid / 2) };
  },
  refuel() {
    const st = this.st, P = st.plane, info = this.refuelInfo();
    if (info.need <= 0) return false;
    P.fuel += info.free; st.hangar.reserve -= info.free;
    const afford = Math.min(info.paid, st.scrap * 2);
    P.fuel += afford; st.scrap -= Math.ceil(afford / 2);
    P.fuel = Math.min(P.fuel, this.calc().fuelCap);
    this.save();
    return true;
  },
  rearmCost() {
    let c = 0;
    for (const m of this.st.plane.slots.concat(this.st.plane.cargo)) if (m && m.maxAmmo) c += (m.maxAmmo - m.ammo) * (m.kind === 'bombas' ? 3 : 2);
    return c;
  },
  rearm() {
    const st = this.st;
    for (const m of st.plane.slots.concat(st.plane.cargo)) if (m && m.maxAmmo) {
      const unit = m.kind === 'bombas' ? 3 : 2;
      while (m.ammo < m.maxAmmo && st.scrap >= unit) { m.ammo++; st.scrap -= unit; }
    }
    this.save();
  },

  takeOff() {
    const st = this.st;
    st.sector++;
    st.hangar = null;
    this.startSector();
  },

  // ---------- inventario (drag & drop) ----------
  // src: {from:'slot'|'cargo'|'shop', i}   dst: {to:'slot'|'cargo'|'scrap'|'eject', i}
  getMod(src) {
    const st = this.st;
    if (src.from === 'slot') return st.plane.slots[src.i];
    if (src.from === 'cargo') return st.plane.cargo[src.i];
    if (src.from === 'shop') return st.hangar && st.hangar.shop[src.i];
    return null;
  },
  canMove(src, dst) {
    const st = this.st, P = st.plane, m = this.getMod(src);
    if (!m) return false;
    if (src.from === dst.to && src.i === dst.i) return false;
    if (dst.to === 'scrap' || dst.to === 'eject') return src.from !== 'shop';
    if (src.from === 'shop') {
      if (m.fragPrice ? st.frags < m.fragPrice : st.scrap < m.price) return false;
      if (dst.to === 'slot') return SLOTS[dst.i].cat === m.cat && (!P.slots[dst.i] || P.cargo.includes(null));
      if (dst.to === 'cargo') return !P.cargo[dst.i];
      return false;
    }
    if (dst.to === 'slot') {
      if (SLOTS[dst.i].cat !== m.cat) return false;
      const other = P.slots[dst.i];
      if (src.from === 'cargo') return true;
      if (src.from === 'slot') return true;
      return !!other || true;
    }
    if (dst.to === 'cargo') {
      const other = P.cargo[dst.i];
      if (!other) return true;
      if (src.from === 'cargo') return true;
      if (src.from === 'slot') return other.cat === m.cat;
    }
    return false;
  },
  move(src, dst) {
    if (!this.canMove(src, dst)) return false;
    const st = this.st, P = st.plane, m = this.getMod(src);
    const take = () => {
      if (src.from === 'slot') P.slots[src.i] = null;
      else if (src.from === 'cargo') P.cargo[src.i] = null;
    };
    if (dst.to === 'scrap') {
      take();
      const v = Math.max(1, Math.round(m.value / 3 * (0.4 + 0.6 * m.hp / m.maxHp)));
      st.scrap += v;
      this.log(`${modName(m)} desguazado: +${v} chatarra.`, COL.o3);
    } else if (dst.to === 'eject') {
      take();
      this.log(`${modName(m)} eyectado. Se pierde en la taiga.`, COL.o3);
      FX.burst(P.x, P.y, { n: 8, chars: '%·', speed: 3 });
    } else if (src.from === 'shop') {
      if (m.fragPrice) st.frags -= m.fragPrice; else st.scrap -= m.price;
      st.hangar.shop[src.i] = null;
      delete m.price; delete m.fragPrice;
      if (dst.to === 'slot') {
        const old = P.slots[dst.i];
        if (old) P.cargo[P.cargo.indexOf(null)] = old;
        P.slots[dst.i] = m;
      } else P.cargo[dst.i] = m;
      this.log(`Adquirido: ${modName(m)}.`, COL.o2);
    } else {
      const arr = dst.to === 'slot' ? P.slots : P.cargo;
      const other = arr[dst.i];
      take();
      arr[dst.i] = m;
      if (other) {
        if (src.from === 'slot') P.slots[src.i] = other;
        else P.cargo[src.i] = other;
      }
    }
    const S = this.calc();
    P.fuel = Math.min(P.fuel, S.fuelCap);
    this.fixPower();
    return true;
  },
  // en vuelo: la reconfiguración cuesta un turno
  flightMove(src, dst) {
    if (!this.canAct()) return false;
    if (!this.move(src, dst)) return false;
    if (dst.to !== 'eject') {
      this.log('Reconfiguración en vuelo: el T-0 mantiene rumbo y velocidad este turno.', COL.grey);
      const opts = this.options();
      const o = opts.find(x => x.turn === 0 && x.thr === 0) || opts[0];
      this.doTurn(o);
    } else this.save();
    return true;
  },
  autoEquip(ci) {
    const P = this.st.plane, m = P.cargo[ci];
    if (!m) return null;
    let slot = SLOTS.findIndex((s, i) => s.cat === m.cat && !P.slots[i]);
    if (slot < 0) slot = SLOTS.findIndex(s => s.cat === m.cat);
    return slot < 0 ? null : { from: 'cargo', i: ci, dst: { to: 'slot', i: slot } };
  },

  cycleTarget() {
    const st = this.st, P = st.plane, S = this.calc();
    const list = st.enemies.filter(e => this.isVisible(e.x, e.y, S)).map(e => ({ id: e.id, d: cheb(P.x, P.y, e.x, e.y) }));
    for (const gg of this.groundList()) if (st.map.seen[gg.idx] && this.isVisible(gg.x, gg.y, S)) list.push({ id: gg.id, d: cheb(P.x, P.y, gg.x, gg.y) });
    if (!list.length) { st.targetId = null; return; }
    list.sort((a, b) => a.d - b.d);
    const i = list.findIndex(t => t.id === st.targetId);
    st.targetId = list[(i + 1) % list.length].id;
    Sound.play('click');
  },
};
