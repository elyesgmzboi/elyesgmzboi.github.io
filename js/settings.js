// Persistent console settings, and the system clock they drive.
const KEY = 'saud2.ps2.settings';

export const DEFAULTS = {
  lang: '',            // '' = pick from the browser language on first boot
  screen: 'full',      // '43' | 'full' | '169'
  optical: 'on',       // Digital Out (Optical): sound on/off
  crt: 'off',          // 'off' | 'on'
  clock24: true,
  dateFmt: 'ymd',      // 'ymd' | 'mdy' | 'dmy'
  summer: null,        // Summer Time: null follows the zone's daylight saving, true/false forces it
  tz: 'auto',          // 'auto' or an IANA zone name
  clockOffset: 0,      // ms added by Clock Adjustment
  diag: 'off',         // Diagnosis: frame counter overlay
  discSpeed: 'standard', // 'fast' shortens animations
  texMap: 'smooth',    // 'standard' renders at 640x448
};

export const S = (() => {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
    const settings = { ...DEFAULTS, ...stored };
    if (stored.videoFilter === 'vhs' && stored.crt == null) settings.crt = 'on';
    delete settings.videoFilter;
    return settings;
  }
  catch { return { ...DEFAULTS }; }
})();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode */ }
}

export const TIMEZONES = [
  'auto', 'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles', 'America/Denver', 'America/Chicago',
  'America/New_York', 'America/Sao_Paulo', 'Atlantic/Azores', 'Europe/London', 'Europe/Paris', 'Europe/Athens',
  'Europe/Istanbul', 'Asia/Riyadh', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok',
  'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland',
];

// UTC offset of a zone in minutes (east positive); 'auto' is this computer's zone
const fmtCache = {};
function zoneParts(tz, d) {
  const f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }));
  const p = f.formatToParts(d), g = (ty) => +p.find((x) => x.type === ty).value;
  return { y: g('year'), mo: g('month'), d: g('day'), h: g('hour'), mi: g('minute'), s: g('second') };
}
export function zoneOffset(tz, d = new Date()) {
  if (tz === 'auto') return -d.getTimezoneOffset();
  const c = zoneParts(tz, d);
  return Math.round((Date.UTC(c.y, c.mo - 1, c.d, c.h, c.mi, c.s) - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

// is daylight saving in effect in the configured zone right now (cached for a minute)
let dstCache = { at: 0, tz: null, v: false };
export function dstNow() {
  const now = Date.now();
  if (dstCache.tz === S.tz && now - dstCache.at < 60e3) return dstCache.v;
  let v = false;
  try {
    const y = new Date().getFullYear();
    const a = zoneOffset(S.tz, new Date(y, 0, 1)), b = zoneOffset(S.tz, new Date(y, 6, 1));
    v = a !== b && zoneOffset(S.tz, new Date()) === Math.max(a, b);
  } catch { v = false; }
  dstCache = { at: now, tz: S.tz, v };
  return v;
}
export const summerOn = () => (S.summer == null ? dstNow() : !!S.summer);

// "GMT+01:00 Paris"
export function tzLabel(tz) {
  let o = 0;
  try { o = zoneOffset(tz); } catch { /* unknown zone */ }
  const a = Math.abs(o);
  return `GMT${o < 0 ? '-' : '+'}${pad(Math.floor(a / 60))}:${pad(a % 60)} ${tz.split('/').pop().replace(/_/g, ' ')}`;
}

// Wall-clock fields for a moment in the configured zone, with Clock Adjustment and the Summer Time setting applied.
export function clockNowFrom(ms) {
  const shift = (summerOn() ? 1 : 0) - (dstNow() ? 1 : 0);
  const d = new Date(ms + S.clockOffset + shift * 3600e3);
  if (S.tz !== 'auto') {
    try { return zoneParts(S.tz, d); } catch { /* fall through to local time */ }
  }
  return { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds() };
}
// test hook: ?now=2015-08-17T13:21:54 runs the console clock from that moment
const FAKE = (() => { const v = new URLSearchParams(location.search).get('now'); const t = v ? new Date(v).getTime() : NaN; return Number.isNaN(t) ? 0 : t - Date.now(); })();
export const realMs = () => Date.now() + FAKE;
export const clockNow = () => clockNowFrom(Date.now() + FAKE);

export const pad = (n, w = 2) => String(n).padStart(w, '0');

// Date as the OSD prints it; separators are wrapped so CSS can space them like the PS2 font.
export function fmtDate(c, html = true) {
  const sl = html ? '<i class="sl">/</i>' : '/';
  const [a, b, e] = S.dateFmt === 'mdy' ? [pad(c.mo), pad(c.d), c.y] : S.dateFmt === 'dmy' ? [pad(c.d), pad(c.mo), c.y] : [c.y, pad(c.mo), pad(c.d)];
  return a + sl + b + sl + e;
}

export function fmtTime(c, html = true) {
  const co = html ? '<i class="co">:</i>' : ':';
  if (S.clock24) return pad(c.h) + co + pad(c.mi) + co + pad(c.s);
  const h = c.h % 12 || 12;
  return (c.h < 12 ? 'AM ' : 'PM ') + h + co + pad(c.mi) + co + pad(c.s);
}

export function fmtStamp(str, html = true) {
  // content.js dates are "YYYY/MM/DD HH:MM[:SS]"
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(str || '');
  if (!m) return str || '';
  const c = { y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0) };
  return fmtDate(c, html) + (html ? '&nbsp;' : ' ') + fmtTime(c, html);
}
