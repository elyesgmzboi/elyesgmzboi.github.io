// The opening: the "Sony Computer Entertainment" scene, rebuilt from the retail OSDSYS ROM (aap/osdbits opening.c:
// InitOpeningScene, ProcessOpeningAnimation, DrawOpeningScene, DrawTowers, DrawFog, DrawLights, DrawCube, DoSCEText).
//
// The camera sits at z 16 looking down +z at a 14 x 9 field of towers (on the console the field is the memory card's
// boot history: every game launched owns a few cells), seen end-on so their lit near caps read as squares. Six
// scrolling cloud layers make the blue nebula in front of them, four small coloured lights orbit through it trailing
// lines, and five glass cubes refract the lot. The camera creeps forward and rolls, after two seconds it accelerates
// (0.0099 per frame^2) and dives through the nebula; the screen fades to black from z 72 and the scene ends at z 104.
// The tower layer keeps a decaying copy of earlier frames (the ROM's half-width save buffer blended back at 80/128),
// which is what smears the squares when the view rolls.
import * as THREE from 'three';
import { World } from './stage.js';
import { fbm } from './tex.js';
import { osd } from './osdclock.js';

const FX = 1024 * 2.25, FY = 1024 * 0.47 * (1080 / 224);   // sceVu0ViewScreenMatrix(1024, ...) in interface px
const DEG = 0.01745329;

