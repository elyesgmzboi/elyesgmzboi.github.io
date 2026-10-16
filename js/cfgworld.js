// System Configuration's 3D stage, drawn the way OSDSYS draws it.
//
// Structure, geometry, colour tables, pass order and the frame-based logic come from the aap/osdbits reverse
// engineering of the retail ROM (docs/menu-config.md, menu-backdrop.md, glass-refraction.md, osdbits/menuconfig.c,
// menuback.c). The console capture settles what the notes leave open: where the clock sits in list mode, the entry
// zoom, and the frame rate the console actually manages on this screen (~50 fps with the cubes up, 60 without).
//
// Everything is drawn like the GS draws it: 8-bit display-referred colour, MODULATE texturing (texel x vertex
// colour / 128), vertex colour = clamp(size * 10 * fresnel^4 + colour + extra, 255), and "glass" = a copy of the
// frame sampled at the vertex's own screen position, pulled 5 % toward the object and pushed by the face normal
// (1000 GS units horizontally, 500 vertically, over w). No bitmaps: the four ROM textures are procedural stand-ins
// with the measured statistics.
import * as THREE from 'three';
import { World } from './stage.js';

const Q = new URLSearchParams(location.search);
const TAU = Math.PI * 2;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, k) => a + (b - a) * k;
const s16 = (a) => ((Math.round(a) + 32768) % 65536 + 65536) % 65536 - 32768;     // a 16-bit angle, signed
const angR = (a) => a * TAU / 65536;
const mdSin = (a) => Math.sin(angR(s16(a)));
const mdCos = (a) => Math.cos(angR(s16(a)));

// ------------------------------------------------------------------ the ROM view
// sceVu0ViewScreenMatrix(scrz 512, ax 1, ay 0.47, cx = cy = 2048) on a 640 x 224 field, shown as the 1440 x 1080
// picture: one GS pixel is 2.25 interface px across, one field line 4.82 down.
export const FX = 512 * 2.25, FY = 512 * 0.47 * (1080 / 224);
// the menu camera (0x21CFD8 / 0x22ED20): rest position {10.436, 0, -103}, forward +z, up +y, all three rotated by
// RotX(0.031) then RotY(0.145), then sceVu0CameraMatrix. Camera space: x right, y down, z forward.
export function romCamera(fly = 0) {
  const rx = new THREE.Matrix4().makeRotationX(0.031), ry = new THREE.Matrix4().makeRotationY(0.145);
  const R = new THREE.Matrix4().multiplyMatrices(ry, rx);
  const pos = new THREE.Vector3(10.436, 0, -103 + fly).applyMatrix4(R);
  const zd = new THREE.Vector3(0, 0, 1).applyMatrix4(R).normalize();
  const yd = new THREE.Vector3(0, 1, 0).applyMatrix4(R);
  const x = new THREE.Vector3().crossVectors(yd, zd).normalize();
  const y = new THREE.Vector3().crossVectors(zd, x);
  const M = new THREE.Matrix4().set(x.x, x.y, x.z, -x.dot(pos), y.x, y.y, y.z, -y.dot(pos), zd.x, zd.y, zd.z, -zd.dot(pos), 0, 0, 0, 1);
  return M;
}

