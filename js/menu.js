// Power switch, boot sequence, main menu, Version Information.
import * as THREE from 'three';
import { World } from './stage.js';
import { ZoomBlur } from './gsfx.js';
import { Screen } from './screen.js';
import { el, tx, hints, setDim } from './ui.js';
import { t, L } from './i18n.js';
import { S, save } from './settings.js';
import { initAudio, sfx, bed } from './audio.js';

// the main menu's 3D layer: black, the orbs, and the always-on zoom blur over them (gsfx.js)
export class MenuWorld extends World {
  constructor(stage, app) {
    super(stage);
    this.app = app; this.ownsOverlay = true;
    this.zb = new ZoomBlur();
    this.O = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
  }
  render(r, target) {
    const w = target.width, h = target.height, st = this.stage;
    if (this.O.width !== w || this.O.height !== h) this.O.setSize(w, h);
    r.setRenderTarget(this.O); r.setClearColor(0x000000, 1); r.clear();
    r.render(this.app.overlay, st.overCam);
    this.zb.render(r, this.O, target, 5, st.box.s * w / st.frame.w, st.box.s * h / st.frame.h, THREE.HalfFloatType);
  }
}

// ---------------------------------------------------------------- power (not part of the console)
// the directional pad, for the arrow keys
const PAD = '<svg class="pad" viewBox="-17 -17 34 34" aria-hidden="true"><path d="M-5 -16H5V-5H16V5H5V16H-5V5H-16V-5H-5Z" opacity=".35"/><path d="M0 -14 4 -9H-4ZM0 14 4 9H-4ZM-14 0 -9 4V-4ZM14 0 9 4V-4Z"/></svg>';
export class PowerScreen extends Screen {
  build() {
    const r = this.root; r.innerHTML = '';
    // the console's front, in standby: red power light, eject light off
    r.insertAdjacentHTML('beforeend', PS2_FRONT);
    this.front = r.querySelector('.pw-ps2');
    tx(r, { x: 720, y: 760, a: 'c', size: 'M', cls: 'pw-hint', html: t('power') });
    // the keyboard, as the console's own hint bar: each face button with the key that presses it
    hints(r, [['s', null, { label: 'Q' }], ['x', null, { label: 'Enter' }], ['o', null, { label: 'Esc' }], ['t', null, { label: 'T' }]],
      (b) => this.key(b)).classList.add('pw-keys');
    tx(r, { x: 720, y: 845, a: 'c', size: 'XS', cls: 'pw-keys pw-small', html: `${PAD}Move<span class="pw-gap"></span>M&nbsp;&nbsp;Mute` });
    const a = el('a', 'pw-plain pw-keys', 'Text version', r);
    a.href = '#plain'; a.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); const p = document.getElementById('plain'); p.tabIndex = -1; p.focus(); });
  }
  key(b) {
    if (this.app.powered) return;
    this.app.powered = true;
    initAudio();
    sfx('power');
    // power on: the light turns green, the eject light comes on, then the picture goes over to the console
    this.root.classList.add('pw-on');
    setTimeout(() => this.root.classList.add('pw-out'), 450);
    setTimeout(() => this.app.go('boot'), 1000);
  }
}

