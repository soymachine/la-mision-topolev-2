'use strict';
// Efectos visuales: partículas ASCII, trazadoras, textos flotantes, destellos y temblor.
// Coordenadas en "celdas de mundo" (floats); la vista convierte a píxeles.

const FX = {
  parts: [], projs: [], texts: [], rings: [], shakeA: 0, time: 0,

  reset() { this.parts.length = 0; this.projs.length = 0; this.texts.length = 0; this.rings.length = 0; },

  burst(x, y, o = {}) {
    const n = o.n || 14;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed || 6) * (0.3 + Math.random() * 0.9);
      const life = (o.life || 0.9) * (0.5 + Math.random() * 0.7);
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.75, life, max: life,
        ch: (o.chars || '*+·°')[Math.floor(Math.random() * (o.chars || '*+·°').length)],
        cols: o.cols || [COL.white, COL.yellow, COL.o2, COL.o1, COL.o3, COL.o5],
        drag: o.drag || 2.2, grav: o.grav || 0, delay: o.delay || 0, glow: o.glow !== false,
      });
    }
  },
  explosion(x, y, big, delay = 0) {
    this.burst(x, y, { n: big ? 40 : 18, speed: big ? 10 : 6, life: big ? 1.4 : 0.9, delay });
    this.burst(x, y, { n: big ? 16 : 6, speed: 2, life: big ? 2.2 : 1.4, chars: '░▒·', cols: [COL.grey, COL.dgrey, '#2a2018'], glow: false, grav: -0.6, delay });
    this.ring(x, y, big ? 4 : 2, COL.o2, delay);
    this.shake(big ? 7 : 3, delay);
  },
  ring(x, y, r, col, delay = 0) { this.rings.push({ x, y, r, col, t: -delay, dur: 0.45 }); },
  sparkle(x, y, col) {
    this.parts.push({ x: x + (Math.random() - 0.5), y: y + (Math.random() - 0.5), vx: 0, vy: -0.6, life: 0.7, max: 0.7, ch: Math.random() < 0.5 ? '·' : '+', cols: [COL.white, col, col], drag: 0, grav: 0, delay: 0, glow: true });
  },
  trail(x, y, col, ch = '·') {
    this.parts.push({ x: x + (Math.random() - 0.5) * 0.3, y: y + (Math.random() - 0.5) * 0.3, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, life: 0.8, max: 0.8, ch, cols: [COL.yellow, col || COL.o1, COL.o3, COL.o5], drag: 1, grav: 0, delay: 0, glow: true });
  },
  // proyectil trazador de (x0,y0) a (x1,y1)
  proj(x0, y0, x1, y1, o = {}) {
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const a8 = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
    const ch = o.ch || ['─', '\\', '│', '/', '─', '\\', '│', '/'][a8];
    this.projs.push({ x0, y0, x1, y1, t: -(o.delay || 0), dur: o.dur || 0.2, ch, col: o.col || COL.yellow, hit: o.hit, smoke: o.smoke, onEnd: o.onEnd, done: false });
  },
  text(x, y, s, col, delay = 0) { this.texts.push({ x, y, s, col, t: -delay, dur: 1.3 }); },
  shake(a, delay = 0) {
    if (delay > 0) { setTimeout(() => { this.shakeA = Math.max(this.shakeA, a); }, delay * 1000); return; }
    this.shakeA = Math.max(this.shakeA, a);
  },
  flash(op = 0.35) {
    const el = document.getElementById('flash');
    if (!el) return;
    el.style.transition = 'none'; el.style.opacity = op;
    requestAnimationFrame(() => { el.style.transition = 'opacity 0.4s ease-out'; el.style.opacity = 0; });
  },

  update(dt) {
    this.time += dt;
    for (const p of this.parts) {
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.life -= dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy = p.vy * d + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const q of this.projs) {
      q.t += dt;
      if (q.t >= 0 && q.smoke && Math.random() < 0.7) {
        const k = clamp(q.t / q.dur, 0, 1);
        this.parts.push({ x: q.x0 + (q.x1 - q.x0) * k, y: q.y0 + (q.y1 - q.y0) * k, vx: 0, vy: -0.3, life: 0.6, max: 0.6, ch: '·', cols: [COL.grey, COL.dgrey], drag: 1, grav: 0, delay: 0, glow: false });
      }
      if (q.t >= q.dur && !q.done) { q.done = true; if (q.onEnd) q.onEnd(); }
    }
    this.projs = this.projs.filter(q => !q.done);
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter(t => t.t < t.dur);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter(r => r.t < r.dur);
    if (this.shakeA > 0.05) {
      this.shakeA *= Math.exp(-9 * dt);
      const el = document.getElementById('screen');
      el.style.transform = `translate(${((Math.random() - 0.5) * this.shakeA).toFixed(1)}px,${((Math.random() - 0.5) * this.shakeA).toFixed(1)}px)`;
    } else if (this.shakeA !== 0) {
      this.shakeA = 0;
      document.getElementById('screen').style.transform = '';
    }
  },

  // view: { ox, oy, camX, camY, w, h }  (ox/oy en celdas de pantalla; w/h tamaño de la vista en celdas)
  draw(ctx, v) {
    const cw = Term.cw, chh = Term.ch, z = v.z || 1;
    const toPx = (wx, wy) => [(v.ox + (wx - v.camX + 0.5) * z) * cw, (v.oy + (wy - v.camY + 0.5) * z) * chh];
    ctx.save();
    ctx.beginPath(); ctx.rect(v.ox * cw, v.oy * chh, v.w * cw, v.h * chh); ctx.clip();
    ctx.font = z > 1 ? Term.fontBig : Term.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const r of this.rings) {
      if (r.t < 0) continue;
      const k = r.t / r.dur;
      const [px, py] = toPx(r.x, r.y);
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.col; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(px, py, r.r * z * cw * k * 1.3 + 2, r.r * z * chh * k * 0.75 + 2, 0, 0, Math.PI * 2); ctx.stroke();
    }
    for (const p of this.parts) {
      if (p.delay > 0) continue;
      const k = 1 - p.life / p.max;
      const col = p.cols[Math.min(p.cols.length - 1, Math.floor(k * p.cols.length))];
      const [px, py] = toPx(p.x, p.y);
      ctx.globalAlpha = clamp(p.life / p.max * 1.4, 0, 1);
      ctx.fillStyle = col;
      if (p.glow) { ctx.shadowColor = col; ctx.shadowBlur = 6; } else ctx.shadowBlur = 0;
      ctx.fillText(p.ch, px, py);
    }
    ctx.shadowBlur = 0;
    for (const q of this.projs) {
      if (q.t < 0) continue;
      const k = clamp(q.t / q.dur, 0, 1);
      const [px, py] = toPx(q.x0 + (q.x1 - q.x0) * k, q.y0 + (q.y1 - q.y0) * k);
      ctx.globalAlpha = 1; ctx.fillStyle = q.col; ctx.shadowColor = q.col; ctx.shadowBlur = 10;
      ctx.fillText(q.ch, px, py);
      const [qx, qy] = toPx(q.x0 + (q.x1 - q.x0) * Math.max(0, k - 0.15), q.y0 + (q.y1 - q.y0) * Math.max(0, k - 0.15));
      ctx.globalAlpha = 0.4; ctx.fillText('·', qx, qy);
    }
    ctx.shadowBlur = 0;
    for (const t of this.texts) {
      if (t.t < 0) continue;
      const k = t.t / t.dur;
      const [px, py] = toPx(t.x, t.y - k * 1.8);
      ctx.globalAlpha = clamp(1.6 - k * 1.6, 0, 1);
      ctx.fillStyle = '#000'; ctx.fillText(t.s, px + 1, py + 1);
      ctx.fillStyle = t.col; ctx.fillText(t.s, px, py);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  },
};
