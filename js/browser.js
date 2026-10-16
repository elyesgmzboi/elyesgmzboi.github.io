// The Browser: memory card select -> the card's saves -> a save's screen. Measured from the capture (frames 112-232):
// card select = bilinear four-corner grey gradient, two black memory cards at (546,578) and (858,578), a white spotlight
// on the selected card's label; the save grid = 4 columns (x 390/610/833/1060, rows 360/534/708) or 5 columns
// (x 344..1096 step 188, rows 310..750 step 147) once a card holds more than twelve saves, icons appearing one by one
// under "Loading...", a white glow under the selected icon; the save screen = the save's own four-corner background
// (icon.sys), the icon large on the left and the text column centred on x 974. The console's browser is silent.
import * as THREE from 'three';
import { World } from './stage.js';
import { Screen } from './screen.js';
import { tx, el, hints, mcName, SVG_CARD, SVG_UP, SVG_DOWN } from './ui.js';
import { t, L } from './i18n.js';
import { sfx, bed } from './audio.js';
import { glowTex } from './tex.js';

const P = () => window.PORTFOLIO;
const lerp = (a, b, k) => a + (b - a) * k;
// the backdrops: four corners (top-left, top-right, bottom-left, bottom-right) interpolated in display values and
// clamped, as the GS shades them. Least-squares fits to the capture (card select 113.6: 0.84 levels mean error; the
// save grid 121.0: its bottom-right corner lies below black, so that side clips)
const BG_CARDS = [[163, 163, 163], [62, 62, 51], [106, 107, 107], [20, 20, 9]];
const BG_GRID = [[138, 138, 137], [43, 41, 32], [90, 90, 89], [-2, -4, -12]];
const rgbOf = (c) => {
  if (Array.isArray(c)) return c;
  const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
};
const CARD_X = [544, 896], CARD_Y = 579;          // the two cards' centres on the capture (frame 113.6)
// a perspective camera whose z = 0 plane is the interface box at 1 px per unit; its distance comes from the cards'
// edges, which converge ~1900 px above the screen (f / tan(tilt) = 2440 with the 42.7 deg lean of a 0.71 card)
const CAM_D = 2251, CARD_TILT = -0.745, CARD_W = 154, CARD_H = 211, CARD_T = 15;
const ease = (x) => x * x * (3 - 2 * x);
// the opening card's flight (capture 114.30 on), fitted frame by frame to the capture's silhouettes (mean IoU 0.93,
// _scratch/ps2ref/flyfit2.py): it tips back past flat while turning ~65 deg clockwise and comes at the camera, its
// underside filling the screen by 0.35 s. Every 1/120 s: [x, y (down), z, pitch beyond the rest lean, in-plane spin]
const FLY = [[544.0,579.0,0,0.0,0.0],[555.3,576.6,128,-0.037,-0.035],[566.1,574.3,251,-0.076,-0.068],
  [576.3,572.1,369,-0.114,-0.101],[585.8,570.1,480,-0.154,-0.131],[594.5,568.2,585,-0.194,-0.16],
  [602.3,566.4,682,-0.235,-0.188],[609.4,564.8,773,-0.277,-0.214],[615.9,563.3,861,-0.321,-0.238],
  [621.9,561.9,943,-0.365,-0.262],[627.6,560.5,1021,-0.41,-0.284],[633.0,559.2,1093,-0.454,-0.305],
  [638.4,558.0,1160,-0.496,-0.325],[643.9,556.6,1223,-0.536,-0.342],[649.7,555.1,1285,-0.573,-0.356],
  [655.4,553.7,1343,-0.61,-0.37],[660.4,552.4,1396,-0.648,-0.384],[664.6,551.5,1442,-0.689,-0.402],
  [667.4,551.1,1479,-0.734,-0.425],[669.2,551.0,1508,-0.795,-0.474],[670.5,550.9,1531,-0.873,-0.555],
  [671.5,550.8,1551,-0.956,-0.65],[672.5,550.7,1571,-1.031,-0.741],[673.7,550.7,1592,-1.088,-0.809],
  [675.4,550.6,1618,-1.114,-0.835],[678.6,550.6,1651,-1.119,-0.829],[683.4,550.6,1692,-1.123,-0.814],
  [688.8,550.6,1736,-1.125,-0.794],[693.9,550.5,1779,-1.127,-0.774],[697.7,550.5,1815,-1.13,-0.759],
  [699.2,550.5,1840,-1.136,-0.753],[698.4,550.0,1856,-1.164,-0.769],[696.6,548.8,1869,-1.223,-0.812],
  [694.2,547.4,1879,-1.299,-0.869],[691.9,546.0,1888,-1.376,-0.931],[690.1,544.9,1900,-1.437,-0.986],
  [689.3,544.4,1916,-1.467,-1.025],[690.4,544.7,1936,-1.477,-1.05],[693.3,545.6,1962,-1.485,-1.074],
  [697.8,547.1,1992,-1.491,-1.096],[703.6,549.0,2027,-1.496,-1.114],[710.5,551.3,2064,-1.499,-1.127],
  [718.3,554.1,2104,-1.5,-1.135]];
