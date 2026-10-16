// Ilyes — a PlayStation 2 system menu, as a portfolio.
import * as THREE from 'three';
import { Stage } from './stage.js';
import { S, save } from './settings.js';
import { setLang, LANGS, t, L } from './i18n.js';
import { initAudio, sfx, bed, toggleMute } from './audio.js';
import { Input } from './input.js';
import { Orbs } from './orbs.js';
import { osd } from './osdclock.js';
import { el } from './ui.js';
import { PowerScreen, BootScreen, MainScreen, VersionScreen, MenuWorld } from './menu.js';
import { ConfigScreen, ConfigWorld } from './config.js';
import { BrowserWorld, BrowserScreen, CardScreen, DetailScreen, InfoScreen } from './browser.js';
import { BootWorld } from './boot.js';
import { DiscScreen, LogoWorld } from './disc.js';
import { Dialog } from './dialog.js';

const C = window.PORTFOLIO || {};
const FREEZE = new URLSearchParams(location.search).has('freeze');   // test hook: hold the console clock still

if (!S.lang) {
  const n = (navigator.language || 'en').slice(0, 2).toLowerCase();
  S.lang = LANGS.includes(n) ? n : 'en'; save();
}
setLang(S.lang);

class App {
  constructor() {
    window.__app = this;   // test hook
    this.C = C;
    this.ui = document.getElementById('ui');
    this.stage = new Stage(document.getElementById('gl'), this.ui);
    this.overlay = new THREE.Scene();
    this.orbs = new Orbs(this.overlay);
    this.worlds = {
      menu: new MenuWorld(this.stage, this),
      boot: new BootWorld(this.stage, this),
      config: new ConfigWorld(this.stage, this),
      browser: new BrowserWorld(this.stage, this),
      logo: new LogoWorld(this.stage, this),
    };
    this.world = this.worlds.menu; this.prev = null; this.mix = 1; this.mixDur = 1;
    this.epoch = 0; this.lockUntil = 0; this.time = 0;
    this.screens = {};
    for (const [k, Cls] of Object.entries({ power: PowerScreen, boot: BootScreen, main: MainScreen, version: VersionScreen, config: ConfigScreen,
      browser: BrowserScreen, card: CardScreen, detail: DetailScreen, info: InfoScreen, disc: DiscScreen })) {
      this.screens[k] = new Cls(this, k);
    }
    this.dialog = new Dialog(this);
    this.input = new Input((b, rep, src) => this.onButton(b, rep, src));
    this.ui.addEventListener('click', (e) => this.onHit(e, 'click'));
    this.ui.addEventListener('pointerover', (e) => this.onHit(e, 'hover'));
    document.addEventListener('pointermove', (e) => this.cur && this.cur.hoverCanvas && this.cur.hoverCanvas(e));
    document.addEventListener('pointerout', (e) => {
      if (!e.relatedTarget && this.cur && this.cur.hoverCanvas) this.cur.hoverCanvas(null);
    });
    window.addEventListener('blur', () => this.cur && this.cur.hoverCanvas && this.cur.hoverCanvas(null));
    document.getElementById('gl').addEventListener('click', (e) => {
      if (this.cur && this.cur.hitCanvas && this.cur.hitCanvas(e)) return;
      this.onButton('any', false, 'mouse');
    });
    this.diag = null; this.applyDiag();
    this.applySpeed();
    this.buildPlain();
    this.stage.onResize = [() => this.cur && this.cur.resize && this.cur.resize()];
    const q = new URLSearchParams(location.search);
    const skip = q.get('skip');
    if (skip && this.screens[skip]) { this.powered = true; this.go('main', { instant: true }); if (skip !== 'main') this.go(skip, { instant: true }); }
    else {
      this.go('power');
      // while the power screen waits for a key, build the opening's programs and buffers (see BootWorld.warm)
      requestAnimationFrame(() => this.worlds.boot.warm(this.stage.renderer, this.stage.rtB));
    }
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  get speed() { return S.discSpeed === 'fast' ? 0.55 : 1; }
  applySpeed() { document.body.classList.toggle('fast', S.discSpeed === 'fast'); }
  applyDiag() {
    if (S.diag === 'on' && !this.diag) this.diag = el('div', null, '', document.body), this.diag.id = 'diag';
    if (S.diag !== 'on' && this.diag) { this.diag.remove(); this.diag = null; }
  }

  // timers that die with the screen that made them
  after(ms, fn) { const e = this.epoch; setTimeout(() => { if (e === this.epoch) fn(); }, ms * this.speed); }
  lock(ms) { this.lockUntil = Math.max(this.lockUntil, performance.now() + ms * this.speed); }

  go(name, arg = {}) {
    const from = this.cur, to = this.screens[name];
    this.epoch++;
    if (from) { from.leave(to, arg); from.show(false); }
    this.cur = to;
    // a screen that stages its own reveal (enter() returns 'hold') shows itself when it is ready
    const r = to.enter(from, arg);
    if (!arg.hold && r !== 'hold') to.show(true);
    this.syncPlain(name);
  }

  setWorld(name, dur = 0.8) {
    const w = this.worlds[name];
    if (w === this.world) return;
    if (dur <= 0) { this.world = w; this.prev = null; this.mix = 1; return; }
    this.prev = this.world; this.world = w; this.mix = 0; this.mixDur = dur * this.speed;
  }

  onButton(b, rep, src) {
    if (b === 'mute') { const m = toggleMute(); return; }
    if (!this.powered && this.cur === this.screens.power) { this.cur.key(b, rep, src); return; }
    if (b === 'any') return;
    initAudio();
    if (this.dialog.open) { this.dialog.key(b, rep); return; }
    if (performance.now() < this.lockUntil) return;
    this.cur && this.cur.key(b, rep, src);
  }

  onHit(e, kind) {
    const h = e.target.closest('[data-hit]');
    if (kind === 'click' && !this.powered) { this.onButton('any', false, 'mouse'); return; }
    if (!h) return;
    if (kind === 'click') initAudio();
    if (this.dialog.open) { this.dialog.hit(h.dataset.hit, kind); return; }
    if (performance.now() < this.lockUntil) return;
    this.cur && this.cur.hit && this.cur.hit(h.dataset.hit, kind, h);
  }

  // a settings change that affects everything
  relayout() { this.stage.resize(); }
  // Screen Size: the console crossfades the old picture into the new one (~0.25 s)
  screenChange() { this.snapNext = true; }
  snapshot() {
    const gl = document.getElementById('gl');
    const box = el('div', 'ghost', null, document.body);
    const c = el('canvas', null, null, box);
    c.width = gl.width; c.height = gl.height;
    c.style.width = gl.style.width; c.style.height = gl.style.height;
    c.getContext('2d').drawImage(gl, 0, 0);
    const u = this.ui.cloneNode(true);
    u.removeAttribute('id'); u.classList.add('ghost-ui');
    u.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
    box.appendChild(u);
    this.stage.resize();
    requestAnimationFrame(() => requestAnimationFrame(() => { box.classList.add('out'); }));
    setTimeout(() => box.remove(), 600);
  }
  relocalize() {
    setLang(S.lang);
    for (const s of Object.values(this.screens)) s.build && s.build();
    this.dialog.build();
    this.buildPlain();
  }

  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now; this.time += dt;
    this.input.poll(now);
    if (this.prev) { this.mix += dt / this.mixDur; if (this.mix >= 1) { this.mix = 1; this.prev = null; } }
    // the menu module's frame loop: everything frame-based steps once per console frame (osdclock.js)
    const ws = new Set([this.world, this.prev].filter(Boolean));
    const n = Math.min(osd.frames(dt), 30);
    for (let i = 0; i < n; i++) { osd.tick(); this.orbs.tick(); for (const w of ws) w.tick && w.tick(); }
    if (!this.world.tick || FREEZE) osd.rate = FREEZE ? 0 : 60;
    this.orbs.update(dt);
    for (const w of ws) w.update(dt, this.time);
    this.cur && this.cur.update && this.cur.update(dt, this.time);
    // worlds of the menu module draw the orbs into their own frame (the zoom blur softens them, the glass refracts
    // them); the stage only lays the orbs over worlds that do not
    const own = this.world.ownsOverlay || (this.prev && this.prev.ownsOverlay);
    if (this.prev) this.stage.render(this.prev, this.world, this.mix, own ? null : this.overlay, this.time);
    else this.stage.render(this.world, null, 0, own ? null : this.overlay, this.time);
    if (this.snapNext) { this.snapNext = false; this.snapshot(); }
    if (this.diag) {
      this.fc = (this.fc || 0) + 1; this.ft = (this.ft || 0) + dt;
      if (this.ft > 0.5) { this.diag.textContent = `${Math.round(this.fc / this.ft)} fps  ${this.stage.rtW}x${this.stage.rtH}  ${this.cur ? this.cur.id : ''}`; this.fc = 0; this.ft = 0; }
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  // plain HTML version of everything, for screen readers and no-WebGL visitors
  buildPlain() {
    const p = document.getElementById('plain');
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const link = (u, txt) => u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(txt || u)}</a>` : '';
    let h = `<h1>${esc(C.name || 'Ilyes')}</h1><p>${esc(L(C.role))}</p>`;
    if (C.profile) h += C.profile.map((r) => `<p>${esc(L(r[0]))}: ${esc(L(r[1]))}</p>`).join('');
    for (const card of C.cards || []) {
      h += `<h2>${esc(L(card.name))}</h2><ul>`;
      for (const s of card.saves || []) h += `<li><h3>${esc(L(s.title).replace(/\n/g, ' '))}</h3><p>${esc(L(s.desc))}</p><p>${link(s.url, t('open'))} ${link(s.source, t('source'))}</p></li>`;
      h += '</ul>';
    }
    if (C.contact) h += `<h2>Contact</h2><ul>${C.contact.map((c) => `<li>${esc(L(c.label))}: ${link(c.url, c.value)}</li>`).join('')}</ul>`;
    p.innerHTML = h;
  }
  syncPlain() {}
}

window.addEventListener('DOMContentLoaded', () => {}, { once: true });
document.fonts.load('48px OSD').finally(() => { window.app = new App(); });
