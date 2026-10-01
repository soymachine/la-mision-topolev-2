'use strict';
// Terminal ASCII sobre canvas: capa base (render diferencial), capa fx (partículas) y capa superior (overlay).

const Term = (() => {
  const T = { cols: 0, rows: 0, cw: 9, ch: 16, fs: 13, zoom: 0, ox: 0, oy: 0, font: '' };
  let cvB, cvF, cvT, cB, cF, cT, dpr = 1;
  let CH = [], FG = [], BG = [], PCH = [], PFG = [], PBG = [];
  const ov = new Map();
  let layer = 0, dirtyAll = true;

  // [arriba, abajo, izquierda, derecha]: 0 nada, 1 simple, 2 doble
  const BOX = {
    '─': [0, 0, 1, 1], '│': [1, 1, 0, 0], '┌': [0, 1, 0, 1], '┐': [0, 1, 1, 0], '└': [1, 0, 0, 1], '┘': [1, 0, 1, 0],
    '├': [1, 1, 0, 1], '┤': [1, 1, 1, 0], '┬': [0, 1, 1, 1], '┴': [1, 0, 1, 1], '┼': [1, 1, 1, 1],
    '═': [0, 0, 2, 2], '║': [2, 2, 0, 0], '╔': [0, 2, 0, 2], '╗': [0, 2, 2, 0], '╚': [2, 0, 0, 2], '╝': [2, 0, 2, 0],
    '╠': [2, 2, 0, 2], '╣': [2, 2, 2, 0], '╦': [0, 2, 2, 2], '╩': [2, 0, 2, 2], '╬': [2, 2, 2, 2],
    '╪': [1, 1, 2, 2], '╫': [2, 2, 1, 1], '╞': [1, 1, 0, 2], '╡': [1, 1, 2, 0], '╥': [0, 2, 1, 1], '╨': [2, 0, 1, 1],
    '╤': [0, 1, 2, 2], '╧': [1, 0, 2, 2],
  };

  T.init = function () {
    cvB = document.getElementById('base'); cvF = document.getElementById('fx'); cvT = document.getElementById('top');
    cB = cvB.getContext('2d'); cF = cvF.getContext('2d'); cT = cvT.getContext('2d');
    T.resize();
  };

  T.resize = function () {
    dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth, H = window.innerHeight;
    let ch = Math.floor(Math.min(H / 46, W / (134 * 0.6)));
    ch = clamp(ch + T.zoom, 10, 32);
    const fs = Math.round(ch * 0.8);
    T.font = `${fs}px "IBM Plex Mono", "DejaVu Sans Mono", Menlo, Consolas, monospace`;
    cB.font = T.font;
    let cw = Math.round(cB.measureText('M').width);
    if (!(cw >= 5)) cw = Math.round(fs * 0.6);
    T.cw = cw; T.ch = ch; T.fs = fs;
    T.cols = Math.floor(W / cw); T.rows = Math.floor(H / ch);
    const pw = T.cols * cw, ph = T.rows * ch;
    T.ox = Math.floor((W - pw) / 2); T.oy = Math.floor((H - ph) / 2);
    for (const cv of [cvB, cvF, cvT]) {
      cv.width = Math.round(pw * dpr); cv.height = Math.round(ph * dpr);
      cv.style.width = pw + 'px'; cv.style.height = ph + 'px';
      cv.style.left = T.ox + 'px'; cv.style.top = T.oy + 'px';
    }
    for (const c of [cB, cF, cT]) {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.font = T.font; c.textAlign = 'center'; c.textBaseline = 'middle';
    }
    const n = T.cols * T.rows;
    CH = new Array(n).fill(' '); FG = new Array(n).fill(COL.o1); BG = new Array(n).fill(COL.bg);
    PCH = new Array(n).fill(null); PFG = new Array(n).fill(null); PBG = new Array(n).fill(null);
    dirtyAll = true;
  };

  T.beginFrame = function () { ov.clear(); layer = 0; };
  T.layer = function (l) { layer = l === 'top' ? 1 : 0; };
  T.clear = function (bg = COL.bg) {
    if (layer) { ov.clear(); return; }
    CH.fill(' '); FG.fill(COL.o1); BG.fill(bg);
  };

  T.put = function (x, y, c, fg, bg) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= T.cols || y >= T.rows) return;
    const i = y * T.cols + x;
    if (layer) {
      const prev = ov.get(i);
      ov.set(i, { c, fg: fg || COL.o1, bg: bg || (prev && prev.bg) || COL.panel });
      return;
    }
    CH[i] = c; if (fg) FG[i] = fg; if (bg) BG[i] = bg;
  };
  T.setBg = function (x, y, bg) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= T.cols || y >= T.rows) return;
    const i = y * T.cols + x;
    if (layer) { const p = ov.get(i); if (p) p.bg = bg; else ov.set(i, { c: CH[i], fg: FG[i], bg }); return; }
    BG[i] = bg;
  };
  T.getCh = function (x, y) { return CH[y * T.cols + x]; };

  T.text = function (x, y, s, fg, bg, maxW) {
    s = String(s);
    if (maxW != null && s.length > maxW) s = maxW <= 1 ? s.slice(0, maxW) : s.slice(0, maxW - 1) + '…';
    for (let k = 0; k < s.length; k++) T.put(x + k, y, s[k], fg, bg);
    return s.length;
  };

  const RC = () => ({
    c: COL.cyan, r: COL.red, y: COL.yellow, w: COL.white, p: COL.purple, o: COL.o1, b: COL.o2, m: COL.o3,
    d: COL.o4, g: COL.grey, k: COL.cream, s: COL.storm, n: COL.green,
  });
  let rcCache = null;
  T.rich = function (x, y, s, fg, bg, maxW) {
    if (!rcCache) rcCache = RC();
    let col = fg, cx = x;
    const parts = String(s).split(/\{([a-z/])\}/);
    for (let k = 0; k < parts.length; k++) {
      if (k % 2 === 1) { col = parts[k] === '/' ? fg : (rcCache[parts[k]] || fg); continue; }
      let p = parts[k];
      if (maxW != null) { const rem = x + maxW - cx; if (rem <= 0) break; if (p.length > rem) p = p.slice(0, rem); }
      T.text(cx, y, p, col, bg); cx += p.length;
    }
    return cx - x;
  };
  T.richLen = s => String(s).replace(/\{([a-z/])\}/g, '').length;

  T.wrap = function (s, w) {
    const out = [];
    for (const para of String(s).split('\n')) {
      if (para === '') { out.push(''); continue; }
      let line = '', lineLen = 0;
      for (const word of para.split(' ')) {
        const wl = T.richLen(word);
        if (lineLen && lineLen + 1 + wl > w) { out.push(line); line = word; lineLen = wl; }
        else { line = lineLen ? line + ' ' + word : (line + word); lineLen += (lineLen ? 1 : 0) + wl; }
      }
      out.push(line);
    }
    return out;
  };

  T.fill = function (x, y, w, h, c = ' ', fg, bg) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) T.put(x + i, y + j, c, fg, bg);
  };

  T.box = function (x, y, w, h, fg = COL.o4, bg, title, tcol, dbl) {
    const S = dbl ? ['═', '║', '╔', '╗', '╚', '╝'] : ['─', '│', '┌', '┐', '└', '┘'];
    if (bg) T.fill(x, y, w, h, ' ', fg, bg);
    for (let i = 1; i < w - 1; i++) { T.put(x + i, y, S[0], fg, bg); T.put(x + i, y + h - 1, S[0], fg, bg); }
    for (let j = 1; j < h - 1; j++) { T.put(x, y + j, S[1], fg, bg); T.put(x + w - 1, y + j, S[1], fg, bg); }
    T.put(x, y, S[2], fg, bg); T.put(x + w - 1, y, S[3], fg, bg);
    T.put(x, y + h - 1, S[4], fg, bg); T.put(x + w - 1, y + h - 1, S[5], fg, bg);
    if (title) {
      T.put(x + 1, y, dbl ? '╡' : '┤', fg, bg);
      const n = T.rich(x + 2, y, ' ' + title + ' ', tcol || COL.o2, bg);
      T.put(x + 2 + n, y, dbl ? '╞' : '├', fg, bg);
    }
  };
  T.hline = function (x, y, w, fg, bg, c = '─') { for (let i = 0; i < w; i++) T.put(x + i, y, c, fg, bg); };

  T.bar = function (x, y, w, frac, fg, ec = COL.o6, bg) {
    const f = clamp(frac, 0, 1) * w;
    for (let i = 0; i < w; i++) {
      const v = f - i;
      T.put(x + i, y, v >= 1 ? '█' : v >= 0.5 ? '▓' : v > 0 ? '▒' : '░', v > 0 ? fg : ec, bg);
    }
  };

  // ---- dibujo de celdas ----
  function glyph(ctx, x, y, c, fg) {
    if (c === ' ') return;
    const cw = T.cw, ch = T.ch;
    const b = BOX[c];
    if (b) {
      ctx.fillStyle = fg;
      const lw = Math.max(1, Math.round(ch / 15));
      const cx = x + Math.floor(cw / 2) - (lw >> 1), cy = y + Math.floor(ch / 2) - (lw >> 1);
      const ov = Math.max(2, Math.round(cw / 5)), oh = Math.max(2, Math.round(ch / 8));
      if (b[0] === 1) ctx.fillRect(cx, y, lw, cy - y + lw);
      else if (b[0] === 2) { ctx.fillRect(cx - ov, y, lw, cy - y + lw); ctx.fillRect(cx + ov, y, lw, cy - y + lw); }
      if (b[1] === 1) ctx.fillRect(cx, cy, lw, y + ch - cy);
      else if (b[1] === 2) { ctx.fillRect(cx - ov, cy, lw, y + ch - cy); ctx.fillRect(cx + ov, cy, lw, y + ch - cy); }
      if (b[2] === 1) ctx.fillRect(x, cy, cx - x + lw, lw);
      else if (b[2] === 2) { ctx.fillRect(x, cy - oh, cx - x + lw, lw); ctx.fillRect(x, cy + oh, cx - x + lw, lw); }
      if (b[3] === 1) ctx.fillRect(cx, cy, x + cw - cx, lw);
      else if (b[3] === 2) { ctx.fillRect(cx, cy - oh, x + cw - cx, lw); ctx.fillRect(cx, cy + oh, x + cw - cx, lw); }
      return;
    }
    switch (c) {
      case '█': ctx.fillStyle = fg; ctx.fillRect(x, y + 1, cw, ch - 2); return;
      case '▓': ctx.fillStyle = fg; ctx.globalAlpha = 0.62; ctx.fillRect(x, y + 1, cw, ch - 2); ctx.globalAlpha = 1; return;
      case '▒': ctx.fillStyle = fg;
        for (let j = 1; j < ch - 1; j += 2) for (let i = (j >> 1) & 1; i < cw; i += 2) ctx.fillRect(x + i, y + j, 1, 1);
        return;
      case '░': ctx.fillStyle = fg;
        for (let j = 2; j < ch - 1; j += 3) for (let i = ((j / 3) | 0) % 2 ? 1 : 2; i < cw; i += 3) ctx.fillRect(x + i, y + j, 1, 1);
        return;
      case '▀': ctx.fillStyle = fg; ctx.fillRect(x, y, cw, ch >> 1); return;
      case '▄': ctx.fillStyle = fg; ctx.fillRect(x, y + (ch >> 1), cw, ch - (ch >> 1)); return;
      case '▌': ctx.fillStyle = fg; ctx.fillRect(x, y, cw >> 1, ch); return;
      case '▐': ctx.fillStyle = fg; ctx.fillRect(x + (cw >> 1), y, cw - (cw >> 1), ch); return;
    }
    ctx.fillStyle = fg;
    ctx.fillText(c, x + cw / 2, y + ch / 2 + 1);
  }
  T.glyph = glyph;

  function drawCell(ctx, i, c, fg, bg) {
    const x = (i % T.cols) * T.cw, y = ((i / T.cols) | 0) * T.ch;
    ctx.fillStyle = bg; ctx.fillRect(x, y, T.cw, T.ch);
    glyph(ctx, x, y, c, fg);
  }

  T.present = function () {
    const n = CH.length;
    for (let i = 0; i < n; i++) {
      const c = CH[i], f = FG[i], b = BG[i];
      if (!dirtyAll && PCH[i] === c && PFG[i] === f && PBG[i] === b) continue;
      drawCell(cB, i, c, f, b);
      PCH[i] = c; PFG[i] = f; PBG[i] = b;
    }
    dirtyAll = false;
  };
  T.presentTop = function () {
    cT.clearRect(0, 0, T.cols * T.cw, T.rows * T.ch);
    for (const [i, o] of ov) drawCell(cT, i, o.c, o.fg, o.bg);
  };
  T.fxCtx = function () { return cF; };
  T.fxClear = function () { cF.clearRect(0, 0, T.cols * T.cw, T.rows * T.ch); };
  T.invalidate = function () { dirtyAll = true; };
  T.cellAt = function (clientX, clientY) {
    const px = clientX - T.ox, py = clientY - T.oy;
    return { px, py, cx: Math.floor(px / T.cw), cy: Math.floor(py / T.ch) };
  };
  return T;
})();