// coming back (capture 127.117 on, fitted the same way) is not the opening reversed: the card drops in from beside
// the camera tipped further back (underside up) and turned ~67 deg, rights itself by 0.37 s, while the whole scene is still zoomed toward it and
// settles back exponentially (u = 0.5 e^(-(t - 0.1) / 0.29): both cards 1.29x at 127.50, 1.13x at 127.70, 1.05x at 127.97)
const RET = [[665.0,550.0,1610,-1.8,-1.2],[665.3,550.2,1597,-1.798,-1.196],[665.6,550.4,1585,-1.792,-1.189],
  [665.7,550.6,1575,-1.784,-1.181],[665.7,550.8,1568,-1.775,-1.172],[665.6,550.9,1563,-1.761,-1.161],
  [665.4,551.1,1559,-1.741,-1.148],[665.2,551.3,1555,-1.717,-1.132],[665.0,551.5,1549,-1.689,-1.112],
  [664.9,551.7,1538,-1.651,-1.076],[664.8,552.0,1522,-1.602,-1.027],[664.8,552.2,1508,-1.551,-0.98],
  [664.8,552.2,1500,-1.505,-0.95],[664.8,552.2,1498,-1.467,-0.937],[664.8,552.0,1496,-1.432,-0.928],
  [664.8,551.8,1494,-1.396,-0.92],[664.8,551.5,1494,-1.353,-0.909],[664.9,551.0,1503,-1.298,-0.897],
  [665.4,550.4,1521,-1.232,-0.882],[665.8,549.8,1539,-1.165,-0.864],[666.0,549.5,1546,-1.104,-0.842],
  [666.1,549.4,1544,-1.051,-0.804],[666.2,549.3,1540,-1.002,-0.752],[666.2,549.3,1534,-0.953,-0.694],
  [666.2,549.2,1527,-0.899,-0.64],[665.5,549.6,1518,-0.835,-0.591],[663.6,550.3,1504,-0.765,-0.541],
  [661.1,551.3,1486,-0.696,-0.493],[658.4,552.3,1464,-0.635,-0.448],[655.2,553.4,1425,-0.585,-0.406],
  [651.3,554.6,1367,-0.54,-0.365],[647.0,555.9,1300,-0.496,-0.326],[642.9,557.1,1235,-0.449,-0.291],
  [638.9,558.3,1165,-0.39,-0.259],[634.7,559.4,1090,-0.326,-0.228],[630.7,560.5,1021,-0.27,-0.2],
  [627.0,561.5,973,-0.237,-0.175],[623.6,562.4,945,-0.224,-0.154],[620.4,563.2,925,-0.215,-0.137],
  [617.5,563.8,906,-0.208,-0.12],[614.6,564.3,882,-0.198,-0.101],[612.2,564.5,849,-0.184,-0.078],
  [610.0,564.6,810,-0.169,-0.052],[607.6,564.8,767,-0.152,-0.03],[604.7,565.0,722,-0.135,-0.019],
  [600.4,565.7,668,-0.113,-0.013],[594.8,567.0,604,-0.086,-0.009],[588.6,568.5,537,-0.058,-0.006],
  [582.5,570.1,473,-0.032,-0.003],[577.4,571.5,419,-0.012,-0.001],[573.9,572.4,382,-0.001,-0.0],
  [572.4,572.7,364,0.0,0.0],[571.4,572.9,350,0.0,0.0],[570.6,573.1,340,0.0,0.0],[570.3,573.2,337,0.0,0.0]];
const FLY_END = 0.35, RET_LAND = 0.37, RET_END = 1.3;
const tab = (T, t) => {
  const f = Math.max(0, Math.min(T.length - 1.001, t * 120)), i = Math.floor(f), k = f - i;
  return T[i].map((x, j) => x + (T[i + 1][j] - x) * k);
};
// the other card meanwhile grows and slides away as if the camera dollied toward the opened one:
// u = 1.17 (1 - e^(-t / 0.345)) of the way (the capture's right card: 1.09x at 0.033 s, 1.42x at 0.1, 1.89x at 0.167)
const dolly = (t) => 1.17 * (1 - Math.exp(-Math.max(0, t) / 0.345));
const undolly = (t) => 0.5 * Math.exp(-(t - 0.1) / 0.29);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

const VS = 'varying vec2 vNdc; void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 0.999, 1.0); }';
const FS = `uniform vec3 c0, c1, c2, c3; uniform vec4 uMap; varying vec2 vNdc;
vec3 dec(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
void main(){
  vec2 p = vec2((vNdc.x - uMap.x) / uMap.y, (vNdc.y - uMap.z) / uMap.w) / vec2(1440.0, 1080.0);   // 0..1 over the 4:3 box
  vec3 top = mix(c0, c1, p.x), bot = mix(c2, c3, p.x);
  gl_FragColor = vec4(dec(clamp(mix(top, bot, p.y), 0.0, 1.0)), 1.0);
}`;

function gridLayout(n) {
  if (n <= 12) return { cols: 4, xs: [390, 610, 833, 1060], y0: 360, dy: 174, rows: 3, scale: 1 };
  return { cols: 5, xs: [344, 532, 720, 908, 1096], y0: 310, dy: 147, rows: 4, scale: 0.85 };
}

// ---------------------------------------------------------------- 3D models
function lambert(c, e = 0) { return new THREE.MeshLambertMaterial({ color: c, emissive: new THREE.Color(c).multiplyScalar(e), transparent: true }); }

