'use strict';
// RNG con semilla y estado serializable (mulberry32) + ruido de valor fractal.

class Rng {
  constructor(seed) { this.s = (seed >>> 0) || 0x9e3779b9; }
  next() {
    let t = this.s = (this.s + 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  float(a, b) { return a + this.next() * (b - a); }
  chance(p) { return this.next() < p; }
  pick(a) { return a[Math.floor(this.next() * a.length)]; }
  weighted(list) {
    let tot = 0;
    for (const e of list) tot += e[1];
    let r = this.next() * tot;
    for (const e of list) { r -= e[1]; if (r < 0) return e[0]; }
    return list[list.length - 1][0];
  }
  shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
}

function hash2(x, y, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function makeNoise(seed) {
  const sm = t => t * t * (3 - 2 * t);
  function vn(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
    const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  return function (x, y, oct = 4) {
    let f = 1, amp = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += vn(x * f + i * 17.31, y * f + i * 9.17) * amp;
      norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  };
}

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const eucl = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
