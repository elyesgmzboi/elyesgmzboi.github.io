// OSD sounds, all of them the console's own (assets/audio, cut by _scratch/ps2ref/aud/cut3.py at the capture's
// relative levels). OSDSYS plays two kinds of sound (aap/osdbits docs/sound.md): sound effects from the SNDOSDD bank
// (StSePlay(1, n): 4 = confirm, 6 = cursor, 10 = back, plus the System Configuration list and Display ones) and
// looping sequences per screen (SNDBOOTS at power-on, the menu's bed, SNDCLOKS on System Configuration; the Browser
// is silent). Each one was identified by matching it against what happens on screen in the capture:
//   cursor  - the 3.7 kHz click over a 520 Hz tone (main menu, Version, Browser moves, value left/right)
//   cursorV - the soft rising glide of System Configuration's list up/down
//   enter   - the 413/550/735 Hz chord (every confirm)
//   back    - the low ~300 Hz tone (every back)
//   dispOn / dispOff - System Configuration's Display mode
//   card    - opening a memory card in the Browser (its own sound, not the confirm)
//   boot    - the capture from the first picture to the main menu (startup, the dive, the orbs arriving)
// The context is created at load (suspended) so every sample is decoded before the first key: nothing is ever
// substituted or late. There is no compressor or added reverb: the recordings carry the console's own.
import { S } from './settings.js';

const FILES = {
  boot: 'boot.mp3', btm: 'btm.mp3', cursor: 'cursor.mp3', cursorV: 'cursorV.mp3', enter: 'enter.mp3', back: 'back.mp3',
  dispOn: 'dispOn.mp3', dispOff: 'dispOff.mp3', denied: 'denied.mp3', card: 'card.mp3',
  amb_menu: 'amb_menu.mp3', amb_config: 'amb_config.wav',
};
const ALIAS = {};
const LEVEL = 1.0;

let ctx = null, master = null;
const buffers = {}, pending = {};
const beds = {};
let bedName = null;
let muted = false;

function setup() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC({ latencyHint: 'interactive' });
  master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  for (const k in FILES) {
    pending[k] = fetch('assets/audio/' + FILES[k]).then((r) => r.arrayBuffer())
      .then((b) => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
      .then((buf) => { buffers[k] = buf; return buf; })
      .catch((e) => console.warn('audio', k, e));
  }
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !started) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });
}
setup();

let started = false;
export function audioReady() { return started; }

// the first key or click: the browser only lets audio start from a gesture
export function initAudio() {
  if (!ctx) return;
  started = true;
  if (ctx.state !== 'running') ctx.resume();
  applyMute(true);
}

export function applyMute(now) {
  if (!ctx) return;
  const on = S.optical !== 'off' && !muted && started;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(on ? LEVEL : 0, ctx.currentTime, now ? 0.001 : 0.05);
}
export function toggleMute() { muted = !muted; applyMute(); return muted; }

function play(name, when = 0) {
  const buf = buffers[name];
  const src = ctx.createBufferSource(); src.buffer = buf; src.connect(master);
  src.start(ctx.currentTime + when);
  return src;
}

const log = (window.__snd = []);   // test hook: what played, when
export function sfx(name) {
  log.push([+(performance.now() / 1000).toFixed(2), name]);
  if (!ctx || !started) return;
  if (ctx.state !== 'running') ctx.resume();
  name = ALIAS[name] || name;
  if (!FILES[name]) return;
  if (buffers[name]) { play(name); return; }
  // still decoding (only possible in the first moments after load): play it the moment it is ready, if that is soon
  const asked = performance.now();
  pending[name] && pending[name].then(() => { if (buffers[name] && performance.now() - asked < 400) play(name); });
}

// ---------- the per-screen sequences: one looping source per bed, faded in and out (the console's StBgmPlay /
// StBgmStop with a fade). A bed restarts from its beginning each time its screen opens, as a sequence does.
export function bed(name, fadeIn = 1.2, fadeOut = 1.0, delay = 0) {
  if (!ctx) return;
  const now = ctx.currentTime;
  if (bedName === name) return;
  log.push([+(performance.now() / 1000).toFixed(2), 'bed:' + name]);
  if (bedName && beds[bedName]) {
    const old = beds[bedName];
    old.g.gain.cancelScheduledValues(now); old.g.gain.setValueAtTime(old.g.gain.value, now);
    old.g.gain.linearRampToValueAtTime(0, now + fadeOut);
    old.src && old.src.stop(now + fadeOut + 0.05);
    delete beds[bedName];
  }
  bedName = name;
  if (!name) return;
  const key = 'amb_' + name;
  if (!FILES[key]) return;
  const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
  const b = { g, src: null };
  beds[name] = b;
  const start = () => {
    if (beds[name] !== b || !buffers[key]) return;
    const t = Math.max(ctx.currentTime, now + delay);
    const src = ctx.createBufferSource(); src.buffer = buffers[key]; src.loop = true; src.connect(g); src.start(t);
    b.src = src;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + fadeIn);
  };
  if (buffers[key]) start(); else pending[key] && pending[key].then(start);
}