// the memory card as the browser shows it (capture 113.6, the unselected card unwarped): black plastic with a small
// arched notch at the top centre, a recessed label pocket from 43 % to 79 % of the height whose lower and right inner
// walls catch the light, and a thick rounded lower lip lit at its left corner. The face is painted with that baked
// lighting (the console's own look at rest); the body is a rounded slab whose underside is the dark slate seen when
// a card flies past the camera.
function cardFaceTex(relief) {
  const W = 300, H = 422, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // relief: how strongly each part of the face takes the selection light (0.5 = 1x), with the same layout
  const C = relief ? { base: '#808080', notch: '#5a5a5a', notchEdge: 'rgba(200,200,200,', top: 'rgba(0,0,0,.55)', pocket: '#787878', edge: 'rgba(190,190,190,', lip: '#808080', corner: 'rgba(170,170,170,', bottom: 'rgba(150,150,150,.8)' }
    : { base: '#050504', notch: '#0e0e0d', notchEdge: 'rgba(34,34,31,', top: 'rgba(0,0,0,.8)', pocket: '#090906', edge: 'rgba(27,27,24,', lip: '#0d0d0b', corner: 'rgba(26,26,22,', bottom: 'rgba(14,14,16,1)' };
  // (unlit: the capture's right card at rest, 113.6 - upper face 4.5, pocket 9, lip 12.6, its lit left rim 25, the
  // notch's raised tab 18, the pocket's lit bottom 17 and right wall 26, all a little warm)
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  rr(0, 0, W, H, 14); g.save(); g.clip();
  g.fillStyle = C.base; g.fillRect(0, 0, W, H);
  // the notch: a raised trapezoid tab at the top centre, its lower edge lit
  g.fillStyle = C.notch; g.beginPath(); g.moveTo(W * 0.35, H * 0.09); g.lineTo(W * 0.40, H * 0.035); g.lineTo(W * 0.62, H * 0.035); g.lineTo(W * 0.67, H * 0.09); g.closePath(); g.fill();
  let gr = g.createLinearGradient(W * 0.35, 0, W * 0.67, 0); gr.addColorStop(0, C.notchEdge + '0)'); gr.addColorStop(0.2, C.notchEdge + '1)'); gr.addColorStop(0.8, C.notchEdge + '1)'); gr.addColorStop(1, C.notchEdge + '0)');
  g.strokeStyle = gr; g.lineWidth = 3; g.beginPath(); g.moveTo(W * 0.36, H * 0.088); g.lineTo(W * 0.66, H * 0.088); g.stroke();
  // the face's rounded left border catches the light
  gr = g.createLinearGradient(0, 0, W * 0.045, 0); gr.addColorStop(0, C.corner + '0)'); gr.addColorStop(0.35, C.corner + '1)'); gr.addColorStop(1, C.corner + '0)');
  g.fillStyle = gr; g.fillRect(0, H * 0.04, W * 0.045, H * 0.93);
  // the label pocket: shadowed under its top wall, lit along its bottom and right walls
  const px = W * 0.045, py = H * 0.455, pw = W * 0.94, ph = H * 0.315;
  g.fillStyle = C.pocket; g.fillRect(px, py, pw, ph);
  gr = g.createLinearGradient(0, py - H * 0.035, 0, py + H * 0.02); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.6, C.top); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(px, py - H * 0.035, pw, H * 0.055);
  gr = g.createLinearGradient(px, 0, px + pw, 0); gr.addColorStop(0, C.edge + '.3)'); gr.addColorStop(0.25, C.edge + '.85)'); gr.addColorStop(1, C.edge + '1)');
  g.fillStyle = gr; g.fillRect(px + 6, py + ph - 5, pw - 6, 6);
  gr = g.createLinearGradient(0, py + ph * 0.25, 0, py + ph); gr.addColorStop(0, C.edge + '0)'); gr.addColorStop(1, C.edge + '1)');
  g.fillStyle = gr; g.fillRect(px + pw - 7, py + ph * 0.25, 7, ph * 0.75);
  // the lower lip: its own level, a lit corner on the left and a lit bottom edge
  g.fillStyle = C.lip; g.fillRect(0, py + ph + 1, W, H - py - ph - 1);
  gr = g.createLinearGradient(0, 0, W * 0.045, 0); gr.addColorStop(0, C.corner + '0)'); gr.addColorStop(0.35, C.corner + '1)'); gr.addColorStop(1, C.corner + '0)');
  g.fillStyle = gr; g.fillRect(0, py + ph + 1, W * 0.045, H - py - ph - 8);
  g.fillStyle = C.bottom; g.fillRect(W * 0.03, H * 0.982, W * 0.94, H * 0.018);
  g.restore();
  const t2 = new THREE.CanvasTexture(c); t2.colorSpace = relief ? THREE.NoColorSpace : THREE.SRGBColorSpace; t2.anisotropy = 4; return t2;
}
// the face takes the selection light as the console draws it: a Gaussian hotspot (sigma 28.5 px on screen, peak
// ~1.1 in linear light, centred on the capture's peak, 551, 572 for the left card) shaped by the face's relief, so the
// pocket's edges still read through it (capture 113.6)
const FACE_V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FACE_F = `uniform sampler2D uTex, uRel; uniform vec4 uGlow; uniform float uA; varying vec2 vUv;
void main(){
  vec4 t = texture2D(uTex, vUv); if (t.a < 0.5) discard;
  vec2 d = (vUv - uGlow.xy) / vec2(0.19, 0.184) / max(uGlow.w, 0.01);
  float g = uGlow.z * exp(-0.5 * dot(d, d)) * texture2D(uRel, vUv).r * 2.0;
  gl_FragColor = vec4(t.rgb + g, uA);
}`;
let FACE = null;
function memoryCard() {
  const g = new THREE.Group();
  const W = CARD_W, H = CARD_H, r = 7, sh = new THREE.Shape();
  sh.moveTo(-W / 2 + r, -H / 2); sh.lineTo(W / 2 - r, -H / 2); sh.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + r);
  sh.lineTo(W / 2, H / 2 - r); sh.quadraticCurveTo(W / 2, H / 2, W / 2 - r, H / 2); sh.lineTo(-W / 2 + r, H / 2);
  sh.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - r); sh.lineTo(-W / 2, -H / 2 + r); sh.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + r, -H / 2);
  const body = new THREE.ExtrudeGeometry(sh, { depth: CARD_T - 3, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 2, curveSegments: 4 });
  body.translate(0, 0, -(CARD_T - 3) / 2);
  const cap = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(26 / 255, 29 / 255, 35 / 255, THREE.SRGBColorSpace), transparent: true });
  const side = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(14 / 255, 14 / 255, 16 / 255, THREE.SRGBColorSpace), transparent: true });
  g.add(new THREE.Mesh(body, [cap, side]));
  FACE = FACE || [cardFaceTex(false), cardFaceTex(true)];
  const fm = new THREE.ShaderMaterial({ vertexShader: FACE_V, fragmentShader: FACE_F, transparent: true,
    uniforms: { uTex: { value: FACE[0] }, uRel: { value: FACE[1] }, uGlow: { value: new THREE.Vector4(0.573, 0.429, 0, 1) }, uA: { value: 1 } } });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), fm);
  face.position.z = CARD_T / 2 + 0.3; g.add(face); g.userData.face = fm;
  g.rotation.x = CARD_TILT;
  return g;
}

// the selection light's glow round the card: the card's outline, blurred (it sits behind the card)
function rimTex() {
  const c = document.createElement('canvas'); c.width = 270; c.height = 276; const g = c.getContext('2d');
  g.filter = 'blur(20px)'; g.fillStyle = '#fff';
  g.beginPath(); g.roundRect(60, 60, 150, 156, 10); g.fill();
  const t2 = new THREE.CanvasTexture(c); t2.colorSpace = THREE.SRGBColorSpace; return t2;
}
// the selection light's core on the card face (Gaussian)
function gaussTex(sigma) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const d = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const r = Math.hypot(x - 63.5, y - 63.5) / 64, v = Math.exp(-0.5 * (r / sigma) ** 2) * Math.max(0, Math.min(1, (1 - r) * 6));
    const i = (y * 128 + x) * 4; d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; d.data[i + 3] = Math.round(v * 255);
  }
  g.putImageData(d, 0, 0); const t2 = new THREE.CanvasTexture(c); t2.colorSpace = THREE.SRGBColorSpace; return t2;
}

function labelTex(text, color) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#fff'; x.font = 'bold 56px OSD, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text || '', 64, 68);
  const t2 = new THREE.CanvasTexture(c); t2.colorSpace = THREE.SRGBColorSpace; return t2;
}

