'use strict';
// Arranque y bucle principal.

const Main = {
  settings: {},
  last: 0,
  init() {
    this.settings = Save.settings();
    Term.zoom = this.settings.zoom || 0;
    Sound.muted = !!this.settings.muted;
    document.body.classList.toggle('nocrt', !!this.settings.nocrt);
    Term.init();
    const onResize = () => { Term.resize(); };
    window.addEventListener('resize', onResize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => Term.resize());
    window.addEventListener('mousemove', e => UI.onMove(e));
    window.addEventListener('mousedown', e => { Sound.ensure(); UI.onDown(e); });
    window.addEventListener('mouseup', e => UI.onUp(e));
    window.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => this.key(e));
    // táctil básico: toques como clics
    window.addEventListener('touchstart', e => { const t = e.changedTouches[0]; UI.onMove(t); UI.onDown({ clientX: t.clientX, clientY: t.clientY, button: 0 }); }, { passive: true });
    window.addEventListener('touchmove', e => { const t = e.changedTouches[0]; UI.onMove(t); }, { passive: true });
    window.addEventListener('touchend', e => { const t = e.changedTouches[0]; UI.onUp({ clientX: t.clientX, clientY: t.clientY, button: 0 }); }, { passive: true });
    Screens.set(Title);
    requestAnimationFrame(t => this.frame(t));
  },
  key(e) {
    Sound.ensure();
    if (e.key === 'Tab') e.preventDefault();
    if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '+' || e.key === '=') { this.zoom(1); return; }
    if (e.key === '-' || e.key === '_') { this.zoom(-1); return; }
    if (Screens.cur && Screens.cur.key) Screens.cur.key(e);
  },
  zoom(d) {
    Term.zoom = clamp(Term.zoom + d, -6, 12);
    this.settings.zoom = Term.zoom;
    Save.saveSettings(this.settings);
    Term.resize();
  },
  toggleSound() { Sound.muted = !Sound.muted; this.settings.muted = Sound.muted; Save.saveSettings(this.settings); },
  toggleCrt() { this.settings.nocrt = !this.settings.nocrt; document.body.classList.toggle('nocrt', this.settings.nocrt); Save.saveSettings(this.settings); },
  frame(t) {
    const dt = Math.min(0.05, (t - (this.last || t)) / 1000);
    this.last = t;
    try {
      FX.update(dt);
      UI.begin();
      Term.beginFrame();
      const s = Screens.cur;
      s.draw(dt);
      UI.drawTip();
      UI.drawDrag();
      Term.present();
      Term.fxClear();
      const ctx = Term.fxCtx();
      if (Screens.cur.drawFx) Screens.cur.drawFx(ctx);
      Term.presentTop();
      document.body.style.cursor = UI.drag ? 'grabbing' : UI.cursor;
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(tt => this.frame(tt));
  },
};

window.addEventListener('load', () => Main.init());