// ---------------------------------------------------------------- ROM tables
// tower source positions, real 0x27a670 [14][9] (x, y, z)
const SRC = [
  [[-13.7428,11.7512,-2.5366],[-13.7428,10.4512,-2.5366],[-13.7428,9.1512,-2.5366],[-13.1428,7.8512,-2.5366],[-13.7428,6.5512,-6.5517],[-13.7428,5.2512,-2.5366],[-13.7428,3.9512,-2.5366],[-13.7428,2.6512,-2.5366],[-13.7428,1.3512,-2.5366]],
  [[-12.4428,11.7512,-2.5366],[-12.4428,10.4512,-2.5366],[-12.4428,9.1512,-2.5366],[-12.1428,7.8512,-0.933],[-12.4428,6.5512,-2.5366],[-12.4428,5.2512,-2.5366],[-12.4428,3.9512,-2.5366],[-12.4428,2.6512,-2.5366],[-12.4428,1.3512,-2.5366]],
  [[-11.1428,11.7512,-2.5366],[-11.1428,10.4512,-2.5366],[-11.1428,9.1512,-3.2422],[-11.1428,7.8512,-2.5366],[-11.1428,6.5512,-3.1781],[-11.1428,5.2512,-2.5366],[-11.1428,3.9512,-2.5366],[-11.1428,2.6512,-2.5366],[-11.1428,1.3512,-2.5366]],
  [[-9.8428,11.7512,-2.5366],[-9.8428,10.4512,-2.5366],[-9.8428,9.1512,-2.5366],[-9.8428,7.8512,-3.3705],[-9.8428,6.5512,-4.0119],[-9.8428,5.2512,-2.5366],[-9.8428,3.9512,-2.5366],[-9.8428,2.6512,-2.5366],[-9.8428,1.3512,-3.2422]],
  [[-8.5428,11.7512,-2.5366],[-8.5428,10.4512,-2.5366],[-8.5428,9.1512,-2.5366],[-8.5428,7.8512,-5.4054],[-8.5428,6.5512,-4.4491],[-8.5428,5.2512,-2.5366],[-8.5428,3.9512,-3.5629],[-8.5428,2.6512,-2.5366],[-8.5428,1.3512,-2.5366]],
  [[-7.2428,11.7512,-2.5366],[-7.2428,10.4512,-2.5366],[-7.2428,9.1512,-2.5366],[-7.2428,7.8512,-5.4097],[-7.2428,6.5512,-3.8195],[-7.2428,5.2512,-2.5366],[-7.2428,3.9512,-3.5629],[-7.2428,2.6512,-2.5366],[-7.2428,1.3512,-2.5366]],
  [[-5.9428,11.7512,-2.5366],[-5.9428,10.4512,-2.5366],[-5.9428,9.1512,-2.5366],[-5.9428,7.8512,-3.3705],[-5.9428,6.5512,-4.4491],[-5.9428,5.2512,-3.8195],[-5.9428,3.9512,-0.0309],[-5.9428,2.6512,-2.5366],[-5.9428,1.3512,-2.5366]],
  [[-4.6428,11.7512,-2.5366],[-4.6428,10.4512,-2.5366],[-4.6428,9.1512,-2.5366],[-4.6428,7.8512,-2.5366],[-4.6428,6.5512,-3.8195],[-4.6428,5.2512,-2.5366],[-4.6428,3.9512,-2.5366],[-4.6428,2.6512,-4.5251],[-4.6428,1.3512,-2.5366]],
  [[-3.3428,11.7512,-2.5366],[-3.3428,10.4512,-2.5366],[-3.3428,9.1512,-5.0383],[-3.3428,7.8512,-4.5892],[-3.3428,6.5512,-3.5629],[-3.3428,5.2512,-4.5766],[-3.3428,3.9512,-2.8536],[-3.3428,2.6512,-0.619],[-3.3428,1.3512,-2.5366]],
  [[-2.0428,11.7512,-2.5366],[-2.0428,10.4512,-2.5366],[-2.0428,9.1512,-2.5366],[-2.0428,7.8512,-2.5366],[-2.0428,6.5512,-3.3654],[-2.0428,5.2512,-2.8799],[-2.0428,3.9512,-2.5366],[-2.0428,2.6512,-2.5366],[-2.0428,1.3512,-2.5366]],
  [[-0.7428,11.7512,-2.5366],[-0.7428,10.4512,-2.5366],[-0.7428,9.1512,0.7348],[-0.7428,7.8512,-2.5366],[-0.7428,6.5512,-2.5366],[-0.7428,5.2512,-2.8554],[-0.7428,3.9512,-4.267],[-0.7428,2.6512,-2.5366],[-0.7428,1.3512,-2.5366]],
  [[0.5572,11.7512,-2.5366],[0.5572,10.4512,-2.5366],[0.5572,9.1512,-2.5366],[0.5572,7.8512,-3.0466],[0.5572,6.5512,-3.6204],[0.5572,5.2512,-2.8554],[0.5572,3.9512,-2.5366],[0.5572,2.6512,-2.5366],[0.5572,1.3512,-2.5366]],
  [[1.8572,11.7512,-2.5366],[1.8572,10.4512,-2.5366],[1.8572,9.1512,-2.5366],[1.8572,7.8512,-2.5366],[1.8572,6.5512,-2.5366],[1.8572,5.2512,-3.1741],[1.8572,3.9512,-2.5366],[1.8572,2.6512,-2.5366],[1.8572,1.3512,-2.5366]],
  [[3.1572,11.7512,-2.5366],[3.1572,10.4512,-2.5366],[3.1572,9.1512,-2.5366],[3.1572,7.8512,-2.5366],[3.1572,6.5512,-2.5366],[3.1572,5.2512,-2.5366],[3.1572,3.9512,-2.5366],[3.1572,2.6512,-2.5366],[3.1572,1.3512,-2.5366]],
];
// the 21 boot-history slots' 6-cell neighbourhoods, real 0x27a260
const CELLS = [
  [[0,0],[0,1],[0,2],[0,3],[1,0],[1,1]], [[1,2],[2,0],[2,1],[2,2],[3,0],[4,0]], [[4,1],[5,0],[5,1],[6,0],[6,1],[6,2]],
  [[7,0],[7,1],[8,0],[8,1],[8,2],[8,3]], [[9,0],[9,1],[10,0],[10,1],[10,2],[11,0]], [[12,0],[12,1],[13,0],[13,1],[13,2],[13,3]],
  [[1,3],[2,3],[3,1],[3,2],[3,3],[4,2]], [[5,2],[5,3],[5,4],[6,3],[7,2],[7,3]], [[9,2],[9,3],[9,5],[10,3],[10,4],[10,5]],
  [[11,1],[11,2],[11,3],[11,4],[12,2],[12,3]], [[0,4],[1,4],[2,4],[2,5],[2,6],[3,4]], [[3,5],[3,6],[4,3],[4,4],[4,5],[4,6]],
  [[5,5],[5,6],[6,4],[6,5],[7,4],[7,5]], [[8,4],[8,5],[8,6],[9,4],[9,6],[9,7]], [[12,4],[13,4],[13,5],[13,6],[13,7],[13,8]],
  [[0,5],[0,6],[1,5],[1,6],[1,7],[2,7]], [[0,7],[0,8],[1,8],[2,8],[3,7],[3,8]], [[4,7],[4,8],[5,7],[5,8],[6,6],[6,7]],
  [[6,8],[7,6],[7,7],[7,8],[8,7],[8,8]], [[9,8],[10,6],[10,7],[10,8],[11,7],[11,8]], [[11,5],[11,6],[12,5],[12,6],[12,7],[12,8]],
];
const HIST_C = [0.2, 0.4, 0.6, 0.8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];          // real 0x27aee0
const HIST_D = [0.1, 0.1, 0.1, 0.1, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];   // real 0x27af18
// a memory card's history: [slot, launches, extra-cell mask, own cell] - twenty games, two of them played often
// enough to sprawl into long towers (the capture's console shows several, lower right and centre)
const HISTORY = [[0, 3, 0, 2], [1, 1, 0, 4], [2, 6, 0, 1], [3, 2, 0, 3], [4, 16, 0b000110, 4], [5, 4, 0, 1], [6, 2, 0, 5],
  [7, 1, 0, 2], [8, 4, 0, 4], [9, 20, 0b100001, 2], [10, 3, 0, 3], [11, 1, 0, 5], [12, 2, 0, 0], [13, 1, 0, 2],
  [15, 5, 0, 4], [16, 1, 0, 1], [17, 2, 0, 3], [18, 2, 0, 5], [19, 1, 0, 0], [20, 3, 0, 2]];

// the light colours (DrawLights)
const LIGHT_COL = [[32, 128, 0], [128, 32, 64], [128, 0, 0], [64, 32, 128]];
// cube seeds, real 0x27a210
const CUBE_SEED = [[3.5679, 0.5447, 2.5932], [-0.9042, -1.1173, 3.7952], [3.2639, -2.6491, 4.1075], [-3.7296, -2.3677, 4.3654], [-3.1017, 2.2409, 4.5429]];
// the ROM notes read the corner builder's argument (1.8) as the half extent; on the reference boot the cubes are about
// a little over half that size (the towers and lights match the same camera to a few px), so the half extent is 1.0
const CUBE_HALF = 1.0, CUBE_BASE = [112, 112, 127];
const CUBE_FACES = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 6, 2], [2, 3, 6, 7], [1, 5, 3, 7], [4, 5, 0, 1]];
const CUBE_N = [[0, 0, -1], [0, 0, 1], [-1, 0, 0], [0, 1, 0], [1, 0, 0], [0, -1, 0]];
const TOWER_HALF = 1.75;
// the capture's console frames the opening smaller than the ROM's 640 x 448 view maps onto the interface: its picture
// is the ROM's scaled by VIEW_S about the projection centre, which lands at VIEW_C (fitted on the nebula over the
// first 2.2 s, _scratch/ps2ref/bootscale.py, two passes: error 1305 against 2182 unscaled)
const VIEW_S = 0.794, VIEW_C = [733.3, 520.3];
// the opening runs at 30 frames a second (the capture shows every picture for two fields), on the ROM's constants;
// the one console-dependent moment is the no-disc go (the drive giving up), at frame GO, fitted to the capture's black
const GO = 81;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- textures (the ROM's are replaced by look-alikes)
function dataTex(n, fn, wrap = THREE.RepeatWrapping) {
  const d = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) { const c = fn(i % n, Math.floor(i / n)); d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = c[3] ?? 255; }
  const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = wrap; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}