// a save's icon: a small lit model chosen by content.js icon.model, idling the way PS2 icons do (a slow turn)
function saveIcon(icon) {
  const col = new THREE.Color(icon.color || '#4a7cff');
  const m = lambert(col, 0.15), dark = lambert(0x1a1a22), g = new THREE.Group();
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o; };
  switch (icon.model) {
    case 'monitor': {
      add(new THREE.BoxGeometry(74, 56, 44), dark);
      const scr = add(new THREE.PlaneGeometry(62, 44), new THREE.MeshBasicMaterial({ map: labelTex(icon.label, icon.color || '#3b6cff'), transparent: true }), 0, 0, 22.2);
      scr.renderOrder = 1;
      add(new THREE.BoxGeometry(30, 10, 30), dark, 0, -34, 0);
      break;
    }
    case 'globe': add(new THREE.SphereGeometry(36, 24, 16), m); add(new THREE.TorusGeometry(44, 2.2, 8, 48), dark).rotation.x = 1.2; break;
    case 'controller': {
      add(new THREE.BoxGeometry(84, 34, 26), m);
      add(new THREE.CylinderGeometry(15, 15, 26, 20), m, -40, -14, 0).rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(15, 15, 26, 20), m, 40, -14, 0).rotation.x = Math.PI / 2;
      for (const [x, y] of [[26, 6], [34, -2], [18, -2], [26, -10]]) add(new THREE.SphereGeometry(3.6, 10, 8), dark, x, y, 14);
      break;
    }
    case 'disc': add(new THREE.CylinderGeometry(42, 42, 4, 40), m).rotation.x = Math.PI / 2; add(new THREE.CylinderGeometry(8, 8, 5, 20), dark).rotation.x = Math.PI / 2; break;
    case 'floppy': add(new THREE.BoxGeometry(70, 70, 8), m); add(new THREE.BoxGeometry(36, 22, 9), dark, 0, 24, 0); add(new THREE.BoxGeometry(50, 30, 9), lambert(0xdddddd), 0, -14, 0); break;
    case 'gem': add(new THREE.OctahedronGeometry(44), m); break;
    case 'book': add(new THREE.BoxGeometry(60, 76, 18), m); add(new THREE.BoxGeometry(54, 70, 19), lambert(0xeeeeee), 4, 0, 0); break;
    case 'rocket': add(new THREE.CylinderGeometry(12, 16, 60, 20), m); add(new THREE.ConeGeometry(12, 24, 20), lambert(0xeeeeee), 0, 42, 0); break;
    case 'terminal': add(new THREE.BoxGeometry(80, 60, 14), dark); add(new THREE.PlaneGeometry(70, 50), new THREE.MeshBasicMaterial({ map: labelTex('>_', '#0c2a12') }), 0, 0, 7.2); break;
    case 'star': add(new THREE.OctahedronGeometry(30), m).scale.set(1.5, 1.5, 0.5); break;
    case 'gear': add(new THREE.TorusGeometry(30, 10, 8, 12), m); break;
    case 'heart': add(new THREE.SphereGeometry(22, 16, 12), m, -14, 8, 0); add(new THREE.SphereGeometry(22, 16, 12), m, 14, 8, 0); add(new THREE.ConeGeometry(31, 40, 20), m, 0, -20, 0).rotation.z = Math.PI; break;
    default: add(new THREE.BoxGeometry(56, 56, 56), m);
  }
  g.userData.spin = Math.random() * Math.PI * 2;
  return g;
}

function setOpacity(o, a) {
  o.traverse((n) => { if (n.material) { const ms = Array.isArray(n.material) ? n.material : [n.material]; for (const m of ms) { m.opacity = a; if (m.uniforms && m.uniforms.uA) m.uniforms.uA.value = a; } n.visible = a > 0.01; } });
}

