'use strict';
// Persistencia en localStorage: partida, récords y ajustes.

const Save = {
  KEY: 'topolev_partida_v1', REC: 'topolev_records_v1', SET: 'topolev_ajustes_v1',
  _get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  _set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  _del(k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } },

  has() { return !!this._get(this.KEY); },
  save(st) { return this._set(this.KEY, JSON.stringify(st)); },
  load() { try { return JSON.parse(this._get(this.KEY)); } catch (e) { return null; } },
  clear() { this._del(this.KEY); },

  records() { try { return JSON.parse(this._get(this.REC)) || []; } catch (e) { return []; } },
  addRecord(r) {
    const list = this.records();
    list.push(r);
    list.sort((a, b) => b.score - a.score);
    this._set(this.REC, JSON.stringify(list.slice(0, 12)));
    return list.indexOf(r);
  },

  settings() { try { return JSON.parse(this._get(this.SET)) || {}; } catch (e) { return {}; } },
  saveSettings(s) { this._set(this.SET, JSON.stringify(s)); },
};
