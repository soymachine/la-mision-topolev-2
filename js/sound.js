'use strict';
// Efectos de sonido sintetizados (WebAudio). Sin archivos externos.

const Sound = {
  ctx: null, muted: false, master: null,
  ensure() {
    if (this.ctx) return this.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
    return this.ctx;
  },
  tone(freq, dur, type = 'square', vol = 0.5, slide = 0, delay = 0) {
    const c = this.ctx; if (!c) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  },
  noise(dur, vol = 0.5, freq = 800, delay = 0) {
    const c = this.ctx; if (!c) return;
    const t0 = c.currentTime + delay;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t0);
  },
  play(name, delay = 0) {
    if (this.muted || !this.ensure()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    switch (name) {
      case 'click': this.tone(880, 0.04, 'square', 0.15, 0, delay); break;
      case 'hover': this.tone(1400, 0.02, 'square', 0.05, 0, delay); break;
      case 'pick': this.tone(500, 0.06, 'triangle', 0.3, 300, delay); break;
      case 'drop': this.tone(700, 0.07, 'triangle', 0.3, -300, delay); break;
      case 'shot': this.noise(0.08, 0.4, 2500, delay); this.tone(220, 0.05, 'square', 0.15, -100, delay); break;
      case 'rocket': this.noise(0.3, 0.35, 900, delay); break;
      case 'hit': this.noise(0.15, 0.6, 1200, delay); this.tone(120, 0.12, 'sawtooth', 0.3, -60, delay); break;
      case 'boom': this.noise(0.7, 0.9, 500, delay); this.tone(80, 0.6, 'sawtooth', 0.4, -50, delay); break;
      case 'frag': this.tone(660, 0.12, 'sine', 0.35, 0, delay); this.tone(990, 0.18, 'sine', 0.3, 0, delay + 0.08); this.tone(1320, 0.25, 'sine', 0.25, 0, delay + 0.16); break;
      case 'alarm': this.tone(440, 0.18, 'square', 0.25, 0, delay); this.tone(330, 0.18, 'square', 0.25, 0, delay + 0.2); break;
      case 'turn': this.tone(160, 0.05, 'triangle', 0.12, 40, delay); break;
      case 'land': this.tone(330, 0.2, 'triangle', 0.3, 0, delay); this.tone(440, 0.2, 'triangle', 0.3, 0, delay + 0.15); this.tone(660, 0.35, 'triangle', 0.3, 0, delay + 0.3); break;
      case 'warp': this.tone(200, 0.5, 'sine', 0.4, 900, delay); break;
      case 'type': this.tone(1800 + Math.random() * 400, 0.015, 'square', 0.04, 0, delay); break;
      case 'deny': this.tone(140, 0.15, 'square', 0.25, -40, delay); break;
    }
  },
};