// ---------------------------------------------------------------- world
export class BrowserWorld extends World {
  constructor(stage, app) {
    super(stage);
    this.app = app;
    // interface px, y down (x, -y in world units) on the z = 0 plane
    this.fov = 2 * Math.atan(540 / CAM_D) * 180 / Math.PI;
    this.camera = new THREE.PerspectiveCamera(this.fov, 4 / 3, 20, 8000);
    this.camera.position.set(720, -540, CAM_D); this.camera.lookAt(720, -540, 0);
    this.uni = { c0: { value: new THREE.Vector3() }, c1: { value: new THREE.Vector3() }, c2: { value: new THREE.Vector3() }, c3: { value: new THREE.Vector3() }, uMap: { value: new THREE.Vector4(-1, 1 / 720, 1, -1 / 540) } };
    const v3 = (c) => new THREE.Vector3(...rgbOf(c)).multiplyScalar(1 / 255);
    this.v3 = v3;
    this.bgCur = BG_CARDS.map(v3); this.bgTgt = BG_CARDS.map(v3);
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: this.uni, depthTest: false, depthWrite: false }));
    bg.frustumCulled = false; bg.renderOrder = -10; this.scene.add(bg);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(-0.4, 0.8, 1); this.scene.add(d);
    // the two memory cards
    this.cards = CARD_X.map((x) => { const c = memoryCard(); c.position.set(x, -CARD_Y, 0); this.scene.add(c); return c; });
    this.cardSel = 0; this.cardsA = 1; this.cardsTgt = 1;
    // the card transition: 0 = at rest, 1 = flown past the camera; flyDir +1 opening a card, -1 coming back
    this.fly = 0; this.flyCard = 0; this.flyDir = 0; this.flyT = 0;
    // the selection light on a card (core + halo) and the glow under the selected save icon
    const add = (m, o) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: m, color: 0xffffff, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true })); sp.renderOrder = o; this.scene.add(sp); return sp; };
    this.core = add(gaussTex(0.19), 6); this.halo = add(rimTex(), -6);
    this.coreGrow = 1;
    this.glow = add(glowTex(), -5);
    this.leaveOrb = add(glowTex(), -7); this.leaveOrb.material.color.setRGB(0.55, 0.75, 1.0); this.leaveT = -1;
    this.coreRate = 0.45;
    this.glowPos = { x: CARD_X[0], y: CARD_Y + 30, s: 230 }; this.glowA = 0;
    this.icons = []; this.gridA = 0; this.gridTgt = 0;
    this.detail = -1; this.detailK = 0; this.detailBig = true;
    this.iconsOut = 0;                 // 1 while the save icons shrink away (leaving the card)
  }
  // open card i (it tips flat, turns and rises past the camera: capture 114.33-114.65) / bring it back (127.15-127.50)
  flyOut(i) { this.flyCard = i; this.flyDir = 1; this.flyT = 0; this.fly = 0.001; }
  flyIn(i) { this.flyCard = i; this.flyDir = -1; this.flyT = 0; this.fly = 1; this.coreGrow = 0; }
  // place both cards ft seconds into a flight (dir +1 opening, -1 coming back, 0 at rest or gone)
  poseAt(dir, ft) {
    const sel = this.flyCard; let p, u, vis = 1;
    if (dir > 0 || (dir === 0 && this.fly >= 1)) {
      const T = dir > 0 ? Math.min(FLY_END, ft) : FLY_END;
      p = tab(FLY, T); u = dolly(T); vis = T < FLY_END - 1e-6 ? 1 : 0;
    } else if (dir < 0) {
      // the card shows from the return's second field on (127.15 has it at half strength)
      u = undolly(ft); vis = ft >= 0.025 ? 1 : 0;
      p = ft < 0.45 ? tab(RET, ft) : [544 + 176 * u, 579 - 39 * u, CAM_D * u, 0, 0];
    } else { p = [544, 579, 0, 0, 0]; u = 0; }
    this.cards.forEach((c, i) => {
      if (i === sel) {
        // the paths were fitted on the left card; the right card's are their mirror image about the screen's centre
        const m = CARD_X[i] > 720 ? -1 : 1;
        c.position.set(720 + m * (p[0] - 720), -p[1], p[2]); c.rotation.set(CARD_TILT + p[3], 0, m * p[4]);
      } else {
        c.position.set(CARD_X[i] - u * (CARD_X[sel] - 720), -(CARD_Y - u * (CARD_Y - 540)), u * CAM_D);
        c.rotation.set(CARD_TILT, 0, 0);
      }
      setOpacity(c, this.cardsA * vis);
    });
  }
  setBg(list) { list.forEach((c, i) => this.bgTgt[i].copy(this.v3(c))); }
  setIcons(saves) {
    for (const o of this.icons) this.scene.remove(o.g);
    this.icons = saves.map((s) => { const g = saveIcon(s.icon || {}); this.scene.add(g); setOpacity(g, 0); return { g, a: 0, shown: false }; });
    this.layout = gridLayout(saves.length); this.top = 0;
  }
  iconXY(i) {
    const Lr = this.layout, row = Math.floor(i / Lr.cols) - this.top;
    return { x: Lr.xs[i % Lr.cols], y: Lr.y0 + row * Lr.dy, vis: row >= 0 && row < Lr.rows };
  }
  update(dt, time) {
    this.stage.fitCamera(this.camera, this.fov);
    const k = 1 - Math.exp(-dt * 9);
    this.bgCur.forEach((c, i) => { c.lerp(this.bgTgt[i], k); this.uni['c' + i].value.copy(c); });
    const st = this.stage, fr = st.frame, bx = st.box;
    this.uni.uMap.value.set((bx.x - fr.x) / fr.w * 2 - 1, bx.s / fr.w * 2, 1 - (bx.y - fr.y) / fr.h * 2, -bx.s / fr.h * 2);
    // the card transition, keyed on time
    // fly: 0 = at rest (the light may show), 1 = flown past the camera
    if (this.flyDir) {
      this.flyT += dt;
      this.fly = this.flyDir > 0 ? Math.min(FLY_END, this.flyT) / FLY_END : clamp01(1 - this.flyT / RET_LAND);
      if (this.flyT >= (this.flyDir > 0 ? FLY_END : RET_END)) { this.fly = this.flyDir > 0 ? 1 : 0; this.flyDir = 0; }
    }
    this.cardsA = lerp(this.cardsA, this.cardsTgt, k);
    this.poseAt(this.flyDir, this.flyT);
    // the selection light: off as soon as the card moves; grows back from a point after it lands (127.30-127.70)
    if (this.fly <= 0 && this.coreGrow < 1 && this.leaveT < 0) this.coreGrow = Math.min(1, this.coreGrow + dt / this.coreRate);
    // leaving the Browser (capture 258.55-259.75): the card's light goes out and a blue ball slides from its right
    // edge, behind the other card and off to the right over ~1.1 s
    if (this.leaveT >= 0) {
      // x = card + 46 + 401 t^1.76 (capture: 625 / 684 / 778 / ~1000 px at 0.25 / 0.45 / 0.65 / 1.05 s)
      this.leaveT += dt; const c0 = CARD_X[this.cardSel], tt = this.leaveT;
      this.leaveOrb.position.set(c0 + 46 + 401 * Math.pow(tt, 1.76), -(CARD_Y - 4), -60);
      this.leaveOrb.scale.set(115, 115, 1);
      this.leaveOrb.material.opacity = 0.9 * clamp01(tt / 0.12) * (1 - clamp01((tt - 0.9) / 0.5));
    } else this.leaveOrb.material.opacity = 0;
    const sc = this.cards[this.cardSel], cg = ease(this.coreGrow), on = this.cardsA * (this.fly > 0 ? 0 : 1) * (this.cardsTgt > 0.5 ? 1 : 0) * (this.leaveT >= 0 ? 0 : 1);
    // opening: the light stays on the tipping face, shrinking to a point by 0.11 s and gone at 0.125 (114.30-114.43)
    const T = this.fly * FLY_END, opening = this.flyDir > 0 && T < 0.125, lk = clamp01(1 - T / 0.11);
    this.cards.forEach((c, i) => {
      const u = c.userData.face.uniforms.uGlow.value;
      if (opening) { u.z = i === this.cardSel ? 1.1 : 0; u.w = 0.12 + 0.88 * lk; return; }
      u.z = i === this.cardSel ? on * 1.1 * Math.min(1, 0.35 + cg) : 0; u.w = 0.12 + 0.88 * cg;
    });
    // coming back: a point of light rides the card's centre from 0.1 s until it lands (127.22-127.48)
    const dot = this.flyDir < 0 && this.flyT > 0.1 && this.fly > 0;
    this.core.position.set(sc.position.x, sc.position.y, sc.position.z + 20); this.core.scale.set(9, 9, 1);
    this.core.material.opacity = dot ? 1 : 0;
    this.halo.position.set(sc.position.x, sc.position.y + 2, -30); this.halo.scale.set(CARD_W + 120, CARD_H * 0.74 + 120, 1);
    this.halo.material.opacity = on * 0.42 * cg;
    // icons
    this.gridA = lerp(this.gridA, this.gridTgt, k);
    this.icons.forEach((o, i) => {
      // each icon grows in from its centre when it has loaded (capture 114.78-114.98) and shrinks away on Back
      o.a = Math.max(0, Math.min(1, o.a + (o.shown && !this.iconsOut ? dt / 0.2 : -dt / 0.12)));
      o.g.userData.spin += dt * 0.9;
      const p = this.iconXY(i); let x = p.x, y = p.y, s = this.layout.scale * 2.0 * Math.max(0.001, ease(o.a));
      let a = (o.a > 0 ? 1 : 0) * this.gridA * (p.vis ? 1 : 0);
      if (this.detail >= 0) {
        // the save screens keep the grid behind them, dimmed; the save's own icon comes forward on the left
        if (i === this.detail && this.detailBig) { x = lerp(x, 400, this.detailK); y = lerp(y, 620, this.detailK); s = lerp(s, 3.6, this.detailK); }
        else a *= 1 - 0.88 * this.detailK;    // the capture's ghost grid: dark silhouettes
      }
      o.g.position.set(x, -y, 0); o.g.scale.setScalar(s);
      o.g.rotation.set(-0.25, o.g.userData.spin, 0);
      setOpacity(o.g, a);
    });
    this.detailK = lerp(this.detailK, this.detail >= 0 ? 1 : 0, k);
    // the glow
    const gp = this.glowTarget ? this.glowTarget() : null;
    if (gp) { for (const key of ['x', 'y', 's']) this.glowPos[key] = lerp(this.glowPos[key], gp[key], 1 - Math.exp(-dt * 16)); }
    this.glowA = lerp(this.glowA, gp ? gp.a : 0, k);
    this.glow.position.set(this.glowPos.x, -this.glowPos.y, 40);
    let gs = this.glowPos.s;
    if (this.iconsOut) { const ic = this.icons[this.glowSel | 0]; gs *= ic ? ease(ic.a) : 0; }
    this.glow.scale.set(gs, gs, 1);
    this.glow.material.opacity = this.glowA * (0.92 + 0.08 * Math.sin(time * 3));
  }
  render(r, target) {
    if (!this.flyDir) { r.setRenderTarget(target); r.setClearColor(0x000000, 1); r.clear(); r.render(this.scene, this.camera); return; }
    // while a card flies, show the field before as well (the capture's frames are two fields averaged: the card
    // reads solid where both agree and half-strength where it moved)
    const w = target.width, h = target.height;
    if (!this.fieldRT || this.fieldRT[0].width !== w || this.fieldRT[0].height !== h) {
      if (this.fieldRT) this.fieldRT.forEach((t) => t.dispose());
      const o = { depthBuffer: true, type: THREE.HalfFloatType, samples: 4 };
      this.fieldRT = [new THREE.WebGLRenderTarget(w, h, o), new THREE.WebGLRenderTarget(w, h, o)];
      this.fieldMat = this.fieldMat || new THREE.ShaderMaterial({ uniforms: { a: { value: null }, b: { value: null } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: 'uniform sampler2D a, b; varying vec2 vUv; void main(){ gl_FragColor = vec4(0.5 * (texture2D(a, vUv).rgb + texture2D(b, vUv).rgb), 1.0); }',
        depthTest: false, depthWrite: false });
      if (!this.fieldScene) { this.fieldScene = new THREE.Scene(); const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.fieldMat); q.frustumCulled = false; this.fieldScene.add(q); this.fieldCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); }
    }
    const draw = (t) => { r.setRenderTarget(t); r.setClearColor(0x000000, 1); r.clear(); r.render(this.scene, this.camera); };
    draw(this.fieldRT[0]);
    this.poseAt(this.flyDir, this.flyT - 1 / 60);
    draw(this.fieldRT[1]);
    this.poseAt(this.flyDir, this.flyT);
    this.fieldMat.uniforms.a.value = this.fieldRT[0].texture; this.fieldMat.uniforms.b.value = this.fieldRT[1].texture;
    r.setRenderTarget(target); r.clear(); r.render(this.fieldScene, this.fieldCam);
  }
}