// the front of the original console (SCPH-30000/50000), traced from a straight-on 4858 px photo (Wikimedia Commons,
// "Sony Playstation 2 SCPH-5001 V9", Deni Williams, CC BY 2.0) at 0.27 units per pixel, so the top block is 1200 wide:
// eleven bands across it alternate between fins that stand out (13 units, past the ends) and recessed ones (16.2);
// the MEMORY CARD doors sit over the controller ports, the four-band disc tray carries the PlayStation logo, RESET
// (with the power light) and EJECT sit by the upright SONY; below, set back, are the blue USB panel and the vent.
// The lid, seen from a little above (90 units deep), carries the PS2 logo and the wordmark in true perspective.
const PS2_FRONT = (() => {
  const B = [0, 13, 29.2, 42.2, 58.4, 71.4, 87.6, 100.6, 116.8, 129.8, 146, 159];      // band edges, top to bottom
  const f = (v) => +v.toFixed(2);
  let bands = '';
  for (let i = 0; i < B.length - 1; i++) {
    const y = B[i], h = f(B[i + 1] - B[i]);
    if (i % 2 === 0) {
      // a fin: lit top edge, its face, the shadowed underside
      bands += `<rect x="0" y="${y}" width="1200" height="${h}" rx="3.2" fill="url(#pwOut)"/>` +
        `<rect x="2" y="${f(y + 0.35)}" width="1196" height=".9" rx=".45" fill="#6a6e7b" opacity=".85"/>` +
        `<rect x="1" y="${f(y + h - 1.6)}" width="1198" height="1.6" fill="#040405"/>`;
    } else {
      // a recessed band: in the fin's shadow at the top
      bands += `<rect x="5.9" y="${y}" width="1176.5" height="${h}" fill="url(#pwIn)"/>` +
        `<rect x="0" y="${y}" width="5.9" height="${h}" fill="#070708"/>`;
    }
  }
  // MEMORY CARD door over its controller port; d = the second column's offset
  const column = (d, n) => {
    const X = (x) => f(x + d);
    let o = `<rect x="${X(88.4)}" y="43.8" width="174.2" height="38.1" rx="3" fill="#030304"/>` +
      `<rect x="${X(122.8)}" y="44.4" width="90.6" height="2.2" fill="#000"/>` +
      `<path d="M${X(94.5)} 47.6H${X(256.8)}Q${X(258.8)} 47.6 ${X(258.8)} 49.6V72.4Q${X(258.8)} 74.4 ${X(256.8)} 74.4H${X(94.5)}Q${X(92.5)} 74.4 ${X(92.5)} 72.4V49.6Q${X(92.5)} 47.6 ${X(94.5)} 47.6Z" fill="url(#pwDoor)"/>` +
      `<rect x="${X(93.5)}" y="47.9" width="164.3" height=".9" fill="#8a8e9b" opacity=".8"/>` +
      `<rect x="${X(92.5)}" y="56.1" width="166.3" height=".8" fill="#08080a"/><rect x="${X(92.5)}" y="56.9" width="166.3" height=".6" fill="#5b5f6b" opacity=".7"/>` +
      `<rect x="${X(92.5)}" y="74.4" width="166.3" height="4" fill="#0b0b0d"/>` +
      `<text x="${X(175)}" y="69" text-anchor="middle" font-size="11.6" font-weight="400" letter-spacing=".35" fill="#b0b4c0">MEMORY CARD</text>` +
      `<text x="${X(176.6)}" y="38.7" text-anchor="middle" font-size="10.8" fill="#9a9eaa">${n}</text>` +
      `<path d="M${X(156.9)} 91.7L${X(174.7)} 98.2L${X(192.5)} 91.7" fill="none" stroke="#6a6e7b" stroke-width=".9" stroke-linejoin="round"/>` +
      // the controller port: recess, socket rim, three sections of three pins
      `<rect x="${X(91)}" y="102.8" width="170" height="37" rx="5" fill="#030304"/>` +
      `<path d="M${X(92.5)} 104.1H${X(259.6)}V129.5Q${X(259.6)} 132 ${X(257.4)} 134L${X(253.6)} 137.4Q${X(252.4)} 138.5 ${X(250.6)} 138.5H${X(101.5)}Q${X(99.7)} 138.5 ${X(98.5)} 137.4L${X(94.7)} 134Q${X(92.5)} 132 ${X(92.5)} 129.5Z" fill="#17181d" stroke="#4b4e59" stroke-width=".8"/>`;
    for (const [a, b] of [[103.3, 151.5], [154, 201.6], [203.7, 252.2]]) {
      o += `<path d="M${X(a)} 108.7H${X(b)}V129.5Q${X(b)} 132.5 ${X(b - 3)} 132.5H${X(a + 3)}Q${X(a)} 132.5 ${X(a)} 129.5Z" fill="url(#pwPort)" stroke="#50535e" stroke-width=".7"/>` +
        `<rect x="${X(a + 1.6)}" y="109.7" width="${f(b - a - 3.2)}" height="7.2" rx="1.2" fill="#020203"/>` +
        `<rect x="${X(a + 1.6)}" y="116.9" width="${f(b - a - 3.2)}" height=".8" fill="#5a5d68"/>`;
    }
    for (const x of [110.9, 126.6, 143.1, 159.3, 175.8, 191.7, 208.2, 224.5, 241]) {
      o += `<circle cx="${X(x)}" cy="125.4" r="3.8" fill="#000" stroke="#0c0c0e" stroke-width=".6"/><path d="M${X(x - 3.3)} 127A3.8 3.8 0 0 0 ${X(x + 3.3)} 127" fill="none" stroke="#6b6f7b" stroke-width=".8"/>`;
    }
    for (const [a, b] of [[149.6, 154.1], [176.3, 179.3], [201.5, 204.7]]) o += `<rect x="${X(a)}" y="104.6" width="${f(b - a)}" height="3.4" fill="#5c5440"/>`;
    return o;
  };
  // the vent: six slats, dividers every 53 units, a little of the inside showing
  let vent = '<rect x="232.9" y="198.8" width="728" height="59.7" fill="#020203"/>' +
    '<g fill="#3a3c44" opacity=".55"><rect x="250" y="201" width="38" height="5"/><rect x="420" y="214" width="60" height="4"/><rect x="760" y="201" width="110" height="5"/><rect x="890" y="227" width="45" height="4"/></g>';
  for (let j = 0; j < 7; j++) {
    const y = f(198.8 + j * 8.65 - 2.1);
    vent += `<rect x="232.9" y="${y}" width="728" height="1.7" fill="#1a1b20"/><rect x="232.9" y="${y}" width="728" height=".6" fill="#454852"/>`;
  }
  for (let x = 232.9; x < 961; x += 53) vent += `<rect x="${f(x)}" y="198.8" width="6" height="59.7" fill="#17181d"/><rect x="${f(x)}" y="198.8" width=".8" height="59.7" fill="#34363e"/>`;
  const usb = (y) => `<rect x="44.9" y="${y}" width="55.7" height="23.8" rx="1.2" fill="#9aa0ae"/><rect x="46.4" y="${f(y + 1.5)}" width="52.7" height="20.8" fill="#050506"/>` +
    `<rect x="49.5" y="${f(y + 4)}" width="46.5" height="6.2" fill="#121317"/><rect x="51.5" y="${f(y + 9.4)}" width="42.5" height="1" fill="#5d606b"/>` +
    `<rect x="46.4" y="${f(y + 19.6)}" width="52.7" height="1.4" fill="#6f7482"/>`;
  const eject = '<path d="M1129.1 122.2L1135.1 116.4L1141.1 122.2Z"/><rect x="1129.1" y="123.8" width="12" height="3.2"/>';
  // the lid (301 x 182 mm) seen from the front, a little above: the back edge 1112 units wide at y 0, the front edge
  // 1200 at y LID. A point u mm from the left and v mm from the back lands where perspective puts it: interpolate the
  // two edges in homogeneous terms, the weight going as 1 / width (so lines stay straight and lean with the sides)
  const LID = 90;
  const lid = (u, v) => {
    const t = v / 182, wb = (1 - t) / 1112, wf = t / 1200, x = u / 301;
    return [(wb * (44 + 1112 * x) + wf * 1200 * x) / (wb + wf), wf * LID / (wb + wf)];
  };
  const quad = (u0, v0, u1, v1) => 'M' + [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map((q) => lid(...q).map(f).join(' ')).join('L') + 'Z';
  // the PS2 logo, measured on a straight-down close-up of the lid (Wikimedia Commons, same author) in that photo's
  // pixels: P, S and 2 drawn with bars 21-22 px thick and 270 px tall. 0.0815 mm a pixel, the P's top-left corner
  // 25.8 mm from the back and 177.8 mm from the left; the letters run back to front with their tops to the right
  const L = (x0, y0, x1, y1) => quad(177.8 - 0.0815 * (y0 - 496), 25.8 + 0.0815 * (x0 - 169), 177.8 - 0.0815 * (y1 - 496), 25.8 + 0.0815 * (x1 - 169));
  const logo = [[169, 496, 661, 518], [640, 496, 661, 642], [170, 621, 661, 642], [171, 621, 192, 766],    // P
    [661, 744, 931, 766], [910, 496, 931, 766], [910, 496, 1181, 518],                                      // S
    [1252, 496, 1739, 518], [1718, 496, 1739, 642], [1252, 621, 1739, 642], [1252, 621, 1272, 766], [1252, 744, 1739, 766]]   // 2
    .map((r) => L(...r)).join('');
  // the embossed wordmark beside it (cap height 8.15 mm, baseline 139.2 mm from the left, 57.7 to 119.6 mm from the
  // back), laid on the lid by the perspective's slope at its middle: text x runs with v, text y against u
  const g = (v) => +v.toFixed(4);
  const wm = (() => {
    const uc = 143.3, vc = 88.6, e = 0.01, [x0, y0] = lid(uc, vc), [xu, yu] = lid(uc + e, vc), [xv, yv] = lid(uc, vc + e);
    const du = [(xu - x0) / e, (yu - y0) / e], dv = [(xv - x0) / e, (yv - y0) / e];
    return `matrix(${g(dv[0])} ${g(dv[1])} ${g(-du[0])} ${g(-du[1])} ${g(x0 + du[0] * (139.2 - uc) + dv[0] * (57.7 - vc))} ${g(y0 + du[1] * (139.2 - uc) + dv[1] * (57.7 - vc))})`;
  })();
  // the PlayStation badge in the disc tray: the logo's own outline (a 24-unit box) fitted to the photo, 1.638 units
  // a logo unit (IoU .83); the S is yellow below the straight line y = 15.22 + .312 x and cyan above it
  const PS_P = 'M8.984 2.596v17.547l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.18.76.814.76 1.505v5.875c2.441 1.193 4.362-.002 4.362-3.152 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.39-1.502z';
  const PS_S = 'M13.64 18.837l6.296-2.275c.715-.258.826-.625.246-.818-.586-.192-1.637-.139-2.357.123l-4.205 1.499v-2.385l.24-.085s1.201-.42 2.913-.615c1.696-.18 3.785.03 5.437.661 1.848.601 2.04 1.472 1.576 2.072-.465.6-1.622 1.036-1.622 1.036l-8.544 3.107v-2.297l.02-.023z' +
    'M1.807 18.6c-1.9-.545-2.214-1.668-1.352-2.32.801-.586 2.16-1.052 2.16-1.052l5.615-2.013v2.313L4.205 17c-.705.271-.825.632-.239.826.586.195 1.637.15 2.343-.12L8.247 17v2.074c-.12.03-.256.044-.39.073-1.939.331-3.996.196-6.038-.479z';
  // the three lights sit in their own layers over the console (same box), so switching them only changes those
  // layers' opacity: inside the console's SVG every step of the fade re-rastered it, filters and all (~50 ms stall)
  const leds = {
    'pw-led-r': '<circle cx="1149.8" cy="22.7" r="7" fill="#ff2010" filter="url(#pwBlur)" opacity=".8"/><circle cx="1149.8" cy="22.7" r="2.7" fill="url(#pwRed)"/>',
    'pw-led-g': '<circle cx="1149.8" cy="22.7" r="7" fill="#30ff50" filter="url(#pwBlur)" opacity=".75"/><circle cx="1149.8" cy="22.7" r="2.7" fill="url(#pwGreen)"/>',
    'pw-led-b': `<g fill="#4f9bff" filter="url(#pwBlur)" opacity=".9">${eject}</g><g fill="#cfe3ff" stroke="#5aa2ff" stroke-width="1">${eject}</g>`,
  };
  const layers = Object.entries(leds).map(([c, g]) => `<svg class="pw-lay ${c}" viewBox="0 0 1200 372" width="1120" height="347.2"><g transform="translate(0 90)">${g}</g></svg>`).join('');
  return `<div class="pw-con" aria-hidden="true"><svg class="pw-ps2" viewBox="0 0 1200 372" width="1120" height="347.2" aria-hidden="true" font-family="Arial, Helvetica, sans-serif" text-rendering="geometricPrecision">
<defs>
  <linearGradient id="pwLid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0d10"/><stop offset="1" stop-color="#1f2026"/></linearGradient>
  <linearGradient id="pwLogo" gradientUnits="userSpaceOnUse" x1="${f(lid(155.8, 90)[0])}" y1="0" x2="${f(lid(177.8, 90)[0])}" y2="0"><stop offset="0" stop-color="#93c8eb"/><stop offset=".5" stop-color="#7a8ece"/><stop offset="1" stop-color="#7279bd"/></linearGradient>
  <clipPath id="pwPsC"><path d="M-1 14.911L25 23.026V-1H-1Z"/></clipPath>
  <linearGradient id="pwOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#363841"/><stop offset=".25" stop-color="#282a32"/><stop offset=".85" stop-color="#1d1e25"/><stop offset="1" stop-color="#0c0c0f"/></linearGradient>
  <linearGradient id="pwIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050506"/><stop offset=".3" stop-color="#15161b"/><stop offset="1" stop-color="#1d1e24"/></linearGradient>
  <linearGradient id="pwDoor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3c45"/><stop offset=".3" stop-color="#2b2d34"/><stop offset=".33" stop-color="#25272e"/><stop offset="1" stop-color="#1c1d23"/></linearGradient>
  <linearGradient id="pwLow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#030304"/><stop offset=".05" stop-color="#121216"/><stop offset=".5" stop-color="#101013"/><stop offset="1" stop-color="#0a0a0c"/></linearGradient>
  <linearGradient id="pwPort" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#202228"/><stop offset=".45" stop-color="#2c2e36"/><stop offset="1" stop-color="#1c1d23"/></linearGradient>
  <linearGradient id="pwBtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#25262c"/><stop offset="1" stop-color="#121216"/></linearGradient>
  <linearGradient id="pwUsb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a68cc"/><stop offset=".55" stop-color="#1f53ad"/><stop offset="1" stop-color="#1a4590"/></linearGradient>
  <radialGradient id="pwRed"><stop offset="0" stop-color="#ffb0a0"/><stop offset=".4" stop-color="#ff2a1a"/><stop offset="1" stop-color="#7a0600"/></radialGradient>
  <radialGradient id="pwGreen"><stop offset="0" stop-color="#d8ffd0"/><stop offset=".4" stop-color="#2cff4a"/><stop offset="1" stop-color="#05600f"/></radialGradient>
  <radialGradient id="pwLed"><stop offset="0" stop-color="#d0d2d8"/><stop offset=".5" stop-color="#7d808a"/><stop offset="1" stop-color="#34363c"/></radialGradient>
  <filter id="pwBlur" x="-2" y="-2" width="5" height="5"><feGaussianBlur stdDeviation="4"/></filter>
  <filter id="pwGrain" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7"/>
    <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.6 0 0 0 -1.45"/></filter>
  <clipPath id="pwBody"><path d="M44 0H1156L1200 90H0Z"/><rect x="0" y="90" width="1200" height="159" rx="3.2"/><rect x="9.7" y="249" width="1057.8" height="121.5"/></clipPath>
</defs>
<path d="M44 0H1156L1200 90H0Z" fill="url(#pwLid)"/>
<rect x="0" y="88.6" width="1200" height="1.4" fill="#4f525d"/>
<text transform="${wm}" font-size="11.4" textLength="61.9" lengthAdjust="spacingAndGlyphs" fill="#2a2b32">PlayStation <tspan font-size="12.5" font-weight="700">2</tspan></text>
<path d="${logo}" fill="url(#pwLogo)"/>
<g transform="translate(0 90)">
<path d="M9.7 159H1067.5V278.5Q1067.5 280.5 1065.5 280.5H11.7Q9.7 280.5 9.7 278.5Z" fill="url(#pwLow)"/>
<rect x="9.7" y="159" width="1057.8" height="4.5" fill="#020203"/>
<rect x="33" y="164.4" width="142.8" height="102" rx="2.2" fill="url(#pwUsb)"/>
<rect x="33.6" y="164.8" width="141.6" height=".9" fill="#7aa3ec" opacity=".75"/><rect x="33.6" y="265.2" width="141.6" height=".8" fill="#0d2a5c"/>
${usb(190.1)}${usb(222.9)}
<g fill="none" stroke="#a99bd0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".9">
  <path d="M120.4 203V231.5M120.4 221.5L113.2 215.2V211M120.4 225L127.7 218.6V213.2"/><circle cx="113.2" cy="209.4" r="1.8"/><rect x="126.1" y="210.1" width="3.2" height="3.1"/>
  <circle cx="120.4" cy="233.6" r="2.7" fill="#a99bd0"/><path d="M117.9 203.6L120.4 199.6L122.9 203.6Z" fill="#a99bd0"/></g>
${vent}
${bands}
${column(0, 1)}${column(210.95, 2)}
<g font-size="8" fill="#9a9eaa"><text x="282.2" y="38.9" textLength="70" lengthAdjust="spacingAndGlyphs"><tspan font-size="10.6">M</tspan>AGIC<tspan font-size="10.6">G</tspan>ATE</text></g>
<rect x="579.6" y="42.2" width="4.2" height="58.4" fill="#020203"/><rect x="584" y="42.2" width="1" height="58.4" fill="#3c3f48"/>
<rect x="1084.8" y="42.2" width="3.4" height="58.4" fill="#020203"/><rect x="1088.2" y="42.2" width=".9" height="58.4" fill="#33353d"/>
<g fill="#020203"><rect x="1092" y="13" width="1.2" height="133"/><rect x="1112.6" y="13" width="1.4" height="133"/></g>
<g transform="translate(840.85 59.49) scale(1.638)">
  <path d="${PS_P}${PS_S}" fill="#050506" stroke="#050506" stroke-width=".5" stroke-linejoin="round"/>
  <path d="${PS_S}" fill="#f0c800"/><path d="${PS_S}" fill="#00d6e6" clip-path="url(#pwPsC)"/><path d="${PS_P}" fill="#f01430"/>
</g>
<rect x="1156.5" y="27" width="28.5" height="101" fill="#050506" opacity=".55"/>
<text x="1171.5" y="77.6" transform="rotate(90 1171.5 77.6)" text-anchor="middle" dominant-baseline="central" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="26.5" textLength="94.7" lengthAdjust="spacingAndGlyphs" fill="#d4d6dc" stroke="#050506" stroke-width=".8" paint-order="stroke">SONY</text>
<rect x="1117.5" y="16.8" width="39.2" height="37.8" rx="1.6" fill="url(#pwBtn)" stroke="#43464f" stroke-width=".7"/>
<rect x="1118.2" y="17.3" width="37.8" height=".8" fill="#5c606c" opacity=".8"/>
<path d="M1133.4 28.6A5.95 5.95 0 1 0 1140.6 28.6M1137 25.6V32.6" fill="none" stroke="#23c3dc" stroke-width="1.45" stroke-linecap="round"/>
<text x="1123.3 1129.4 1135 1140.6 1146.2" y="49.8" font-size="8.4" font-weight="700" fill="#23c3dc">RESET</text>
<circle cx="1149.8" cy="22.7" r="2.7" fill="url(#pwLed)"/>
<rect x="1115.6" y="103.3" width="38.4" height="36.5" rx="1.6" fill="url(#pwBtn)" stroke="#43464f" stroke-width=".7"/>
<rect x="1116.3" y="103.8" width="37" height=".8" fill="#5c606c" opacity=".8"/>
<g fill="none" stroke="#3a86e6" stroke-width="1.15" stroke-linejoin="round">${eject}</g>
</g>
<rect x="0" y="0" width="1200" height="372" filter="url(#pwGrain)" clip-path="url(#pwBody)" opacity=".1" style="mix-blend-mode:screen"/>
</svg>${layers}</div>`;
})();

// ---------------------------------------------------------------- boot
// the opening scene runs on its own frame counter (boot.js); this screen only adds the text and moves on when the
// camera has dived through (the console holds black for ~2 s before the main menu's orbs fly in)
export class BootScreen extends Screen {
  build() {
    this.root.innerHTML = '';
    const C = this.app.C;
    // the capture's DoSCEText: ink 63 px tall (cap top to descender) on a baseline at 554, the face drawn narrow
    // (x .762) and untracked - "Sony Computer Entertainment" is 655 px wide, centred on 718.5
    this.sce = tx(this.root, { x: 716, y: 554, a: 'c', size: 64.2, cls: 'sce', html: L(C.bootText) || 'Ilyes Computer Entertainment' });
    this.sce.style.transform = 'translateX(-50%) scaleX(.762)';
    this.sce.style.opacity = 0;
  }
  enter() {
    const app = this.app, W = app.worlds.boot;
    W.start();
    app.setWorld('boot', 0);
    app.orbs.jump({ alpha: 0, scatter: 0, x: 603, y: 538.5 });
    sfx('boot'); bed(null);
    this.t = 0; this.done = false; this.orbsIn = false; this.endT = null;
  }
  update(dt) {
    this.t += dt / this.app.speed;
    const app = this.app, W = app.worlds.boot;
    // DoSCEText draws at min(alpha, 112) with a normal alpha blend
    this.sce.style.opacity = (Math.min(W.textAlpha, 112) / 128).toFixed(3);
    if (W.ended && this.endT === null) this.endT = this.t;
    // the capture holds black for 2.0 s after the dive before the orbs appear
    if (this.endT !== null && this.t > this.endT + 1.9 && !this.done) this.finish();
  }
  key(b) { if (this.t > 1.2 && !this.done && b !== 'any') this.finish(true); }
  finish(skipped) {
    this.done = true;
    const app = this.app;
    this.sce.style.opacity = 0;
    app.setWorld('menu', skipped ? 0.5 : 0.01);
    app.orbs.set({ mode: 'menu' });
    if (!skipped) { app.orbs.jump({ alpha: 0, scatter: 0 }); app.orbs.flyIn(); }
    app.go('main', { fromBoot: true });
  }
}

// ---------------------------------------------------------------- main menu
export class MainScreen extends Screen {
  build() {
    const r = this.root; r.innerHTML = '';
    this.items = [
      tx(r, { x: 972, y: 531, a: 'c', size: 'L', html: t('browser') }),
      tx(r, { x: 972, y: 608, a: 'c', size: 'L', html: t('syscfg') }),
    ];
    this.items.forEach((e, i) => { e.dataset.hit = i; });
    this.hints = hints(r, [['x', 'enter'], ['t', 'version']], (b) => this.key(b));
    this.sel = this.sel || 0; this.paint();
  }
  paint() { this.items.forEach((e, i) => e.classList.toggle('cy', i === this.sel)); this.items.forEach((e, i) => e.classList.toggle('dimt', i !== this.sel)); }
  enter(from, arg) {
    const app = this.app;
    const fromCfg = from && from.id === 'config';
    // the menu's bed: after the boot it comes in under the tail of the startup sound; leaving System Configuration,
    // SNDCLOKS fades and the menu's bed returns ~1.6 s after the back (capture 88.0 -> 89.6)
    if (from && from.id === 'boot') bed('menu', 2.0, 0.5, 2.0);
    else if (fromCfg) bed('menu', 1.0, 1.5, 1.6);
    else bed('menu', 1.5, 0.5, 0.6);
    // System Configuration plays its own way out (cubes, sky, clock) and ends in black
    if (fromCfg) app.after(1650, () => app.setWorld('menu', 0));
    else app.setWorld('menu', 0.6);
    app.orbs.set({ mode: 'menu', x: 603, y: 538.5, alpha: 1, merge: 0, scatter: 1, bright: 1 }, arg.fromBoot ? 1.2 : 2.2);
    if (arg.instant) { app.orbs.jump({ alpha: 1, scatter: 1 }); app.setWorld('menu', 0); }
    this.paint();
    // back from the Browser (capture 260.4 -> 262.0): the orbs fly in from the black, the text follows 1.6 s later
    if (from && from.id === 'browser') {
      app.orbs.jump({ alpha: 0, scatter: 0 }); app.orbs.flyIn(); app.orbs.set({ alpha: 1, scatter: 1 }, 1.2);
      this.show(false); app.after(1, () => { this.show(true); sfx('btm'); }); return 'hold';
    }
    // after the boot the menu text and hints cut in 1.03 s after the orbs start flying in (capture 8.85 -> 9.88)
    if (from && from.id === 'boot') { this.show(false); this.root.classList.add('quick'); app.after(1030, () => { this.show(true); app.after(200, () => this.root.classList.remove('quick')); }); return 'hold'; }
    if (from && from.id !== 'power') { this.show(false); app.after(from.id === 'version' ? 250 : fromCfg ? 1650 : 450, () => this.show(true)); return 'hold'; }
  }
  key(b) {
    const app = this.app;
    if (b === 'up' || b === 'down') {
      const n = b === 'up' ? 0 : 1;
      if (n !== this.sel) { this.sel = n; this.paint(); sfx('cursor'); }
    } else if (b === 'x') {
      sfx('enter');
      app.lock(this.sel === 0 ? 3600 : 900);
      if (this.sel === 0) app.go('browser', { fromMain: true }); else app.go('config', { fromMain: true });
    } else if (b === 't') {
      sfx('enter'); app.lock(500); app.go('version');
    }
  }
  hit(v, kind) {
    const n = +v;
    if (kind === 'hover') { if (n !== this.sel) { this.sel = n; this.paint(); sfx('cursor'); } }
    else { this.sel = n; this.paint(); this.key('x'); }
  }
}

// ---------------------------------------------------------------- Version Information (+ its option pages)
export class VersionScreen extends Screen {
  rows() {
    const C = this.app.C;
    return (C.about || [
      { label: t('console'), value: t('unknown'), menu: 'console' },
      { label: t('browser'), value: '2.00' },
      { label: t('cdplayer'), value: '2.00' },
      { label: t('driver'), value: '1.11', menu: 'driver' },
    ]).map((r) => ({ ...r, label: r.labelKey ? t(r.labelKey) : L(r.label), value: r.valueKey ? t(r.valueKey) : L(r.value) }));
  }
  // option pages: [title, [{label, key (setting), values:[[value,labelKey]]} | {label, value, url}]]
  page(menu) {
    const C = this.app.C;
    if (menu === 'console') return [t('console'), [{ label: t('diagnosis'), key: 'diag', values: [['off', 'off'], ['on', 'on']] }]];
    if (menu === 'driver') return [t('driver'), [
      { label: t('discSpeed'), key: 'discSpeed', values: [['standard', 'standard'], ['fast', 'fast']] },
      { label: t('texMap'), key: 'texMap', values: [['standard', 'standard'], ['smooth', 'smooth']] }]];
    if (menu === 'contact') return [L(C.contactTitle) || 'Contact', (C.contact || []).map((c) => ({ label: L(c.label), value: L(c.value), url: c.url }))];
    if (menu === 'profile') return [L(C.profileTitle) || L(C.name), (C.profile || []).map((p) => ({ label: L(p[0]), value: L(p[1]) }))];
    return [menu, []];
  }
  build() {
    const r = this.root; r.innerHTML = '';
    this.main = el('div', 'layer', null, r);
    this.sub = el('div', 'layer', null, r);
    this.sel = this.sel || 0;
    this.buildMain();
    if (this.subMenu) this.buildSub();
  }
  buildMain() {
    const m = this.main; m.innerHTML = '';
    const rows = this.rows();
    this.nrows = rows.length;
    // the block keeps the console's proportions: title 154 px above the first row, 53 px row pitch, centred on the screen
    const y0 = 577 - Math.max(0, rows.length - 4) * 26;
    tx(m, { x: 997, y: y0 - 154, a: 'c', size: 'M', cls: 'yl', html: t('verinfo') });
    this.rowEls = rows.map((row, i) => {
      const y = y0 + i * 53;
      const a = tx(m, { x: 962, y, a: 'r', size: 'M', html: row.label });
      const b = tx(m, { x: 1031, y, a: 'l', size: 'M', html: row.value });
      a.dataset.hit = b.dataset.hit = i;
      return { a, b, row };
    });
    this.hintsMain = hints(m, [['o', 'back'], ['t', 'options']], (b) => this.key(b));
    this.paintMain();
  }
  paintMain() {
    this.rowEls.forEach(({ a, b, row }, i) => {
      const on = i === this.sel;
      a.className = a.className.replace(/ ?(cy|wh|dimt)/g, '') + (on ? (row.menu || row.url ? ' cy' : ' wh') : ' dimt');
      b.className = b.className.replace(/ ?(cy|wh|dimt)/g, '') + (on ? '' : ' dimt');
    });
    const row = this.rowEls[this.sel].row;
    setDim(this.hintsMain, 't', false);
    this.hintsMain.querySelector('[data-btn="t"]').style.visibility = row.menu ? 'visible' : 'hidden';
  }
  buildSub() {
    const s = this.sub; s.innerHTML = '';
    const [title, items] = this.page(this.subMenu);
    this.subItems = items;
    const y0 = 578 - Math.max(0, items.length - 3) * 26;
    tx(s, { x: 997, y: y0 - 172, a: 'c', size: 'M', cls: 'yl', html: title });
    this.subEls = items.map((it, i) => {
      const y = y0 + i * 72;
      const a = tx(s, { x: 955, y, a: 'r', size: 'M', html: it.label });
      const vals = it.values ? it.values : null;
      const b = tx(s, { x: 1040, y, a: 'l', size: 'M', html: vals ? t(vals.find((v) => v[0] === S[it.key])[1]) : it.value || '' });
      a.dataset.hit = b.dataset.hit = 's' + i;
      let opts = null;
      if (vals) opts = vals.map((v, j) => { const o = tx(s, { x: 1040, y: y + j * 53, a: 'l', size: 'M', html: t(v[1]) }); o.style.opacity = 0; o.dataset.hit = 'v' + j; return o; });
      return { a, b, it, opts };
    });
    this.hintsSub = hints(s, [['x', 'enter'], ['o', 'back']], (b) => this.key(b));
    this.subSel = this.subSel || 0; this.editing = false;
    this.paintSub();
  }
  paintSub() {
    this.subEls.forEach(({ a, b, it, opts }, i) => {
      const on = i === this.subSel, ed = on && this.editing;
      a.className = a.className.replace(/ ?(cy|wh|dimt)/g, '') + (on ? (ed ? ' wh' : ' cy') : ' dimt');
      b.style.opacity = ed ? 0 : 1;
      b.className = b.className.replace(/ ?(cy|wh|dimt)/g, '') + (on ? '' : ' dimt');
      if (opts) opts.forEach((o, j) => { o.style.opacity = ed ? 1 : 0; o.className = o.className.replace(/ ?(cy|wh|dimt)/g, '') + (ed && j === this.optSel ? ' cy' : ' dimt'); });
      // rows under an open option list make room for it
      if (i > this.subSel && this.editing) { a.style.opacity = b.style.opacity = 0.0; } else if (!ed) { a.style.opacity = 1; }
    });
  }
  enter(from) {
    const app = this.app;
    app.setWorld('menu', 0.6);
    this.subMenu = null; this.sel = 0;
    this.main.innerHTML = ''; this.buildMain();
    this.sub.innerHTML = '';
    this.main.style.opacity = 1;
    app.orbs.set({ mode: 'arc', x: 619, y: 545.5, alpha: 1, merge: 0, scatter: 1 }, 2.4);
    this.show(false); app.after(260, () => this.show(true));
    return 'hold';
  }
  key(b) {
    const app = this.app;
    if (!this.subMenu) {
      if (b === 'up' || b === 'down') {
        const n = Math.max(0, Math.min(this.nrows - 1, this.sel + (b === 'up' ? -1 : 1)));
        if (n !== this.sel) { this.sel = n; this.paintMain(); sfx('cursor'); }
      } else if (b === 'o') { sfx('back'); app.lock(400); app.go('main'); }
      else if (b === 't' || b === 'x') {
        const row = this.rowEls[this.sel].row;
        if (row.url && b === 'x') { sfx('enter'); app.dialog.openLink(row.url); return; }
        if (!row.menu) return;
        sfx('enter'); this.openSub(row.menu);
      }
      return;
    }
    // option page
    const it = this.subItems[this.subSel];
    if (!this.editing) {
      if (b === 'up' || b === 'down') {
        const n = Math.max(0, Math.min(this.subItems.length - 1, this.subSel + (b === 'up' ? -1 : 1)));
        if (n !== this.subSel) { this.subSel = n; this.paintSub(); sfx('cursor'); }
      } else if (b === 'x') {
        if (!it) return;
        sfx('enter');
        if (it.url) { app.dialog.openLink(it.url); return; }
        if (!it.values) return;
        this.editing = true; this.optSel = it.values.findIndex((v) => v[0] === S[it.key]); this.paintSub();
      } else if (b === 'o') { sfx('back'); this.closeSub(); }
    } else {
      if (b === 'up' || b === 'down') {
        const n = Math.max(0, Math.min(it.values.length - 1, this.optSel + (b === 'up' ? -1 : 1)));
        if (n !== this.optSel) { this.optSel = n; this.paintSub(); sfx('cursor'); }
      } else if (b === 'x') {
        sfx('enter');
        S[it.key] = it.values[this.optSel][0]; save();
        this.editing = false;
        this.applySetting(it.key);
        this.buildSub();
      } else if (b === 'o') { sfx('back'); this.editing = false; this.paintSub(); }
    }
  }
  applySetting(key) {
    const app = this.app;
    if (key === 'diag') app.applyDiag();
    if (key === 'discSpeed') app.applySpeed();
    if (key === 'texMap') app.relayout();
  }
  openSub(menu) {
    const app = this.app;
    this.subMenu = menu; this.subSel = 0; this.editing = false;
    this.main.style.transition = 'opacity .25s'; this.main.style.opacity = 0;
    app.orbs.set({ x: 520, y: 650.5, merge: 0.7 }, 2.5);
    app.lock(300);
    app.after(260, () => { this.buildSub(); this.sub.style.opacity = 1; });
  }
  closeSub() {
    const app = this.app;
    this.sub.innerHTML = ''; this.subMenu = null;
    app.orbs.set({ x: 619, y: 545.5, merge: 0 }, 2.4);
    app.after(200, () => { this.buildMain(); this.main.style.opacity = 1; });
  }
  hit(v, kind) {
    if (!this.subMenu) {
      const n = +v; if (Number.isNaN(n)) return;
      if (kind === 'hover') { if (n !== this.sel) { this.sel = n; this.paintMain(); sfx('cursor'); } }
      else { this.sel = n; this.paintMain(); this.key('t'); }
      return;
    }
    if (v[0] === 's') {
      const n = +v.slice(1);
      if (this.editing) return;
      if (kind === 'hover') { if (n !== this.subSel) { this.subSel = n; this.paintSub(); sfx('cursor'); } }
      else { this.subSel = n; this.paintSub(); this.key('x'); }
    } else if (v[0] === 'v' && this.editing) {
      const n = +v.slice(1);
      if (kind === 'hover') { if (n !== this.optSel) { this.optSel = n; this.paintSub(); sfx('cursor'); } }
      else { this.optSel = n; this.key('x'); }
    }
  }
}