// TEXOFOG1/2/4: 64 x 64 grey cloud tiles
const fogTex = (seed, scale) => dataTex(64, (x, y) => { const v = fbm(x / 64 * scale, y / 64 * scale, seed, 5, scale); const g = clamp(255 * (0.56 + (v - 0.5) * 1.15), 0, 255); return [g, g, g]; });
// TEXOWAL0: the tower wall, a light grey with faint streaks
const wallTex = () => {
  const t = dataTex(64, (x, y) => { const v = 132 + 10 * (fbm(x / 64 * 4, y / 64 * 16, 5, 3, 4) - 0.5) + 6 * Math.sin(y / 64 * 6.283 * 3); return [v, v, v + 4]; }, THREE.ClampToEdgeWrapping);
  return t;
};
// TEXCRBL: a soft round blob
const blobTex = () => dataTex(64, (x, y) => { const r = Math.hypot(x - 31.5, y - 31.5) / 32; const v = 255 * Math.exp(-r * r * 5) * clamp((1 - r) * 4, 0, 1); return [v, v, v, 255]; }, THREE.ClampToEdgeWrapping);

// ---------------------------------------------------------------- shaders
// interface px (720 + FX x/z, 540 + FY y/z) -> the picture's NDC (uMap = ax, bx, ay, by: ndc = a + b px)
const PROJ = `uniform vec3 uCam; uniform vec2 uRot; uniform vec4 uMap;
vec4 proj(vec3 p){ vec3 d = p - uCam; float xc = d.x * uRot.x - d.y * uRot.y; float yc = d.x * uRot.y + d.y * uRot.x;
  return vec4((uMap.x + uMap.y * 720.0) * d.z + uMap.y * ${FX.toFixed(3)} * xc, (uMap.z + uMap.w * 540.0) * d.z + uMap.w * ${FY.toFixed(3)} * yc,
    ((d.z - 1.0) / 1999.0 * 2.0 - 1.0) * d.z, d.z); }`;
