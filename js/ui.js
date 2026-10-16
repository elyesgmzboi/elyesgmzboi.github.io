// Interface helpers: text placed by baseline in the 1440x1080 box, button glyphs, the hint row.
import { t } from './i18n.js';

export const SIZES = { L: 64, T: 53.5, M: 48, I: 40, S: 36, XS: 30 };
const TRACK = 4; // letter-spacing in interface px; trailing spacing is compensated when aligning

export function el(tag, cls, html, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

// Text whose *baseline* sits at y. a = 'l' | 'c' | 'r' anchors x to the left edge, centre or right edge of the ink.
export function tx(parent, { x, y, a = 'l', size = 'M', cls = '', html = '', lh }) {
  const e = el('div', `tx ${size} ${cls}`, html, parent);
  place(e, { x, y, a, size, lh });
  return e;
}

export function place(e, { x, y, a = 'l', size = 'M', lh }) {
  const fs = SIZES[size] || size;
  const L = lh || fs;
  e.style.lineHeight = L + 'px';
  e.style.top = (y - (L + fs) / 2) + 'px';
  if (a === 'l') { e.style.left = x + 'px'; e.style.transform = ''; }
  else if (a === 'c') { e.style.left = (x + TRACK / 2) + 'px'; e.style.transform = 'translateX(-50%)'; }
  else { e.style.left = (x + TRACK) + 'px'; e.style.transform = 'translateX(-100%)'; }
  if (a !== 'l') e.style.textAlign = a === 'c' ? 'center' : 'right';
}

// "Memory Card (PS2)/1" with the small (PS2) of the console font
export const mcName = (n) => `${t('mc')} <span class="ps2">(PS2)</span>/${n}`;

const GLYPH = {
  x: '<path d="M-13 -14 13 14M13 -14 -13 14" stroke="#8584f0" stroke-width="4.6" stroke-linecap="round" fill="none"/>',
  o: '<circle r="15.2" stroke="#e05058" stroke-width="4.4" fill="none"/>',
  t: '<path d="M0 -14.5 15.5 12.5 -15.5 12.5Z" stroke="#2fbf6c" stroke-width="4.2" stroke-linejoin="round" fill="none"/>',
  s: '<rect x="-12.5" y="-13" width="25" height="26" stroke="#dc80b4" stroke-width="4.4" fill="none"/>',
};
export function btnSVG(b) {
  return `<svg class="bi" viewBox="-28 -28 56 56" width="56" height="56" aria-hidden="true"><circle r="25.5" fill="url(#bhalo)"/>${GLYPH[b]}</svg>`;
}

// Bottom row of button hints. Slots measured from the console: square 66, cross 491, circle 764, triangle right-aligned to 1384.
const SLOT = { s: 66, x: 491, o: 764 };
export function hints(parent, list, onPress) {
  const row = el('div', 'hints', null, parent);
  let lastRight = 0;
  for (const [b, key, opts] of list) {
    const h = el('div', 'hint' + (opts && opts.dim ? ' dim' : ''), null, row);
    h.dataset.btn = b;
    const label = (opts && opts.label) || t(key);
    h.innerHTML = btnSVG(b) + `<span class="tx M">${label}</span>`;
    let touchStart = null, suppressClickUntil = 0;
    h.addEventListener('pointerdown', (e) => {
      suppressClickUntil = 0;
      if (e.pointerType === 'touch') touchStart = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    h.addEventListener('pointerup', (e) => {
      if (!touchStart || touchStart.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - touchStart.x, e.clientY - touchStart.y);
      touchStart = null;
      suppressClickUntil = performance.now() + 750;
      if (moved > 12) return;
      e.stopPropagation();
      onPress && onPress(b);
    });
    h.addEventListener('pointercancel', (e) => {
      if (touchStart && touchStart.id === e.pointerId) touchStart = null;
    });
    h.addEventListener('click', (e) => {
      e.stopPropagation();
      if (performance.now() < suppressClickUntil) { suppressClickUntil = 0; return; }
      onPress && onPress(b);
    });
    const w = 58 + measure(label);
    const x = b === 't' ? Math.max(1384 + TRACK - w, lastRight + 34) : Math.max(SLOT[b], lastRight + 34);
    h.style.left = x + 'px'; h.style.width = w + 'px';
    lastRight = x + w;
  }
  return row;
}

// ink width of an M-size label, for pushing crowded hints apart (localised strings get long)
const mctx = document.createElement('canvas').getContext('2d');
export function measure(s, size = 48) {
  mctx.font = `${size}px OSD`;
  if ('letterSpacing' in mctx) mctx.letterSpacing = TRACK + 'px';
  return mctx.measureText(s).width;
}

export function setDim(row, b, dim) {
  const h = row && row.querySelector(`[data-btn="${b}"]`);
  if (h) h.classList.toggle('dim', !!dim);
}

export const SVG_UPDOWN = '<svg class="updown" viewBox="0 0 40 60" width="40" height="60" aria-hidden="true"><path d="M20 1 39 25H1Z"/><path d="M20 59 39 35H1Z"/></svg>';
export const SVG_SUN = '<svg class="sun" viewBox="-20 -20 40 40" width="40" height="40" aria-hidden="true"><g stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
  [0, 45, 90, 135, 180, 225, 270, 315].map((a) => { const r = a * Math.PI / 180; return `<line x1="${(Math.cos(r) * 14.8).toFixed(2)}" y1="${(Math.sin(r) * 14.8).toFixed(2)}" x2="${(Math.cos(r) * 18.6).toFixed(2)}" y2="${(Math.sin(r) * 18.6).toFixed(2)}"/>`; }).join('') +
  '</g><circle r="11" fill="currentColor"/><path d="M1 -7.5V1H-6" stroke="#1c1630" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const SVG_LEFT = '<svg class="lr" viewBox="0 0 22 38" width="22" height="38" aria-hidden="true"><path d="M1 19 21 1V37Z"/></svg>';
export const SVG_RIGHT = '<svg class="lr" viewBox="0 0 22 38" width="22" height="38" aria-hidden="true"><path d="M21 19 1 1V37Z"/></svg>';
export const SVG_DOWN = '<svg class="more" viewBox="0 0 54 40" width="54" height="40" aria-hidden="true"><path d="M1 1H53L27 39Z"/></svg>';
export const SVG_UP = '<svg class="more" viewBox="0 0 54 40" width="54" height="40" aria-hidden="true"><path d="M1 39H53L27 1Z"/></svg>';
export const SVG_CARD = '<svg class="mcicon" viewBox="0 0 62 64" width="62" height="64" aria-hidden="true"><path d="M3 5Q3 1 7 1H55Q59 1 59 5V58Q59 63 54 63H8Q3 63 3 58Z" fill="#0b0b0c" stroke="#2a2a2e" stroke-width="1.5"/><path d="M22 6H40L37 10H25Z" fill="#26262a"/><rect x="9" y="30" width="44" height="18" rx="2" fill="#141416" stroke="#232326"/><rect x="7" y="53" width="48" height="6" rx="2" fill="#18181b"/></svg>';
