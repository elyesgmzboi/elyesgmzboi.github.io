// Procedural textures (canvas-drawn, so the site ships no bitmaps).
import * as THREE from 'three';

const cache = {};
function canvasTex(key, w, h, draw, srgb = true) {
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return (cache[key] = t);
}

// the orb's two sprites (0x22EFF0), sized for a sprite 144 px across at the ring's depth:
// TEXCNAVI, a solid white disc ~10.7 px in radius, and TEXCBLUR, a soft radial falloff (measured on the capture:
// a Gaussian with sigma ~0.22 of the half-width). The halo is tinted by the orb's colour, the core stays white.
export const orbCoreTex = () => canvasTex('orbcore', 128, 128, (g, w) => {
  const r = w / 2, grd = g.createRadialGradient(r, r, 0, r, r, r);
  const k = r / 72;   // texture px per interface px
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(10.5 * k / r, 'rgba(255,255,255,1)');
  grd.addColorStop(13.5 * k / r, 'rgba(255,255,255,0)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
});
export const orbHaloTex = () => canvasTex('orbhalo', 256, 256, (g, w) => {
  const r = w / 2, grd = g.createRadialGradient(r, r, 0, r, r, r);
  for (let i = 0; i <= 24; i++) { const x = i / 24, a = Math.exp(-0.5 * (x / 0.22) ** 2); grd.addColorStop(x, `rgba(255,255,255,${a.toFixed(4)})`); }
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
});
// the orb as one sprite (core + the shared-blue halo), for screens that just need the look
export const orbTex = () => canvasTex('orb', 256, 256, (g, w) => {
  const r = w / 2, grd = g.createRadialGradient(r, r, 0, r, r, r);
  const st = [[0, '255,255,255,1'], [0.1, '252,255,255,1'], [0.15, '215,236,250,0.95'], [0.2, '120,175,220,0.62'],
    [0.27, '55,110,170,0.36'], [0.38, '22,62,110,0.2'], [0.55, '8,30,62,0.09'], [0.75, '2,10,24,0.03'], [1, '0,0,0,0']];
  for (const [o, c] of st) grd.addColorStop(o, `rgba(${c})`);
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
});

// generic soft white glow (selection spotlights)
export const glowTex = () => canvasTex('glow', 256, 256, (g, w) => {
  const r = w / 2, grd = g.createRadialGradient(r, r, 0, r, r, r);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.18, 'rgba(255,255,255,0.92)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.45)'); grd.addColorStop(0.6, 'rgba(255,255,255,0.12)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
});

// value noise helpers
function hash(x, y, s) { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); }
function vnoise(x, y, s, per) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const w = (a) => a * a * (3 - 2 * a), P = (v) => ((v % per) + per) % per;
  const a = hash(P(xi), P(yi), s), b = hash(P(xi + 1), P(yi), s), c = hash(P(xi), P(yi + 1), s), d = hash(P(xi + 1), P(yi + 1), s);
  return a + (b - a) * w(xf) + (c - a) * w(yf) + (a - b - c + d) * w(xf) * w(yf);
}
export function fbm(x, y, seed = 0, oct = 5, per = 8) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += amp * vnoise(x * f, y * f, seed + i * 13, per * f); f *= 2; amp *= 0.5; }
  return v;
}

// tileable grey cloud texture (used by several scenes as a shader input)
export const cloudTex = () => {
  if (cache.cloud) return cache.cloud;
  const N = 256, data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N * 8, v = y / N * 8;
    const a = fbm(u, v, 1, 6, 8), b = fbm(u + 3.1, v + 1.7, 7, 6, 8);
    const i = (y * N + x) * 4;
    data[i] = a * 255; data[i + 1] = b * 255; data[i + 2] = fbm(u * 0.5 + 9, v * 0.5, 3, 4, 4) * 255; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return (cache.cloud = t);
};

// small canvas helper for icon/label textures
export function drawTex(w, h, draw, key) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (key) cache[key] = t;
  return t;
}