const TOWER_V = `precision highp float; attribute vec3 position; attribute vec3 aCol; attribute vec2 aUV; varying vec3 vCol; varying vec2 vUV; ${PROJ}
void main(){ vCol = aCol; vUV = aUV; gl_Position = proj(position); }`;
const TOWER_F = `precision highp float; uniform sampler2D uTex; varying vec3 vCol; varying vec2 vUV;
void main(){ gl_FragColor = vec4(min(texture2D(uTex, vUV).rgb * vCol, 1.0), 1.0); }`;
const FOG_V = `precision highp float; attribute vec3 position; attribute vec3 aCol; attribute vec2 aUV; uniform float uAnim; varying vec3 vCol; varying vec2 vUV; ${PROJ}
void main(){ vCol = aCol; vUV = aUV - vec2(uAnim, 0.0); gl_Position = proj(position); }`;
const FOG_F = `precision highp float; uniform sampler2D uTex; varying vec3 vCol; varying vec2 vUV;
void main(){ gl_FragColor = vec4(min(texture2D(uTex, vUV).rgb * vCol, 1.0) * (20.0 / 128.0), 1.0); }`;
// screen-space primitives (lights, trails, cube faces): NDC positions, affine like the GS's FST texturing
const SCR_V = `precision highp float; attribute vec3 position; attribute vec4 aCol; attribute vec2 aUV; varying vec4 vCol; varying vec2 vUV;
void main(){ vCol = aCol; vUV = aUV; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const SPRITE_F = `precision highp float; uniform sampler2D uTex; uniform float uTexOn; varying vec4 vCol; varying vec2 vUV;
void main(){ float t = mix(1.0, texture2D(uTex, vUV).r, uTexOn); gl_FragColor = vec4(vCol.rgb * t * vCol.a, 1.0); }`;
// cube faces: sample a buffer at the computed screen UV, MODULATE by the vertex colour (/128), plus the dim env layer
const CUBE_F = `precision highp float; uniform sampler2D uTex; varying vec4 vCol; varying vec2 vUV;
void main(){ vec3 b = texture2D(uTex, clamp(vUV, 0.001, 0.999)).rgb; float behind = smoothstep(0.004, 0.03, max(b.r, max(b.g, b.b)));
  gl_FragColor = vec4(min(b * vCol.rgb + vCol.a * behind, 1.0), 1.0); }`;
const FS_V = 'precision highp float; attribute vec3 position; attribute vec2 uv; varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const fsMat = (frag, uniforms, add) => new THREE.RawShaderMaterial({ vertexShader: FS_V, fragmentShader: 'precision highp float; varying vec2 vUv;\n' + frag, uniforms, depthTest: false, depthWrite: false,
  ...(add ? { transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation } : {}) });
const ADD = { transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };

function rt(depth, w = 4, h = 4) {
  const t = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthBuffer: depth, stencilBuffer: false });
  t.texture.minFilter = t.texture.magFilter = THREE.LinearFilter; t.texture.generateMipmaps = false;
  return t;
}
class Batch {   // a growable dynamic buffer of quads (4 verts, 6 indices each)
  constructor(n, attrs) {
    this.g = new THREE.BufferGeometry(); this.n = n; this.a = {};
    for (const [k, s] of Object.entries(attrs)) { const b = new THREE.BufferAttribute(new Float32Array(n * 4 * s), s).setUsage(THREE.DynamicDrawUsage); this.g.setAttribute(k, b); this.a[k] = b; }
    const idx = new Uint32Array(n * 6);
    for (let q = 0; q < n; q++) idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 1, q * 4 + 3, q * 4 + 2], q * 6);
    this.g.setIndex(new THREE.BufferAttribute(idx, 1)); this.q = 0;
  }
  begin() { this.q = 0; }
  quad(verts) {   // verts: 4 x { attr: [..] }, tristrip order (0 1 2 3)
    if (this.q >= this.n) return;
    for (let k = 0; k < 4; k++) for (const key in this.a) { const at = this.a[key], s = at.itemSize, v = verts[k][key]; for (let j = 0; j < s; j++) at.array[(this.q * 4 + k) * s + j] = v[j]; }
    this.q++;
  }
  end() { for (const k in this.a) this.a[k].needsUpdate = true; this.g.setDrawRange(0, this.q * 6); }
}

// ---------------------------------------------------------------- the world
export class BootWorld extends World {
  constructor(stage, app) {
    super(stage);
    this.app = app;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.wall = wallTex(); this.blob = blobTex();
    this.fogTexs = [fogTex(11, 4), fogTex(23, 4), fogTex(37, 8)];   // FOG4, FOG2, FOG1
    this.uCam = { value: new THREE.Vector3(0, 0, 16) }; this.uRot = { value: new THREE.Vector2(1, 0) }; this.uMap = { value: new THREE.Vector4(-1, 1 / 720, 1, -1 / 540) };
    // towers
    this.towers = new Batch(126 * 6, { position: 3, aCol: 3, aUV: 2 });
    this.towerMat = new THREE.RawShaderMaterial({ vertexShader: TOWER_V, fragmentShader: TOWER_F, uniforms: { uTex: { value: this.wall }, uCam: this.uCam, uRot: this.uRot, uMap: this.uMap }, side: THREE.DoubleSide });
    this.towerScene = new THREE.Scene(); const tm = new THREE.Mesh(this.towers.g, this.towerMat); tm.frustumCulled = false; this.towerScene.add(tm);
    // fog: six 16 x 16 quad layers
    this.fogScene = new THREE.Scene(); this.fogMats = [];
    const fogCol = [];
    const sq = Math.sqrt(5202);
    for (let y = 0; y < 17; y++) for (let x = 0; x < 17; x++) {
      const dx = -5.1 - ((2 * x - 16) * 3 + 3), dy = -((2 * y - 16) * 3 + 3);
      const c = clamp(((sq - Math.hypot(dx, dy) * 4) * 96 / sq) | 0, 0, 127);
      fogCol[y * 17 + x] = [(c / 4 | 0) / 128, (c * 2 / 5 | 0) / 128, c / 128];
    }
    for (let l = 0; l < 6; l++) {
      const b = new Batch(256, { position: 3, aCol: 3, aUV: 2 });
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = [];
        for (let k = 0; k < 4; k++) {
          const vx = x + (k % 2), vy = y + (k >> 1);
          v.push({ position: [(vx - 8) * 6 + 2, (vy - 8) * 6, 134 - l * 5], aCol: fogCol[vy * 17 + vx], aUV: [(k % 2) * 0.5 + (x % 2) * 0.5 + Math.floor(x / 2), (k >> 1) * 0.5 + (y % 2) * 0.5 + Math.floor(y / 2)] });
        }
        b.quad(v);
      }
      b.end();
      const m = new THREE.RawShaderMaterial({ vertexShader: FOG_V, fragmentShader: FOG_F, uniforms: { uTex: { value: this.fogTexs[l % 3] }, uAnim: { value: 0 }, uCam: this.uCam, uRot: this.uRot, uMap: this.uMap }, depthTest: false, depthWrite: false, side: THREE.DoubleSide, ...ADD });
      const mesh = new THREE.Mesh(b.g, m); mesh.frustumCulled = false; mesh.renderOrder = l; this.fogScene.add(mesh); this.fogMats.push(m);
    }
    // lights + trails (screen space, additive)
    this.spr = new Batch(4 * 4 * 2, { position: 3, aCol: 4, aUV: 2 });
    this.sprMat = new THREE.RawShaderMaterial({ vertexShader: SCR_V, fragmentShader: SPRITE_F, uniforms: { uTex: { value: this.blob }, uTexOn: { value: 1 } }, depthTest: false, depthWrite: false, side: THREE.DoubleSide, ...ADD });
    this.trl = new Batch(4 * 20, { position: 3, aCol: 4, aUV: 2 });
    this.trlMat = new THREE.RawShaderMaterial({ vertexShader: SCR_V, fragmentShader: SPRITE_F, uniforms: { uTex: { value: this.blob }, uTexOn: { value: 0 } }, depthTest: false, depthWrite: false, side: THREE.DoubleSide, ...ADD });
    this.lightScene = new THREE.Scene();
    for (const [b, m] of [[this.trl, this.trlMat], [this.spr, this.sprMat]]) { const o = new THREE.Mesh(b.g, m); o.frustumCulled = false; this.lightScene.add(o); }
    // cubes (screen space faces sampling a buffer)
    this.cube = new Batch(6, { position: 3, aCol: 4, aUV: 2 });
    this.cubeMat = new THREE.RawShaderMaterial({ vertexShader: SCR_V, fragmentShader: CUBE_F, uniforms: { uTex: { value: null } }, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    this.cubeScene = new THREE.Scene(); { const o = new THREE.Mesh(this.cube.g, this.cubeMat); o.frustumCulled = false; this.cubeScene.add(o); }
    // full-screen passes
    this.fsScene = new THREE.Scene(); this.fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.fsQuad.frustumCulled = false; this.fsScene.add(this.fsQuad);
    this.mCopy = fsMat('uniform sampler2D uT; void main(){ gl_FragColor = vec4(texture2D(uT, vUv).rgb, 1.0); }', { uT: { value: null } });
    this.mMix = fsMat('uniform sampler2D uA, uB; uniform float uK; void main(){ gl_FragColor = vec4(mix(texture2D(uA, vUv).rgb, texture2D(uB, vUv).rgb, uK), 1.0); }', { uA: { value: null }, uB: { value: null }, uK: { value: 0.625 } });
    this.mBlur = fsMat('uniform sampler2D uT; uniform vec2 uPx; void main(){ vec3 c = texture2D(uT, vUv).rgb * 0.4 + (texture2D(uT, vUv + uPx).rgb + texture2D(uT, vUv - uPx).rgb + texture2D(uT, vUv + vec2(uPx.x, -uPx.y)).rgb + texture2D(uT, vUv - vec2(uPx.x, -uPx.y)).rgb) * 0.15; gl_FragColor = vec4(c, 1.0); }', { uT: { value: null }, uPx: { value: new THREE.Vector2() } });
    this.mOut = fsMat('uniform sampler2D uT; uniform float uBlack, uLo; vec3 dec(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); } void main(){ vec3 c = texture2D(uT, vUv).rgb * (1.0 - uBlack); c = clamp((c - uLo) / (1.0 - uLo), 0.0, 1.0); gl_FragColor = vec4(dec(c), 1.0); }', { uT: { value: null }, uBlack: { value: 1 }, uLo: { value: 10 / 255 } });
    this.T = rt(true); this.P = rt(false); this.P2 = rt(false); this.W = rt(false); this.save = rt(false);
    this.start();
    // test hook: jump the scene to OSD frame f
    window.__bootAt = (f) => { this.start(); for (let i = 0; i < f; i++) this.tick(); return { z: this.z, rot: this.rot, text: this.textAlpha }; };
    window.__boot = this;
  }

  // InitOpeningScene + InitAnimation + OpeningInitTowersFog
  start() {
    this.frame = 0; this.ticks = 0; this.pending = 0; this.fields = 0;
    // InitAnimation: the camera creeps from the first picture, 0.04 a frame forward and 0.001 roll
    this.z = 16; this.speed = 0.04; this.acc1 = 0; this.acc2 = 0;
    this.rot = -0.12; this.rotSpeed = 0.001; this.rotAcc = 0;
    this.state = 0; this.go = false; this.ended = false;
    this.textAlpha = 0; this.textStep = 4; this.textState = 0;
    this.fogAnim = [0, 0, 0, 0, 0, 0];
    this.lightsSeed = 4002;    // osdRand() % 2345 + 3456 at the ROM's draw #386 (savestate-verified in osdbits)
    this.lightHist = [0, 1, 2, 3].map(() => []);     // screen positions, last 4 frames (the matrix history)
    this.trail = [0, 1, 2, 3].map(() => []);          // screen positions, last 128 frames
    this.cubeAng = CUBE_SEED.map((s, i) => { const d = i === 2 ? 0.9 : (i - 2) * 0.8; const v = d * (i % 3) * 3.7 + 0.2856; return [v, v, v]; });
    this.cubeRate = CUBE_SEED.map((s, i) => { const d = i === 2 ? 0.9 : (i - 2) * 0.8; return [0.0031 / d, d * 0.0022, d / 1000 + 0.0013]; });
    this.cubePos = CUBE_SEED.map((s) => [s[0] * 3.5, s[1] * 3.5, s[2] * -15 + 150]);
    this.buildField();
    this.clearSave = true;
  }

  buildField() {
    const flags = [], C = [], D = [];
    for (let r = 0; r < 14; r++) { flags[r] = []; C[r] = []; D[r] = []; for (let c = 0; c < 9; c++) { flags[r][c] = 0; C[r][c] = 0; D[r][c] = 0; } }
    for (const [slot, count, mask, own] of HISTORY) {
      const tidx = count < 14 ? count : (count - 14) % 10 + 4;
      CELLS[slot].forEach(([r, c], t) => {
        if (t === own) { flags[r][c] = 1; C[r][c] = HIST_C[tidx]; D[r][c] = HIST_D[tidx]; }
        else if (mask >> t & 1) { flags[r][c] = 1; C[r][c] = 1; D[r][c] = 1; }
      });
    }
    // HeightGrid: the radial brightness falloff
    const grid = [], sq = Math.sqrt(5202);
    for (let i = 0; i < 20; i++) { grid[i] = []; for (let j = 0; j < 20; j++) {
      const gx = (i - 10) * 5.1 + 2.55, gy = (j - 10) * 5.1 + 2.55;
      const d1 = 2 * Math.hypot(-5.1 - gx, gy), d2 = 4 * Math.hypot(10.2 - gx, 5.1 - gy);
      let v = clamp(255 * (sq - d1) / sq, 32, 255) + clamp(255 * (sq - d2) / sq * 0.5, 32, 255);
      v *= 0.85; v -= 10 * (Math.trunc(((i + j) * i) / (j + 1)) % 11 - 5);
      grid[i][j] = clamp(v, 32, 220);
    } }
    this.field = [];
    for (let r = 0; r < 14; r++) for (let c = 0; c < 9; c++) {
      if (!flags[r][c]) continue;
      const s = SRC[r][c];
      const f0 = Math.max(3, D[r][c] * 30);
      const B = C[r][c] >= 1 ? 0 : Math.trunc((1 - C[r][c]) * 128);
      const f12 = grid[r + 3][c + 6] * (B !== 0 ? B / 128 : f0 / 30);
      const pos = [(s[0] + 4.8) * 4, (s[1] - 6.5) * 4, (s[2] + 4) * 12 + 150 + C[r][c] * 30 - f0];
      const q = Math.trunc((r + c + 9) * (r + 3) / 7);
      const a0 = Math.trunc((r + c + 9) * (r + 8) / (c + 7)) + Math.trunc((r + c + 9) * (r + 7) / (c + 9));
      this.field.push({ pos, f0, f12, turn: (q % 4) * Math.PI / 2, sway: C[r][c] !== 1, u: a0 / 256 });
    }
  }

  // one frame of ProcessOpeningAnimation + the per-frame state of the draw functions, on every other console field
  // (30 fps: the capture repeats each opening picture for two fields). On the ROM's own constants this lands the
  // capture's events: text starts in at 1.57 s (capture 1.54), is full at 2.47 (2.55), starts out at 4.63 (4.62);
  // the fog, the cubes and the lights step in their draw functions (DrawFog, cube_21BF88, DrawLights on frameCount)
  tick() {
    if (this.ended) return;
    if (this.fields++ & 1) return;
    const n = this.ticks++;
    const f = this.frame;
    const LV = [16, 56, 104, 320];
    if (LV[this.state] < this.z) this.state++;
    if (this.state === 1) { this.acc1 = 0.0000004; if (f > GO) { this.go = true; this.state = 2; } }   // the go (see GO)
    else if (this.state === 2) { this.acc2 = 0.0099; this.rotAcc = 0.000195; }
    else if (this.state >= 3) { this.ended = true; return; }
    this.rotSpeed += this.rotAcc;
    this.speed += (2 * this.acc2 + this.acc1) * 0.5;
    this.acc2 += this.acc1;
    this.rot += (2 * this.rotSpeed + this.rotAcc) * 0.5;
    this.z += (2 * this.speed + this.acc2) * 0.5;
    if (this.rot > Math.PI) this.rot -= 2 * Math.PI;
    // DoSCEText: armed past z 18, alpha 0 -> peak -> 0 in steps of 4, drawn at min(alpha, 112)
    if (this.z > 18 && this.textState === 0) this.textState = 1;
    if (this.textState === 1) {
      this.textAlpha += this.textStep;
      if (this.textAlpha === 240) this.textStep = -4;
      if (this.textAlpha === 0) { this.textStep = 4; this.textState = -1; }
    }
    this.frame++;
    for (let l = 0; l < 6; l++) { this.fogAnim[l] += (14 - l) * 0.0001 * (l + 1) * 0.5; if (this.fogAnim[l] > 1) this.fogAnim[l] -= 1; }
    for (let i = 0; i < 5; i++) for (let k = 0; k < 3; k++) { let a = this.cubeAng[i][k] + this.cubeRate[i][k]; if (a > Math.PI) a -= 2 * Math.PI; if (a < -Math.PI) a += 2 * Math.PI; this.cubeAng[i][k] = a; }
    // the lights: positions this frame, kept as screen positions (the ROM keeps the last four matrices and a
    // 128-entry trail of transformed vertices)
    for (let l = 0; l < 4; l++) {
      const c = Math.cos((n + this.lightsSeed + l * 17) * 0.01 * (l + 10) * 0.1);
      const s = Math.sin((n + this.lightsSeed + l * 15) * 0.005 * (l + 10) * 0.1);
      const p = this.project([(10 - l) * c, (3 + l) * s, c * 12 + 88]);
      const h = this.lightHist[l]; h.push(p); if (h.length > 4) h.shift();
      const t = this.trail[l]; t.push(p); if (t.length > 128) t.shift();
    }
    this.pending++;
  }

  // compile every program and allocate every buffer the opening uses (the dive's blur pass included) before it is
  // first shown: a first draw compiles its shaders, ~40 ms here, which stalled the opening's first pictures
  warm(r, target) {
    this.render(r, target);
    this.fs(r, this.P2, this.mBlur, { uT: this.P.texture, uPx: new THREE.Vector2(0.001, 0.001) });
    this.start();
  }

  // camera space and screen position (interface px) of a world point
  camSpace(p) {
    const cr = Math.cos(this.rot), sr = Math.sin(this.rot);
    const dx = p[0], dy = p[1], dz = p[2] - this.z;
    return [dx * cr - dy * sr, dx * sr + dy * cr, dz];
  }
  project(p) { const c = this.camSpace(p); return { x: 720 + FX * c[0] / c[2], y: 540 + FY * c[1] / c[2], z: c[2] }; }

  buildTowers() {
    const b = this.towers; b.begin();
    const sway = Math.sin(((this.frame % 360) - 180) * DEG) * 10 * DEG;
    const H = TOWER_HALF;
    // corners in the tower's frame: (+-H, +-H, -+f0); the six quads of the ROM packet (cap first)
    for (const t of this.field) {
      const a = t.turn + (t.sway ? sway : 0), ca = Math.cos(a), sa = Math.sin(a);
      const P = (x, y, z) => [t.pos[0] + x * ca - y * sa, t.pos[1] + x * sa + y * ca, t.pos[2] + z];
      const f0 = t.f0, lit = t.f12 / 128, side = lit * 0.8, u = t.u;
      const near = -f0, far = f0;
      const faces = [
        [[-H, -H, near], [H, -H, near], [-H, H, near], [H, H, near]],      // the cap (seen end-on: the square)
        [[-H, -H, near], [-H, -H, far], [-H, H, near], [-H, H, far]],
        [[H, -H, far], [H, -H, near], [H, H, far], [H, H, near]],
        [[-H, H, far], [H, H, far], [-H, H, near], [H, H, near]],
        [[-H, -H, near], [H, -H, near], [-H, -H, far], [H, -H, far]],
      ];
      faces.forEach((q, fi) => {
        b.quad(q.map((v, k) => {
          const s = v[2] > 0 ? 0 : (fi === 0 ? lit : side);   // far-end vertices black: every tower fades into its tail
          return { position: P(v[0], v[1], v[2]), aCol: [s, s, s], aUV: [u + (k & 1), u + (k >> 1)] };
        }));
      });
    }
    b.end();
  }

  buildLights() {
    const m = this.uMap.value, ndc = (x, y) => [m.x + m.y * x, m.z + m.w * y, 0];
    const b = this.spr; b.begin();
    for (let l = 0; l < 4; l++) {
      const h = this.lightHist[l];
      for (let i = 0; i < h.length; i++) {
        const p = h[i], age = h.length - 1 - i, ii = 3 - age;   // i = 3 is this frame
        if (p.z < 5) continue;
        for (let j = 0; j < 2; j++) {
          const r = j === 0 ? 0.8 : 0.25, sx = r * FX / p.z, sy = r * FY / p.z;
          const col = j === 0 ? LIGHT_COL[l].map((v) => (v * 0.5 | 0) / 128) : [1, 1, 1];
          const a = Math.trunc((j === 0 ? 24 : 12) * (ii + 1) / 5) / 128;
          b.quad([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([u, v]) => ({ position: ndc(p.x + u * sx, p.y + v * sy), aCol: [...col, a], aUV: [(u + 1) / 2, (v + 1) / 2] })));
        }
      }
    }
    b.end();
    // trails: every eighth sample, newest first, fading out; a one-pixel line on the GS
    const t = this.trl; t.begin();
    for (let l = 0; l < 4; l++) {
      const tr = this.trail[l], n = tr.length; if (n < 10) continue;
      const pts = [];
      for (let j = 0; j < n - 1; j += 8) pts.push({ p: tr[n - 1 - j], a: Math.max(0, Math.trunc((n - 1 - j) * 64 / (n - 1)) - 0) });
      for (let k = 0; k < pts.length - 1; k++) {
        const A = pts[k].p, B = pts[k + 1].p; if (A.z < 5 || B.z < 5) continue;
        const a0 = Math.trunc((pts.length - 1 - k) * 64 / (pts.length - 1)) / 64, a1 = Math.trunc((pts.length - 2 - k) * 64 / (pts.length - 1)) / 64;
        let dx = B.x - A.x, dy = B.y - A.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
        const ox = -dy * 0.9, oy = dx * 1.6;
        // the GS draws the strip on one field only: half the light on the interlaced picture
        const col = (a) => [...LIGHT_COL[l].map((v) => v * 64 * a / 128 / 255 * 0.5), 1];
        t.quad([{ position: ndc(A.x + ox, A.y + oy), aCol: col(a0), aUV: [0, 0] }, { position: ndc(A.x - ox, A.y - oy), aCol: col(a0), aUV: [0, 0] },
          { position: ndc(B.x + ox, B.y + oy), aCol: col(a1), aUV: [0, 0] }, { position: ndc(B.x - ox, B.y - oy), aCol: col(a1), aUV: [0, 0] }]);
      }
    }
    t.end();
  }

  // one glass cube: back faces into W (sampling the screen), front faces onto the screen (sampling W)
  cubeFaces(i, front) {
    const b = this.cube; b.begin();
    const [ax, ay, az] = this.cubeAng[i];
    const rot = (v) => {   // sceVu0RotMatrix: Z, then Y, then X
      let [x, y, z] = v;
      [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
      [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
      [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
      return [x, y, z];
    };
    const H = CUBE_HALF, cp = this.cubePos[i];
    const corners = [], scr = [];
    for (let k = 0; k < 8; k++) {
      const v = rot([k & 1 ? H : -H, k & 2 ? H : -H, k & 4 ? H : -H]);
      const w = [cp[0] + v[0], cp[1] + v[1], cp[2] + v[2]];
      const c = this.camSpace(w); corners.push(c);
      scr.push({ x: 720 + FX * c[0] / c[2], y: 540 + FY * c[1] / c[2], q: 1 / c[2] });
    }
    if (corners.some((c) => c[2] < 2)) return false;
    const centre = this.project(cp);
    const cr = Math.cos(this.rot), sr = Math.sin(this.rot);
    let any = false;
    for (let fc = 0; fc < 6; fc++) {
      const nw = rot(CUBE_N[fc]);
      const n = [nw[0] * cr - nw[1] * sr, nw[0] * sr + nw[1] * cr, nw[2]];     // camera-space normal
      const fv = CUBE_FACES[fc];
      const cc = fv.reduce((s, k) => [s[0] + corners[k][0] / 4, s[1] + corners[k][1] / 4, s[2] + corners[k][2] / 4], [0, 0, 0]);
      const facing = n[0] * cc[0] + n[1] * cc[1] + n[2] * cc[2] < 0;
      if (facing !== front) continue;
      any = true;
      b.quad(fv.map((k) => {
        const s = scr[k], c = corners[k], L = Math.hypot(...c);
        const l = Math.abs((c[0] * n[0] + c[1] * n[1] + c[2] * n[2]) / L);
        const e = (1 - l) * (1 - l) * 0.5;
        const fix = front ? 240 : 122;
        // colour mode 2: (base + e*32) * fix/128, clamped to 128 (CubeVertexColor), MODULATE /128 - the glass never
        // brightens what it refracts, the back faces darken it to ~0.83
        const col = CUBE_BASE.map((v) => clamp((v + e * 32) * fix / 128, 0, 128) / 128);
        // cube_21B798: screen position + projected normal * (half screen) * q * 4 + centre zoom
        const zoom = front ? -0.084 : 0;
        const u = s.x + n[0] * 720 * s.q * 4 + (s.x - centre.x) * zoom;
        const v = s.y + n[1] * 540 * s.q * 4 + (s.y - centre.y) * zoom;
        // the env layers (BLPR/REF/BLP), folded into a dim additive edge term
        const env = (front ? 0.02 : 0.012) + e * (front ? 0.09 : 0.05);
        const m = this.uMap.value;
        return { position: [m.x + m.y * s.x, m.z + m.w * s.y, 0], aCol: [...col, env], aUV: [(m.x + m.y * u) * 0.5 + 0.5, (m.z + m.w * v) * 0.5 + 0.5] };
      }));
    }
    b.end();
    return any;
  }

  fs(r, tgt, mat, u) { for (const k in u) mat.uniforms[k].value = u[k]; this.fsQuad.material = mat; r.setRenderTarget(tgt); r.render(this.fsScene, this.cam); }

  render(r, target) {
    const w = target.width, h = target.height;
    for (const t of [this.T, this.P, this.P2, this.W]) if (t.width !== w || t.height !== h) t.setSize(w, h);
    if (this.save.width !== (w >> 1) || this.save.height !== h) { this.save.setSize(w >> 1, h); this.clearSave = true; }

    this.uCam.value.set(0, 0, this.z); this.uRot.value.set(Math.cos(this.rot), Math.sin(this.rot));
    const st = this.stage, f = st.frame, bx = st.box;
    const ax = (bx.x - f.x) / f.w * 2 - 1, kx = bx.s / f.w * 2, ay = 1 - (bx.y - f.y) / f.h * 2, ky = -bx.s / f.h * 2;
    this.uMap.value.set(ax + kx * (VIEW_C[0] - 720 * VIEW_S), kx * VIEW_S, ay + ky * (VIEW_C[1] - 540 * VIEW_S), ky * VIEW_S);
    const pxX = VIEW_S * bx.s * w / f.w, pxY = VIEW_S * bx.s * h / f.h;   // target pixels per (ROM-scale) interface px

    // 1 - the towers
    this.buildTowers();
    r.setRenderTarget(this.T); r.setClearColor(0, 1); r.clear(true, true);
    r.render(this.towerScene, this.cam);
    // 2 - DrawExtraBuf2(80): last frames' save stretched back over the towers at 80/128; DrawToExtraBuf2: save it
    // OpeningInitTowersFog ends by saving the first tower frame (its tail call to DrawToExtraBuf2), so the field is
    // there at full strength on the very first picture - no fade-in through the feedback
    if (this.clearSave) { this.fs(r, this.save, this.mCopy, { uT: this.T.texture }); this.clearSave = false; }
    const n = this.pending; this.pending = 0;
    this.fs(r, this.P, this.mMix, { uA: this.T.texture, uB: this.save.texture, uK: 80 / 128 });
    if (n > 0 || osd.rate === 0) this.fs(r, this.save, this.mCopy, { uT: this.P.texture });
    // 3 - fog, six additive cloud layers
    this.fogMats.forEach((m, l) => { m.uniforms.uAnim.value = this.fogAnim[l]; });
    r.setRenderTarget(this.P); r.render(this.fogScene, this.cam);
    // 4 - lights and their trails
    this.buildLights();
    r.render(this.lightScene, this.cam);
    // 5 - the glass cubes, far to near as the ROM draws them
    for (let i = 0; i < 5; i++) {
      this.fs(r, this.W, this.mCopy, { uT: this.P.texture });
      if (this.cubeFaces(i, false)) { this.cubeMat.uniforms.uTex.value = this.P.texture; r.setRenderTarget(this.W); r.render(this.cubeScene, this.cam); }
      if (this.cubeFaces(i, true)) { this.cubeMat.uniforms.uTex.value = this.W.texture; r.setRenderTarget(this.P); r.render(this.cubeScene, this.cam); }
    }
    // 6 - the fly-up blur: (z - 56) / 12 shrink-and-stretch passes, at most 3
    const nb = this.z > 56 ? Math.min(3, Math.floor((this.z - 56) / 12)) : 0;
    let src = this.P, dst = this.P2;
    for (let i = 0; i < nb; i++) { this.fs(r, dst, this.mBlur, { uT: src.texture, uPx: new THREE.Vector2(0.6 * pxX / w, 0.6 * pxY / h) }); [src, dst] = [dst, src]; }
    // 7 - the fade to black from z 72 (and full black for the first two frames), then out
    let black = 0;
    if (this.ticks < 2) black = 1;
    if (this.z > 72) black = Math.max(black, Math.min(128, (this.z - 72) * 4) / 128);
    if (this.ended) black = 1;
    this.fs(r, target, this.mOut, { uT: src.texture, uBlack: black });
  }
}