// ---------------------------------------------------------------- card select
export class BrowserScreen extends Screen {
  build() {
    const r = this.root; r.innerHTML = '';
    el('div', 'ps2logo', 'PS2', r);
    this.title = tx(r, { x: 1386, y: 119, a: 'r', size: 'M', cls: 'yl br-title', html: mcName(1) });
    this.hit0 = this.cardHits = CARD_X.map((x, i) => { const h = el('div', 'hit', null, r); Object.assign(h.style, { position: 'absolute', left: (x - 80) + 'px', top: (CARD_Y - 90) + 'px', width: '160px', height: '180px', cursor: 'pointer' }); h.dataset.hit = i; return h; });
    this.hints = hints(r, [['x', 'enter'], ['o', 'back']], (b) => this.key(b));
    this.sel = this.sel || 0;
  }
  get W() { return this.app.worlds.browser; }
  paint(moved) {
    this.title.innerHTML = mcName(this.sel + 1);
    const W = this.W; W.cardSel = this.sel; W.glowTarget = null;
    // the light moves to the other card at the strength it had (capture 128.05: 66 -> 69) and keeps growing there
  }
  enter(from, arg) {
    const app = this.app, W = this.W;
    bed(null, 0, 1.5);                // the Browser is silent: the menu's bed fades out with the orbs
    W.cardsTgt = 1; W.gridTgt = 0; W.detail = -1; W.setBg(BG_CARDS);
    this.paint();
    if (from && from.id === 'card') {
      // back from a card (capture 126.69 press): the icons have shrunk away; the title returns at +0.41 s, the card
      // flies back in from the camera at +0.46 s (0.35 s), the "PS2" mark and the hints follow, and the light grows
      // from a point once the card has landed
      // the light then grows from a point slowly (capture 127.48-128.0: about half strength after 0.5 s)
      W.cardsA = 1; W.fly = 1; W.flyCard = this.sel; W.coreGrow = 0; W.coreRate = 1.1; W.leaveT = -1;
      this.root.classList.add('br-back');
      app.after(20, () => this.root.classList.add('br-back-run'));
      W.flyIn(this.sel);
      app.after(900, () => this.root.classList.remove('br-back', 'br-back-run'));
      app.setWorld('browser', 0);
      return;
    }
    W.fly = 0;
    if (from && from.id === 'main' && !arg.instant) {
      // from the main menu (capture 109.4-113.2): the menu text is cut, the orbs fade out over ~1.75 s, the screen
      // holds black for ~0.65 s, then the browser - backdrop, cards and text together - fades up over ~1.3 s
      app.orbs.set({ alpha: 0 }, 1.6);
      this.root.classList.add('slow-in'); this.show(false);
      W.leaveT = -1; W.coreGrow = 0; W.coreRate = 99;
      app.after(2450, () => { app.setWorld('browser', 1.3); this.show(true); });
      app.after(2580, () => { W.coreRate = 0.8; });
      app.after(3800, () => this.root.classList.remove('slow-in'));
      return 'hold';
    }
    W.leaveT = -1; W.coreRate = 0.45;
    app.setWorld('browser', 0.7);
    app.orbs.set({ alpha: 0 }, 6);
  }
  key(b) {
    const app = this.app, W = this.W;
    if (b === 'left' || b === 'right') {
      const n = b === 'left' ? 0 : 1;
      if (n !== this.sel) { this.sel = n; this.paint(true); sfx('cursor'); }
    } else if (b === 'x') {
      if (!P().cards[this.sel]) { sfx('denied'); return; }
      sfx('card'); app.lock(800);
      // the chosen card tips flat, turns and rises past the camera while the other slides away (114.35-114.70);
      // the text goes in ~0.15 s and the card's saves start at +0.42 s
      W.flyOut(this.sel);
      this.root.classList.add('quick'); this.show(false);
      app.after(450, () => { this.root.classList.remove('quick'); app.go('card', { card: this.sel }); });
    } else if (b === 'o') {
      sfx('back'); app.lock(2400);
      app.after(450, () => { W.leaveT = 0; });
      app.after(800, () => { this.root.classList.add('slow-out'); this.show(false); app.setWorld('menu', 0.7); });
      app.after(2300, () => { this.root.classList.remove('slow-out'); W.leaveT = -1; app.go('main', { fromBrowser: true }); });
    }
  }
  hit(v, kind) {
    const n = +v;
    if (kind === 'hover') { if (n !== this.sel) { this.sel = n; this.paint(true); sfx('cursor'); } }
    else { this.sel = n; this.paint(); this.key('x'); }
  }
}

