'use strict';
// UI en modo inmediato sobre la rejilla: regiones, botones con rollover, tooltips y drag & drop.

const UI = {
  m: { cx: -1, cy: -1, px: 0, py: 0, down: false },
  regions: [], cur: [], pressed: null, drag: null, tip: null, disabled: false, cursor: 'default',

  begin() { this.regions = this.cur; this.cur = []; this.tip = null; this.cursor = 'default'; },

  hit(x, y, w, h) {
    const m = this.m;
    return !this.disabled && m.cx >= x && m.cx < x + w && m.cy >= y && m.cy < y + h;
  },

  // o: { onClick, onRight, drag: {payload, label, col}, drop: {accept(p), onDrop(p)} }
  region(x, y, w, h, o) {
    if (this.disabled) return false;
    this.cur.push(Object.assign({ x, y, w, h }, o));
    const hov = this.hit(x, y, w, h);
    if (hov && (o.onClick || o.drag)) this.cursor = 'pointer';
    return hov;
  },

  // ¿hay un arrastre aceptable sobre este rectángulo?
  dropHover(x, y, w, h, accept) {
    return !!(this.drag && this.hit(x, y, w, h) && accept(this.drag.payload));
  },

  button(x, y, label, o = {}) {
    const w = o.w || label.length + 4;
    const dis = !!o.disabled;
    const hov = !dis && this.hit(x, y, w, 1);
    const col = o.col || COL.o1;
    const fg = dis ? COL.dgrey : hov ? COL.bg : col;
    const bg = hov ? col : (o.bg || null);
    const inner = label.length + 2 <= w - 2 ? label : label.slice(0, Math.max(0, w - 4));
    const padL = Math.floor((w - 2 - inner.length) / 2);
    let s = '[' + ' '.repeat(padL) + inner;
    s += ' '.repeat(Math.max(0, w - 1 - s.length)) + ']';
    if (bg) for (let i = 0; i < w; i++) Term.put(x + i, y, ' ', fg, bg);
    Term.text(x, y, s, fg, bg || undefined);
    if (hov && o.blink !== false) {
      const t = performance.now() / 1000;
      Term.put(x, y, t % 0.8 < 0.4 ? '►' : '[', fg, bg);
    }
    if (!dis) this.region(x, y, w, 1, { onClick: () => { Sound.play('click'); o.onClick && o.onClick(); } });
    if (hov && o.tip) this.tip = o.tip;
    return hov;
  },

  // tooltip: array de líneas (texto con marcado {c}..{/}) y título opcional
  setTip(lines, title, col) { this.tip = { lines, title, col }; },

  drawTip() {
    let tip = this.tip;
    if (!tip || this.drag) return;
    if (Array.isArray(tip)) tip = { lines: tip };
    else if (typeof tip === 'string') tip = { lines: Term.wrap(tip, 44) };
    const lines = tip.lines;
    let w = tip.title ? Term.richLen(tip.title) + 6 : 0;
    for (const l of lines) w = Math.max(w, Term.richLen(l) + 4);
    w = Math.min(w, Term.cols - 2);
    const h = lines.length + 2;
    let x = this.m.cx + 2, y = this.m.cy + 1;
    if (x + w > Term.cols) x = this.m.cx - w - 1;
    if (x < 0) x = 0;
    if (y + h > Term.rows) y = Math.max(0, Term.rows - h);
    Term.layer('top');
    Term.box(x, y, w, h, tip.col || COL.o3, COL.panel2, tip.title, tip.col || COL.o2);
    lines.forEach((l, j) => Term.rich(x + 2, y + 1 + j, l, COL.cream, COL.panel2, w - 4));
    Term.layer('base');
  },

  drawDrag() {
    const d = this.drag;
    if (!d) return;
    Term.layer('top');
    const s = ' ' + d.label + ' ';
    const x = Math.min(this.m.cx + 1, Term.cols - s.length);
    Term.text(x, this.m.cy, s, COL.bg, d.col || COL.o2);
    Term.put(this.m.cx, this.m.cy, '◘', d.col || COL.o2, COL.panel2);
    Term.layer('base');
  },

  findAt(cx, cy, pred) {
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i];
      if (cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h && pred(r)) return r;
    }
    return null;
  },

  onMove(e) {
    const c = Term.cellAt(e.clientX, e.clientY);
    if (c.cx !== this.m.cx || c.cy !== this.m.cy) this.m.t = performance.now() / 1000;
    Object.assign(this.m, c);
    const p = this.pressed;
    if (p && p.r.drag && !this.drag && Math.hypot(c.px - p.px, c.py - p.py) > 6) {
      this.drag = Object.assign({}, p.r.drag);
      Sound.play('pick');
    }
  },
  onDown(e) {
    const c = Term.cellAt(e.clientX, e.clientY);
    Object.assign(this.m, c);
    this.m.down = true;
    if (e.button !== 0) return;
    const r = this.findAt(c.cx, c.cy, r => r.drag || r.onClick);
    this.pressed = r ? { r, px: c.px, py: c.py } : null;
  },
  onUp(e) {
    const c = Term.cellAt(e.clientX, e.clientY);
    Object.assign(this.m, c);
    this.m.down = false;
    if (this.drag) {
      const d = this.drag;
      this.drag = null; this.pressed = null;
      const r = this.findAt(c.cx, c.cy, r => r.drop && r.drop.accept(d.payload));
      if (r) { r.drop.onDrop(d.payload); Sound.play('drop'); }
      return;
    }
    if (e.button === 2) {
      const r = this.findAt(c.cx, c.cy, r => r.onRight);
      if (r) r.onRight();
      this.pressed = null;
      return;
    }
    const p = this.pressed;
    this.pressed = null;
    if (!p) return;
    const r = this.findAt(c.cx, c.cy, r => r.onClick);
    if (r && r.onClick && (r === p.r || (r.x === p.r.x && r.y === p.r.y))) r.onClick();
  },
};