// ------------------------------------------------------------------ ROM data
// the rod: a hexagonal prism, circumradius 2.6, 26 tall from y = 0, bevelled to 2.34 at 26.39; sixteen quads:
// 0-1 top cap, 2-7 bevel, 8-9 bottom cap, 10-15 sides
const HEX = [[2.6, 0], [1.3, 2.2516], [-1.3, 2.2516], [-2.6, 0], [-1.3, -2.2516], [1.3, -2.2516]];
function rodFaces() {
  const ring = (r, y) => HEX.map(([x, z]) => [x * r / 2.6, y, z * r / 2.6]);
  const B = ring(2.6, 0), T = ring(2.6, 26), C = ring(2.34, 26.39);
  const F = [];
  F.push([C[0], C[1], C[2], C[3]], [C[3], C[4], C[5], C[0]]);                 // 0-1 top cap (+y)
  for (let k = 0; k < 6; k++) { const k1 = (k + 1) % 6; F.push([T[k], C[k], C[k1], T[k1]]); }   // 2-7 bevel
  F.push([B[3], B[2], B[1], B[0]], [B[0], B[5], B[4], B[3]]);                 // 8-9 bottom cap (-y)
  for (let k = 0; k < 6; k++) { const k1 = (k + 1) % 6; F.push([B[k], T[k], T[k1], B[k1]]); }   // 10-15 sides
  return F.map((q) => q.map((v) => new THREE.Vector3(...v)));
}
// the cube: half-extent 2.64, six quads
function cubeFaces() {
  const h = 2.64, F = [];
  const ax = [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
  for (const [a, b, c] of ax) for (const s of [1, -1]) {
    const q = [[s, -1, -1], [s, 1, -1], [s, 1, 1], [s, -1, 1]].map(([u, v, w]) => { const p = [0, 0, 0]; p[a] = u * h; p[b] = v * h; p[c] = w * h; return new THREE.Vector3(...p); });
    if (s < 0) q.reverse();
    F.push(q);
  }
  return F;
}
export const ROD = rodFaces(), CUBE = cubeFaces();
const faceNormal = (q) => new THREE.Vector3().subVectors(q[1], q[0]).cross(new THREE.Vector3().subVectors(q[3], q[0])).normalize();
export const ROD_N = ROD.map(faceNormal), CUBE_N = CUBE.map(faceNormal);
// make every normal point outward (away from the rod axis / cube centre)
for (const [F, N, c] of [[ROD, ROD_N, (q) => new THREE.Vector3(0, q.reduce((s, v) => s + v.y, 0) / 4, 0)], [CUBE, CUBE_N, () => new THREE.Vector3()]]) {
  F.forEach((q, i) => {
    const m = q.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(0.25);
    const out = m.clone().sub(c(q));
    if (i < 2 && F === ROD) out.set(0, 1, 0);
    if ((i === 8 || i === 9) && F === ROD) out.set(0, -1, 0);
    if (N[i].dot(out) < 0) { N[i].negate(); q.reverse(); }
  });
}

// model UVs for the TEXCBUMP lookups: around the rod and 0..2 along it (the ROM's rod V spans 0..2); caps planar
export const ROD_UV = ROD.map((q, fi) => q.map((v) => {
  if (fi < 2 || fi === 8 || fi === 9) return [v.x / 5.2 + 0.5, v.z / 5.2 + 0.5];
  return [(Math.atan2(v.z, v.x) / TAU + 1) % 1 * 1.5, v.y / 13];
}));
export const CUBE_UV = CUBE.map((q) => q.map((v, k) => [[0, 0], [1.5, 0], [1.5, 1.5], [0, 1.5]][k]));

// the five config cubes (0x27F090): camera-space positions, 47.5 units from the eye
export const CUBE_POS = [[-11.5, -11.5, 47.5], [-22.5, -5.5, 47.5], [-10.75, -0.25, 47.5], [-21.75, 6.0, 47.5], [-11.25, 11.5, 47.5]];
const CUBE_SEL = [0, 150, 200], CUBE_HOVER = [155, 155, 155], CUBE_PLAIN = [100, 100, 100];
// the ring's colour tables (0x27EAC0..0x27EAF0, 0x34E940)
const COL_EDGE = [0x3C, 0x3C, 0x3C], COL_FIXED = [167, 217, 255];

// ------------------------------------------------------------------ procedural stand-ins for the TEXC pages
function noiseField(N, seed, oct = 4, base = 4) {
  const r = (x, y, s) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
  const vn = (x, y, s, per) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, w = (a) => a * a * (3 - 2 * a), P = (v) => ((v % per) + per) % per;
    const a = r(P(xi), P(yi), s), b = r(P(xi + 1), P(yi), s), c = r(P(xi), P(yi + 1), s), d = r(P(xi + 1), P(yi + 1), s);
    return a + (b - a) * w(xf) + (c - a) * w(yf) + (a - b - c + d) * w(xf) * w(yf);
  };
  const out = new Float32Array(N * N);
  let lo = 1e9, hi = -1e9;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0, amp = 0.5, f = base;
    for (let o = 0; o < oct; o++) { v += amp * vn(x / N * f, y / N * f, seed + o * 17, f); f *= 2; amp *= 0.5; }
    out[y * N + x] = v; lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / (hi - lo);
  return out;
}
function dataTex(N, fill) {
  const d = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) { const [r, g, b] = fill(i); d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
// TEXCKABE: a low-contrast bluish noise field (R 137..184, G 143..190, B 177..224; means 160/165/200), 64x64 tiled
// 2x2 into its 128x128 page
function kabeTex() {
  // mostly texel-scale mottling (retail's tunnel is far more mottled than a smooth noise), a little broader cloud
  const fine = noiseField(64, 11, 2, 32), mid = noiseField(64, 23, 2, 8), broad = noiseField(64, 29, 2, 2), c = noiseField(64, 37, 2, 16);
  const raw = fine.map((v, i) => 0.5 * v + 0.3 * mid[i] + 0.2 * broad[i]);
  let lo = 1e9, hi = -1e9; for (const v of raw) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  return dataTex(64, (i) => { const a = (raw[i] - lo) / (hi - lo), b = c[i] - 0.5; return [137 + 47 * a + 6 * b, 143 + 47 * a - 3 * b, 177 + 47 * a + 4 * b]; });
}
// TEXCREFA: the cubes' grey spherical environment (retail work buffer 4 shows 5..44 levels over the cubes)
function refaTex() {
  const n = noiseField(64, 5, 3, 2);
  return dataTex(64, (i) => { const x = i % 64; const g = Math.max(4, 12 + 48 * Math.pow(n[i], 1.1) + 10 * Math.sin(x / 64 * TAU)); return [g, g, g]; });
}
// TEXCBUMP: the grey emboss page (TEXCBINV is its exact complement)
function bumpTex() {
  const n = noiseField(64, 17, 5, 4);
  return dataTex(64, (i) => { const g = 255 * n[i]; return [g, g, g]; });
}
// TEXCFLOW: the rods' bloom environment
function flowTex() {
  const n = noiseField(64, 41, 4, 2);
  return dataTex(64, (i) => { const g = 140 + 115 * n[i]; return [g, g, g]; });
}

// ------------------------------------------------------------------ GL plumbing
const FS_VERT = `precision highp float; attribute vec3 position; attribute vec2 uv; varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const fsMat = (frag, uniforms, blending = THREE.NoBlending) => {
  const m = new THREE.RawShaderMaterial({ vertexShader: FS_VERT, fragmentShader: 'precision highp float; varying vec2 vUv;\n' + frag, uniforms, depthTest: false, depthWrite: false });
  setBlend(m, blending);
  return m;
};
function setBlend(m, mode) {
  m.transparent = mode !== THREE.NoBlending;
  if (mode === 'add') { m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneFactor; m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor; }
  else if (mode === 'sub') { m.blending = THREE.CustomBlending; m.blendEquation = THREE.ReverseSubtractEquation; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneFactor; m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor; }
  else if (mode === 'mask') { m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation; m.blendSrc = THREE.SrcAlphaFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor; }
  else m.blending = THREE.NoBlending;
}
function target(depth) {
  const t = new THREE.WebGLRenderTarget(4, 4, { type: THREE.UnsignedByteType, depthBuffer: depth, stencilBuffer: false });
  t.texture.minFilter = t.texture.magFilter = THREE.LinearFilter; t.texture.generateMipmaps = false;
  return t;
}

// glass faces: positions already in NDC (w = 1, so every attribute interpolates linearly on screen, like the GS's
// FST texturing), a UV into the source buffer, a MODULATE factor, and which winding set the face belongs to
const GLASS_VERT = `precision highp float;
attribute vec3 position; attribute vec2 aUV; attribute vec2 aUV2; attribute vec3 aCol; attribute float aSet;
varying vec2 vUV; varying vec2 vUV2; varying vec3 vCol; varying float vSet;
void main(){ vUV = aUV; vUV2 = aUV2; vCol = aCol; vSet = aSet; gl_Position = vec4(position, 1.0); }`;
const GLASS_FRAG = `precision highp float;
uniform sampler2D uTex, uBump; uniform float uSet, uMode;
varying vec2 vUV; varying vec2 vUV2; varying vec3 vCol; varying float vSet;
void main(){
  if (abs(vSet - uSet) > 0.5) discard;
  vec3 c;
  if (uMode < 0.5) c = texture2D(uTex, clamp(vUV, 0.0005, 0.9995)).rgb * vCol;      // refraction (MODULATE)
  else if (uMode < 1.5) c = vCol;                                                   // flat colour
  else if (uMode < 2.5) c = texture2D(uTex, vUV).rgb * vCol;                         // env map (REPEAT)
  else {
    // the deferred rod bloom, both walks: TEXCFLOW x col1 minus TEXCBUMP (walk 1) / TEXCBINV (walk 0) x 40/128
    vec3 e = texture2D(uTex, vUV).rgb * vCol; float b = texture2D(uBump, vUV2).r * 0.3125;
    c = max(e - b, 0.0) + max(e - (0.3125 - b), 0.0);
  }
  gl_FragColor = vec4(min(c, 1.0), 1.0);
}`;
const TUN_VERT = `precision highp float;
attribute vec4 position; attribute vec2 aST; attribute vec4 aCol;
varying vec2 vST; varying vec4 vCol;
void main(){ vST = aST; vCol = aCol; gl_Position = position; }`;
const TUN_FRAG = `precision highp float;
uniform sampler2D uKabe; uniform float uFade;
varying vec2 vST; varying vec4 vCol;
void main(){ vec3 c = vCol.rgb / vCol.w; gl_FragColor = vec4(min(texture2D(uKabe, vST).rgb * c, 1.0) * uFade, 1.0); }`;

// a growable batch of quads (two triangles each), rebuilt on the CPU every frame
class Batch {
  constructor(maxQuads, attrs) {
    this.g = new THREE.BufferGeometry();
    this.a = {};
    for (const [name, size] of Object.entries(attrs)) {
      const arr = new Float32Array(maxQuads * 6 * size);
      const at = new THREE.BufferAttribute(arr, size); at.setUsage(THREE.DynamicDrawUsage);
      this.g.setAttribute(name, at); this.a[name] = { arr, size };
    }
    this.n = 0;
  }
  reset() { this.n = 0; }
  // v: 4 vertices, each { attrName: [..] }
  quad(v) {
    for (const k of [0, 1, 2, 0, 2, 3]) {
      for (const name in this.a) { const { arr, size } = this.a[name]; const src = v[k][name]; for (let j = 0; j < size; j++) arr[this.n * size + j] = src[j]; }
      this.n++;
    }
  }
  commit() { for (const name in this.a) this.g.attributes[name].needsUpdate = true; this.g.setDrawRange(0, this.n); }
}

// ------------------------------------------------------------------ the world
export class CfgWorld extends World {
  constructor(stage, app) {
    super(stage);
    this.app = app;
    this.ownsOverlay = true;                 // the orbs are drawn inside the frame here, so the glass refracts them
    this.S = target(true); this.W3 = target(false); this.W4 = target(false);
    this.O = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });   // the orbs, linear
    this.kabe = kabeTex(); this.kabe.repeat.set(1, 1);
    this.refa = refaTex(); this.flow = flowTex(); this.bump = bumpTex();
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fsScene = new THREE.Scene();
    this.fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); this.fsQuad.frustumCulled = false; this.fsScene.add(this.fsQuad);
    this.mCopy = fsMat('uniform sampler2D uT; void main(){ gl_FragColor = vec4(texture2D(uT, vUv).rgb, 1.0); }', { uT: { value: null } });
    this.mTint = fsMat('uniform sampler2D uT; uniform vec3 uK; void main(){ gl_FragColor = vec4(min(texture2D(uT, vUv).rgb * uK, 1.0), 1.0); }', { uT: { value: null }, uK: { value: new THREE.Vector3(0x37 / 128, 0x28 / 128, 0x3C / 128) } });
    this.mAdd = fsMat('uniform sampler2D uT; uniform float uK; void main(){ gl_FragColor = vec4(texture2D(uT, vUv).rgb * uK, 1.0); }', { uT: { value: null }, uK: { value: 1 } }, 'add');
    // linear orb layer -> display-referred, added
    this.mOrbs = fsMat('uniform sampler2D uT; vec3 enc(vec3 c){ return mix(c*12.92, 1.055*pow(max(c,0.0),vec3(1.0/2.4))-0.055, step(0.0031308,c)); } void main(){ gl_FragColor = vec4(enc(texture2D(uT, vUv).rgb), 1.0); }', { uT: { value: null } }, 'add');
    // the cube stage's masked composite: screen = mix(screen, wb3 + wb4, wb4.alpha)
    this.mCube = fsMat('uniform sampler2D uA, uB; void main(){ vec4 b = texture2D(uB, vUv); gl_FragColor = vec4(min(texture2D(uA, vUv).rgb + b.rgb, 1.0), b.a); }', { uA: { value: null }, uB: { value: null } }, 'mask');
    // the menu vignette (0x22AF10): black outside an ellipse of (166, 178) px round (598.5, 540), clear inside, full
    // from 1.5x the radii out; it masks the tunnel only (drawn before the orbs and rods, which the ROM's Z test spares)
    this.mVig = fsMat('uniform float uA; uniform vec4 uMap; void main(){ vec2 d = vec2((vUv.x - uMap.x) / uMap.z, (vUv.y - uMap.y) / uMap.w); float r = length(d); float k = clamp((r - 1.0) / 0.5, 0.0, 1.0); gl_FragColor = vec4(0.0, 0.0, 0.0, k * uA); }',
      { uA: { value: 0 }, uMap: { value: new THREE.Vector4() } }, 'mask');
    // display-referred -> linear for the stage, with the entry/exit fade
    this.mOut = fsMat('uniform sampler2D uT; uniform float uK; uniform vec3 uLo, uGain; vec3 dec(vec3 c){ return mix(c/12.92, pow((c+0.055)/1.055, vec3(2.4)), step(0.04045, c)); } void main(){ vec3 c = clamp((texture2D(uT, vUv).rgb - uLo) * uGain, 0.0, 1.0); gl_FragColor = vec4(dec(c) * uK, 1.0); }',
      { uT: { value: null }, uK: { value: 1 }, uLo: { value: new THREE.Vector3(20 / 255, 20 / 255, 20 / 255) }, uGain: { value: new THREE.Vector3(1.04, 1.04, 1.04) } });

    // tunnel: 16 ribbons x 33 rings (+ the cap)
    this.tun = new Batch(16 * 34, { position: 4, aST: 2, aCol: 4 });
    this.tunMat = new THREE.RawShaderMaterial({ vertexShader: TUN_VERT, fragmentShader: TUN_FRAG, uniforms: { uKabe: { value: this.kabe }, uFade: { value: 1 } }, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    this.tunMesh = new THREE.Mesh(this.tun.g, this.tunMat); this.tunMesh.frustumCulled = false;
    this.tunScene = new THREE.Scene(); this.tunScene.add(this.tunMesh);

    // glass batch (rebuilt per object per pass group)
    this.gl = new Batch(64, { position: 3, aUV: 2, aUV2: 2, aCol: 3, aSet: 1 });
    this.glassMat = new THREE.RawShaderMaterial({ vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG, uniforms: { uTex: { value: null }, uBump: { value: null }, uSet: { value: 0 }, uMode: { value: 0 } }, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    this.glassMesh = new THREE.Mesh(this.gl.g, this.glassMat); this.glassMesh.frustumCulled = false;
    this.glassScene = new THREE.Scene(); this.glassScene.add(this.glassMesh);

    this.cam = romCamera();
    this.frame = 0;          // the OSD's frame counter (tunnel scroll and wobble)
    this.acc = 0;
    this.cubeSpin = 0;
    this.cubeCol = CUBE_POS.map(() => [128, 128, 128]);
    this.cubeTracker = [128, 128, 128];
    this.cubeBias = CUBE_POS.map(() => 0);
    this.cursor = 0;
    this.hover = -1;
    this.v = new THREE.Vector3(); this.v2 = new THREE.Vector3();
  }

  // ---------------------------------------------------------------- frame-based logic, run at the console's rate
  tick() {
    this.frame++;
    this.cubeSpin = (this.cubeSpin + 30) & 0xFFFF;                    // 0x2285C0
    // The selected cube is blue-cyan; a hovered cube gets a subtle white highlight.
    const ease = (d, s, r) => { for (let k = 0; k < 3; k++) { if (d[k] < s[k]) d[k] = Math.min(s[k], d[k] + r); else if (d[k] > s[k]) d[k] = Math.max(s[k], d[k] - r); } };
    for (let i = 0; i < 5; i++) {
      if (i === this.cursor) ease(this.cubeTracker, CUBE_SEL, 1);
      ease(this.cubeCol[i], i === this.hover ? CUBE_HOVER : i === this.cursor ? this.cubeTracker : CUBE_PLAIN, 7);
      this.cubeBias[i] *= 0.95;
    }
  }
  kick(i) { if (i >= 0 && i < 5) this.cubeBias[i] = -0.1; }       // 0x227BE8's confirm: the pressed cube shrinks 10 %
  setHover(i) { this.hover = i >= 0 && i < 5 ? i : -1; }

  // ---------------------------------------------------------------- per-frame geometry helpers
  // interface px -> picture NDC (the buffers cover the picture)
  mapNDC() {
    const st = this.stage, f = st.frame, b = st.box;
    this.nax = (b.x - f.x) / f.w * 2 - 1; this.nbx = b.s / f.w * 2;
    this.nay = 1 - (b.y - f.y) / f.h * 2; this.nby = -b.s / f.h * 2;
  }
  ndcX(dx) { return this.nax + this.nbx * dx; }
  ndcY(dy) { return this.nay + this.nby * dy; }
  uvX(dx) { return this.ndcX(dx) * 0.5 + 0.5; }
  uvY(dy) { return this.ndcY(dy) * 0.5 + 0.5; }

  // tunnel, per vertex exactly as 0x2288C0 (the ribbon) and 0x228E78 (the cap)
  buildTunnel(off) {
    const B = this.tun; B.reset();
    const R = 6000, fc = this.frame, scroll = (fc % 5000) * 0.0002;
    const cam = this.cam.elements, bg = Math.round(40 * (this.bg40 != null ? this.bg40 : this.bgFade));   // 0x229278: the backdrop timer adds up to 40
    const proj = (x, y, z) => {
      const cx = cam[0] * x + cam[4] * y + cam[8] * z + cam[12], cy = cam[1] * x + cam[5] * y + cam[9] * z + cam[13], cz = cam[2] * x + cam[6] * y + cam[10] * z + cam[14];
      return [cx, cy, cz];
    };
    for (let a0 = 0; a0 < 65536; a0 += 4096) {
      const edges = [a0, a0 + 4096];
      let prev = null;
      for (let i = 0; i <= 33; i++) {
        const pair = [];
        let ok = true;
        for (const a of edges) {
          let p;
          if (i === 33) p = proj(0, 0, 38750);
          else {
            const sc = 1 + 0.05 * mdSin((fc * 100 + i * 5120) & 0xFFFF);
            p = proj(R * mdSin(a) * sc, R * mdCos(a) * sc, i * 1250 - 2500);
          }
          if (p[2] < 2050) { ok = false; break; }
          const X = FX * p[0] / p[2], Y = FY * p[1] / p[2];
          if (i < 33 && (Math.abs(X / 2.25 + 48) > 1000 || Math.abs(Y / 4.82 + 48) > 1000)) { ok = false; break; }
          // S runs 0..3 over the 128x128 page, which holds the 64x64 texture tiled 2x2 (0x22A7F4)
          const s = (a / 65535) * 3 * 2, t = (i === 33 ? 1 + scroll : i / 32 + scroll) * 3 * 2;
          let r = bg, g = bg, b = bg;
          if (i < 33) {
            const pp = ((32 - i) ** 3) >> 10, tint = Math.trunc((mdCos(a) + 1) * 10);
            r = ((pp * 230) >> 5) + bg + tint; g = ((pp * 260) >> 5) + bg + tint; b = g;
          }
          const dx = 720 + off.x + X, dy = 540 + off.y + Y, w = p[2];
          pair.push({ position: [this.ndcX(dx) * w, this.ndcY(dy) * w, 0, w], aST: [s, t], aCol: [r / 128 * w, g / 128 * w, b / 128 * w, w] });
        }
        if (!ok) { prev = null; continue; }
        if (prev) B.quad([prev[0], pair[0], pair[1], prev[1]]);
        prev = pair;
      }
    }
    B.commit();
  }

  // project one face set into the glass batch. xf(v) -> { cam: camera-space point (ROM units, y down), dx, dy, z }
  // pieces: [{ faces, normals, xf, nf(n) -> camera-space normal, col, size, extra, mask }]
  buildGlass(pieces, ref, mode, colOverride) {
    const B = this.gl; B.reset();
    for (const pc of pieces) {
      pc.faces.forEach((q, fi) => {
        if (pc.mask && !pc.mask(fi)) return;
        const P = q.map(pc.xf);
        const n = pc.nf(pc.normals[fi]);
        const v0 = P[0].cam, l = v0.length();
        const fres = 1 - Math.abs(v0.dot(n) / l);
        // near = the face turned toward the eye (the ROM's cull != 0 set), far = seen through the glass
        const near = v0.dot(n) < 0 ? 1 : 0;
        let col;
        if (mode === 'flat') { const s = fres * fres; col = pc.col.map((c) => Math.min(255, Math.trunc(s * c)) / 255); }
        else if (mode === 'refl' || mode === 'bloom') col = pc.col.map((c) => c / 128);
        else {
          let bright = Math.trunc(pc.size * 10 * fres ** 4);
          if (fres > 0.9) bright = Math.trunc(bright * (1 - Math.cos((1 - fres) / 0.1 * Math.PI)) * 0.5);
          col = pc.col.map((c) => Math.min(255, bright + c + pc.extra) / 128);
        }
        const verts = P.map((p, k) => {
          let u, v;
          const uv2 = pc.uv ? [pc.uv[fi][k][0] + pc.phase + fi * 0.1, pc.uv[fi][k][1] + pc.phase + fi * 0.1 + (pc.vofs || 0)] : [0, 0];
          if (mode === 'refl' || mode === 'bloom') {
            const nn = p.cam.clone().normalize(), d = Math.abs(2 * nn.dot(n));
            const r = nn.add(n.clone().multiplyScalar(d));
            u = (r.x + 1) * 0.5; v = (r.y + 1) * 0.25;
          } else {
            const q1 = 1 / p.z;                             // 1/w, w = camera-space depth in ROM units
            const nx = n.x * 1000 * q1 * 2.25, ny = n.y * 500 * q1 * (1080 / 224);
            const xr = p.dx - 720, yr = p.dy - 540;
            const U = (xr - ref.x) * 0.95 + ref.x - nx + 720, V = (yr - ref.y) * 0.95 + ref.y - ny + 540;
            u = this.uvX(Math.max(U, 0)); v = this.uvY(V);
          }
          return { position: [this.ndcX(p.dx), this.ndcY(p.dy), 0], aUV: [u, v], aUV2: uv2, aCol: col, aSet: [near] };
        });
        B.quad(verts);
      });
    }
    B.commit();
  }

  drawGlass(r, tgt, tex, set, mode, blend = THREE.NoBlending) {
    const m = this.glassMat;
    m.uniforms.uTex.value = tex; m.uniforms.uSet.value = set; m.uniforms.uMode.value = mode; m.uniforms.uBump.value = this.bump;
    setBlend(m, blend); m.needsUpdate = true;
    r.setRenderTarget(tgt); r.render(this.glassScene, this.fsCam);
  }
  fs(r, tgt, mat, uniforms) {
    for (const k in uniforms) mat.uniforms[k].value = uniforms[k];
    this.fsQuad.material = mat;
    r.setRenderTarget(tgt); r.render(this.fsScene, this.fsCam);
  }
}