// ---------------------------------------------------------------- a card's saves
export class CardScreen extends Screen {
  build() { this.root.innerHTML = ''; this.sel = 0; this.card = 0; }
  get W() { return this.app.worlds.browser; }
  get saves() { return P().cards[this.card].saves; }
  paintHeader() {
    const r = this.root; r.innerHTML = '';
    r.insertAdjacentHTML('beforeend', SVG_CARD); this.icon = r.lastElementChild;
    this.mc = [tx(r, { x: 176, y: 118, size: 'M', html: mcName(this.card + 1) }),
      tx(r, { x: 176, y: 166, size: 'S', html: t('kbfree', { n: (P().cards[this.card].free || 0).toLocaleString('en-US') }) })];
    this.title = tx(r, { x: 1386, y: 119, a: 'r', size: 'M', cls: 'yl', lh: 56, html: '' });
    this.loading = tx(r, { x: 720, y: 560, a: 'c', size: 'M', html: t('loading') });
    r.insertAdjacentHTML('beforeend', SVG_UP); this.up = r.lastElementChild; Object.assign(this.up.style, { top: '188px', opacity: 0 });
    r.insertAdjacentHTML('beforeend', SVG_DOWN); this.down = r.lastElementChild; Object.assign(this.down.style, { top: '841px', opacity: 0 });
    this.hitEls = this.saves.map((s, i) => { const h = el('div', 'hit', null, r); h.dataset.hit = i; Object.assign(h.style, { position: 'absolute', width: '150px', height: '150px', cursor: 'pointer' }); return h; });
    this.hints = hints(r, [['x', 'enter'], ['o', 'back'], ['t', 'options']], (b) => this.key(b));
    this.hintsBack = hints(r, [['o', 'back']], (b) => this.key(b));
  }
  // while the saves load only Back is offered; the full row comes when the last icon is in
  loadingHints(on) { this.hints.style.opacity = on ? 0 : 1; this.hintsBack.style.opacity = on ? 1 : 0; }
  paint() {
    const W = this.W, s = this.saves[this.sel];
    this.title.innerHTML = L(s.title).replace(/\n/g, '<br>');
    const Lr = W.layout, row = Math.floor(this.sel / Lr.cols);
    if (row < W.top) W.top = row; if (row >= W.top + Lr.rows) W.top = row - Lr.rows + 1;
    const total = Math.ceil(this.saves.length / Lr.cols);
    this.up.style.opacity = W.top > 0 ? 1 : 0; this.down.style.opacity = W.top + Lr.rows < total ? 1 : 0;
    this.hitEls.forEach((h, i) => { const p = W.iconXY(i); h.style.left = (p.x - 75) + 'px'; h.style.top = (p.y - 85) + 'px'; h.style.display = p.vis ? '' : 'none'; });
    // the glow sits under the icon: the capture's bright core is ~40 px below the icon's centre
    W.glowTarget = () => { const p = W.iconXY(this.sel); const ic = W.icons[this.sel]; return { x: p.x + 12, y: p.y + 38, s: 230 * Lr.scale, a: this.glowHold ? 0 : (W.detail >= 0 ? 0.25 : 1) * (ic && ic.shown && !W.iconsOut ? ease(ic.a) : 0) }; };
  }
  enter(from, arg) {
    const app = this.app, W = this.W;
    app.setWorld('browser', 0);
    W.cardsTgt = 0; W.cardsA = 0; W.gridTgt = 1; W.gridA = 1; W.detail = -1; W.iconsOut = 0;
    W.setBg(BG_GRID);
    if (arg.card != null && (arg.card !== this.card || from.id === 'browser')) {
      this.card = arg.card; this.sel = 0;
      W.setIcons(this.saves); this.paintHeader(); this.paint();
      // as the card has flown past (114.75): the header's card icon and the first save grow from points and the
      // title fades in; the card's name follows at +0.3 s, "Loading..." at +0.4 s with only Back offered, the light
      // under the first save at +0.5 s, then the other saves one at a time (~0.22 s apart) until the full hints
      W.glowA = 0; this.root.classList.add('quick', 'br-load');
      this.icon.classList.add('grow-in'); this.mc.forEach((e) => e.classList.add('later'));
      this.loading.style.opacity = 0; this.loadingHints(true); this.glowHold = true;
      app.after(200, () => this.root.classList.remove('quick'));
      app.after(400, () => { this.loading.style.opacity = 1; });
      app.after(500, () => { this.glowHold = false; });
      const n = this.saves.length;
      this.saves.forEach((s, i) => app.after(i === 0 ? 0 : 300 + (i - 1) * 220, () => { W.icons[i].shown = true; }));
      const done = n > 1 ? 300 + (n - 2) * 220 + 200 : 400;
      app.after(done, () => { this.loading.style.opacity = 0; this.loadingHints(false); this.root.classList.remove('br-load'); });
    } else this.paint();
  }
  move(d) {
    const Lr = this.W.layout, n = this.saves.length; let s = this.sel;
    if (d === 'left') s = s % Lr.cols ? s - 1 : s; else if (d === 'right') s = s % Lr.cols < Lr.cols - 1 && s + 1 < n ? s + 1 : s;
    else if (d === 'up') s = s - Lr.cols >= 0 ? s - Lr.cols : s; else if (d === 'down') s = Math.min(n - 1, s + Lr.cols) !== s && s + Lr.cols < n ? s + Lr.cols : s;
    if (s !== this.sel) { this.sel = s; this.paint(); sfx('cursor'); }
  }
  key(b) {
    const app = this.app;
    if (['left', 'right', 'up', 'down'].includes(b)) this.move(b);
    else if (b === 'x' || b === 't') {
      if (!this.W.icons[this.sel] || !this.W.icons[this.sel].shown) return;
      sfx('enter'); app.lock(500); app.go('detail', { card: this.card, save: this.sel });
    } else if (b === 'o') {
      // back to the cards (126.69): the icons shrink to their centres and the header fades (0.2 s), then the empty
      // backdrop holds until the card comes back
      sfx('back'); app.lock(1000);
      this.W.iconsOut = 1; this.W.glowSel = this.sel; this.root.classList.add('quick'); this.show(false);
      app.after(430, () => { this.root.classList.remove('quick'); app.go('browser'); });
    }
  }
  hit(v, kind) {
    const n = +v;
    if (kind === 'hover') { if (n !== this.sel) { this.sel = n; this.paint(); sfx('cursor'); } }
    else { this.sel = n; this.paint(); this.key('x'); }
  }
}

// ---------------------------------------------------------------- a save's screen
export class DetailScreen extends Screen {
  get W() { return this.app.worlds.browser; }
  enter(from, arg) {
    const W = this.W;
    if (arg.card != null) { this.card = arg.card; this.idx = arg.save; this.sel = 0; }
    const s = this.save = P().cards[this.card].saves[this.idx];
    W.detail = this.idx; W.detailBig = true; W.setBg(s.bg || BG_GRID);
    const r = this.root; r.innerHTML = '';
    // capture: card name cap-top 204, title 279 (two lines 272 / 341), date 381 (420), size 430 (468), options 591
    const X = 970;
    tx(r, { x: X, y: 238, a: 'c', size: 'M', html: mcName(this.card + 1) });
    const lines = L(s.title).split('\n'), n = lines.length;
    lines.forEach((ln, i) => tx(r, { x: X, y: 325 - 7 * (n - 1) + 69 * i, a: 'c', size: 'L', cls: 'yl', html: ln }));
    const dy = 39 * (n - 1);
    tx(r, { x: X, y: 407 + dy, a: 'c', size: 'S', html: (s.date || '').replace(/\//g, '<i class="sl">/</i>') });
    tx(r, { x: X, y: 456 + dy, a: 'c', size: 'S', html: `${(s.size || 0).toLocaleString('en-US')} KB` });
    this.opts = [['open', s.url], ['source', s.source], ['info', true]].map(([k, ok], i) => {
      const e = tx(r, { x: X, y: 637 + i * 104, a: 'c', size: 'L', html: k === 'info' ? 'Info' : t(k) });
      e.dataset.hit = i; e.dataset.ok = ok ? 1 : 0; e.style.cursor = 'pointer'; return e;
    });
    this.hints = hints(r, [['x', 'enter'], ['o', 'back']], (b) => this.key(b));
    if (arg.card != null) this.sel = Math.max(0, this.opts.findIndex((e) => e.dataset.ok === '1'));
    this.paint();
  }
  paint() { this.opts.forEach((e, i) => { e.classList.toggle('cy', i === this.sel); e.classList.toggle('dimt', i !== this.sel && e.dataset.ok === '0'); }); }
  key(b) {
    const app = this.app, s = this.save;
    if (b === 'up' || b === 'down') {
      const n = Math.max(0, Math.min(this.opts.length - 1, this.sel + (b === 'up' ? -1 : 1)));
      if (n !== this.sel) { this.sel = n; this.paint(); sfx('cursor'); }
    } else if (b === 'x') {
      const k = ['open', 'source', 'info'][this.sel];
      if (k === 'info') { sfx('enter'); app.go('info', { save: s }); return; }
      const u = k === 'open' ? s.url : s.source;
      if (!u || u === '#') { sfx('denied'); return; }
      sfx('enter'); app.dialog.openLink(u);
    } else if (b === 'o') { sfx('back'); app.lock(400); this.W.detail = -1; app.go('card', {}); }
  }
  hit(v, kind) {
    const n = +v;
    if (kind === 'hover') { if (n !== this.sel) { this.sel = n; this.paint(); sfx('cursor'); } }
    else { this.sel = n; this.paint(); this.key('x'); }
  }
}

// the file information page (Triangle / Info on a save: capture 139.8): the title, then the console's table -
// labels right-aligned to x 557, values from x 610, rows every 72.5 px - over the save's own backdrop with the grid
// dimmed behind. The portfolio adds two rows (what it is built with, and what it is) under the console's five.
export class InfoScreen extends Screen {
  get W() { return this.app.worlds.browser; }
  enter(from, arg) {
    const s = this.save = arg.save || this.save, r = this.root; r.innerHTML = '';
    const W = this.W; W.detailBig = false;
    tx(r, { x: 666, y: 330, a: 'c', size: 'L', cls: 'yl', html: L(s.title).replace(/\n/g, ' ') });
    const card = P().cards.findIndex((c) => c.saves.includes(s));
    const rows = [['Location', mcName(card + 1)], ['File Type', L(s.type)], ['File Size', `${(s.size || 0).toLocaleString('en-US')} KB`],
      ['Last Updated', (s.date || '').replace(/\//g, '<i class="sl">/</i>')], ['File Protection', 'None']];
    rows.forEach(([k, v], i) => {
      tx(r, { x: 557, y: 446 + i * 72.5, a: 'r', size: 'S', html: k });
      tx(r, { x: 610, y: 446 + i * 72.5, size: 'S', html: v || '-' });
    });
    // the portfolio's own lines, under the console's table
    const d = el('div', 'tx XS info-desc', (s.stack ? `<span class="cy">${L(s.stack)}</span><br>` : '') + L(s.desc), r);
    Object.assign(d.style, { left: '610px', top: '762px', width: '780px', whiteSpace: 'normal', lineHeight: '36px', letterSpacing: '2px', maxHeight: '180px', overflow: 'hidden' });
    this.hints = hints(r, [['o', 'back']], (b) => this.key(b));
  }
  leave() { this.W.detailBig = true; }
  key(b) { if (b === 'o' || b === 'x') { sfx('back'); this.app.go('detail', {}); } }
}
