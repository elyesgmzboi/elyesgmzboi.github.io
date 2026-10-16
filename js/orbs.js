// The seven orbs, moved the way OSDSYS moves them (aap/osdbits: docs/menu-scene.md 10, osdbits/menu.c 0x2261B8,
// 0x226360, 0x22EFF0). They are a clock too:
//   per orb i: RotZ(hour tilt) RotY(ring spin) RotZ(180) RotY(1100 x minute angle) RotX((i + 21) x second angle)
//              Translate(0, radius, 0)
// so the ring tumbles about once every 3.3 s, each orb laps it 21..27 times a minute (they shear apart and bunch up
// again on a one-minute cycle), and the radius eases from 10 toward 10 + 7.25 * minutes/60 (it grows over the hour).
// Each orb leaves a 50-sample trail (one sample every 3 frames) that fades to blue. The menu's fade-up throws them out
// along random phases by half a screen and lerps their colours from their own (blue, green, cyan, red, magenta,
// orange, white) to the shared dim blue.
import * as THREE from 'three';
import { orbCoreTex, orbHaloTex } from './tex.js';
import { osd } from './osdclock.js';
import { romCamera, FX, FY } from './cfgworld.js';

const N = 7, TRAIL = 50, TRAIL_DRAW = 49;
const A = (a) => a * Math.PI * 2 / 65536;
const s16 = (a) => ((Math.round(a) + 32768) % 65536 + 65536) % 65536 - 32768;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (x) => x * x * (3 - 2 * x);
const BASE = [0x30, 0x62, 0x80];                      // 0x27EB30, every orb in the idle menu
const OWN = [[0, 0, 128], [0, 128, 0], [0, 128, 128], [128, 0, 0], [128, 0, 0x44], [128, 0x44, 0], [128, 128, 128]];   // 0x27EB40

export class Orbs {
  constructor(scene) {
    this.group = new THREE.Group(); scene.add(this.group);
    const halo = orbHaloTex(), core = orbCoreTex();
    this.sprites = []; this.halos = [];
    for (let i = 0; i < N; i++) {
      const hm = new THREE.SpriteMaterial({ map: halo, color: 0xffffff, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true });
      const h = new THREE.Sprite(hm); h.renderOrder = 2; this.group.add(h); this.halos.push(h);
      const m = new THREE.SpriteMaterial({ map: core, color: 0xffffff, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true });
      const s = new THREE.Sprite(m); s.renderOrder = 3; this.group.add(s); this.sprites.push(s);
    }
    // trails: one ribbon per orb (the ROM draws an antialiased one-pixel line strip, i.e. ~2 px here)
    this.trailGeo = new THREE.BufferGeometry();
    this.trailPos = new Float32Array(N * TRAIL_DRAW * 2 * 3);
    this.trailCol = new Float32Array(N * TRAIL_DRAW * 2 * 3);
    const idx = [];
    for (let i = 0; i < N; i++) for (let k = 0; k < TRAIL_DRAW - 1; k++) {
      const a = (i * TRAIL_DRAW + k) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.trailGeo.setIndex(idx);
    this.trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.trailGeo.setAttribute('color', new THREE.BufferAttribute(this.trailCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.trail = new THREE.Mesh(this.trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide }));
    this.trail.frustumCulled = false; this.trail.renderOrder = 1; this.group.add(this.trail);

    // layout the screens ask for (x, y: where the ring centre sits; zoom: extra scale about it)
    this.cur = { x: 594, y: 522, zoom: 1, size: 144, bright: 1, merge: 0, scatter: 1, alpha: 0 };
    this.tgt = { ...this.cur };
    this.rate = 3;
    this.mode = 'menu';
    // ROM state
    this.ease = 0;                 // gp-28848: the radius ease, 0 -> minutes/60 at 0.005 per frame
    this.scale = 1; this.scaleTarget = 1;   // 0x27B440: the Clock Adjustment editor sinks the orbs into the centre
    this.tiltZ = s16(osd.hours() * 65536 / 12); this.spinY = s16(osd.seconds() * 65536 / 60);
    this.camZ = 0;                 // gp-28880: the camera fly-in, decays x0.97 per frame
    this.fromOpening = true;       // the full seven-orb fly-in happens only after the boot animation
    let seed = 1;
    const rand = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed & 0x7FFFFFFF; };
    this.phase = Array.from({ length: N }, () => rand() % 65536);
    this.hist = Array.from({ length: N }, () => ({ head: 0, sub: 0, wrapped: false, pts: Array.from({ length: TRAIL }, () => ({ x: 0, y: 0, z: 0, c: [0, 0, 0] })) }));
    this.now = Array.from({ length: N }, () => ({ x: 0, y: 0, z: 103, c: BASE }));
    window.__orbs = this;
  }

  set(target, rate = 3) { target = { ...target }; if (target.mode) { this.mode = target.mode; delete target.mode; } for (const k of ['r', 'tilt']) delete target[k]; Object.assign(this.tgt, target); this.rate = rate; }
  jump(target) { target = { ...target }; delete target.mode; for (const k of ['r', 'tilt']) delete target[k]; Object.assign(this.tgt, target); Object.assign(this.cur, target); }
  // the boot's fly-in: the camera starts 100 units back and the orbs start scattered
  flyIn() { this.camZ = -100; this.fromOpening = true; for (const h of this.hist) { h.head = 0; h.sub = 0; h.wrapped = false; } }

  // jump the eased ROM state to where it settles (test hook: compare against captures at a known clock time)
  settle() {
    this.ease = osd.minutes() / 60; this.spinY = s16(osd.seconds() * 65536 / 60); this.tiltZ = s16(osd.hours() * 65536 / 12);
    this.camZ = 0; this.scale = this.scaleTarget; this.tick();
  }

  // one OSD frame
  tick() {
    const sec = osd.seconds(), min = osd.minutes(), hrs = osd.hours();
    // 0x225628: tilt and spin eased toward the live clock (tilt snaps while the spin is near zero)
    const tTarget = s16(hrs * 65536 / 12), sTarget = s16(sec * 65536 / 60);
    this.spinY = s16(this.spinY + s16(sTarget - this.spinY) * 0.1);
    this.tiltZ = Math.abs(this.spinY) < 201 ? tTarget : s16(this.tiltZ + s16(tTarget - this.tiltZ) * 0.1);
    this.scale += (this.scaleTarget - this.scale) * 0.1;
    this.camZ *= 0.97;
    const radius = (this.ease * 7.25 + 10) * this.scale;
    this.ease += (min / 60 - this.ease) * 0.005;
    const rateX = sec * 65536 / 60, rateY = min * 65536 / 60;
    const cam = romCamera(this.camZ).elements;
    const o = [cam[12], cam[13], cam[14]];                 // the world origin in camera space
    const c = this.cur, merge = 1 - 0.93 * c.merge;
    const f = ease(Math.max(0, Math.min(1, c.scatter)));   // the fade-up: 0 scattered .. 1 home
    const amp = 1 - Math.sin(f * Math.PI / 2);
    for (let i = 0; i < N; i++) {
      const a = A(s16((i + 21) * rateX)), b = A(s16(rateY * 1100));
      // RotX(a) RotY(b) on (0, r, 0), then RotZ(180), RotY(spinY), RotZ(tiltZ)
      let x = radius * Math.sin(a) * Math.sin(b), y = radius * Math.cos(a), z = radius * Math.sin(a) * Math.cos(b);
      x = -x; y = -y;
      const sy = A(this.spinY), cz = A(this.tiltZ);
      [x, z] = [x * Math.cos(sy) + z * Math.sin(sy), -x * Math.sin(sy) + z * Math.cos(sy)];
      [x, y] = [x * Math.cos(cz) - y * Math.sin(cz), x * Math.sin(cz) + y * Math.cos(cz)];
      x *= merge; y *= merge; z *= merge;
      const X = cam[0] * x + cam[4] * y + cam[8] * z + o[0], Y = cam[1] * x + cam[5] * y + cam[9] * z + o[1], Z = cam[2] * x + cam[6] * y + cam[10] * z + o[2];
      // screen position relative to where the ring centre projects, so the screens can place the ring
      let px = FX * (X / Z - o[0] / o[2]), py = FY * (Y / Z - o[1] / o[2]);
      if (amp > 0.001 && (this.fromOpening || i === 0)) { px += 720 * Math.cos(A(this.phase[i])) * amp; py += 540 * Math.sin(A(this.phase[i])) * amp; }
      const col = BASE.map((v, k) => lerp(OWN[i][k], v, f));
      this.now[i] = { x: px, y: py, z: Z, c: col };
      // 0x22FEC0: write the sample, advance the head every third frame
      const h = this.hist[i], p = h.pts[h.head];
      p.x = px; p.y = py; p.z = Z; p.c = col;
      if (++h.sub === 3) {
        h.sub = 0;
        const q = h.pts[h.head];
        if (++h.head === TRAIL) { h.head = 0; h.wrapped = true; }
        const r = h.pts[h.head]; r.x = q.x; r.y = q.y; r.z = q.z; r.c = q.c;
      }
    }
  }

  update(dt) {
    const c = this.cur, g = this.tgt, k = 1 - Math.exp(-dt * this.rate);
    for (const key in g) c[key] = lerp(c[key], g[key], key === 'alpha' ? Math.min(1, k * 1.4) : k);
    this.group.visible = c.alpha > 0.003;
    if (!this.group.visible) return;
    const zr = 103 - this.camZ;                          // the ring's depth when the camera is at rest
    for (let i = 0; i < N; i++) {
      const n = this.now[i], s = this.sprites[i], h = this.halos[i];
      const size = c.size * (103 / n.z) * c.zoom * (zr / 103);
      for (const sp of [s, h]) { sp.position.set(c.x + n.x * c.zoom, -(c.y + n.y * c.zoom), 0); sp.scale.set(size, size * 1.07, 1); }
      // halo = the orb's colour x 255/128 at alpha 0x3C (MODULATE, additive): the shared blue peaks at (45,91,120)
      const k = 255 / 128 * (0x3C / 128) / 255;
      h.material.color.setRGB(...n.c.map((v) => Math.min(1, v * k) ** 2.2));
      h.material.opacity = c.alpha * c.bright;
      s.material.opacity = c.alpha * c.bright;
    }
    // trails: sample k back is (head + 100 - k) % 50, faded f = 128 - 3k; b f, g f^2, r f^4 (reddens out first)
    const P = this.trailPos, C = this.trailCol;
    for (let i = 0; i < N; i++) {
      const h = this.hist[i];
      for (let k = 0; k < TRAIL_DRAW; k++) {
        let idx, f;
        if (h.wrapped) { idx = (h.head + 100 - k) % TRAIL; f = Math.max(0, 128 - 3 * k); }
        else { const nS = Math.max(1, h.head - 1); idx = Math.max(0, h.head - Math.min(k, nS)); f = Math.max(0, 128 - Math.floor(k * TRAIL / nS) * 3); if (k > nS) f = 0; }
        const p = h.pts[idx], nx = h.pts[(idx + TRAIL - 1) % TRAIL];
        const x = c.x + p.x * c.zoom, y = c.y + p.y * c.zoom;
        // ribbon normal: one GS pixel wide (2.25 px across, one field line = 4.8 px down)
        let dx = (nx.x - p.x), dy = (nx.y - p.y); const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
        const ox = -dy * 1.1, oy = dx * 2.4;
        const a = (i * TRAIL_DRAW + k) * 2;
        P[a * 3] = x + ox; P[a * 3 + 1] = -(y + oy); P[a * 3 + 2] = 0;
        P[a * 3 + 3] = x - ox; P[a * 3 + 4] = -(y - oy); P[a * 3 + 5] = 0;
        const cc = p.c, u = f / 128;
        // display-referred values -> linear light (the stage re-encodes)
        const bl = ((cc[2] * u) / 255) ** 2.2, gr = ((cc[1] * u * u) / 255) ** 2.2, rd = ((cc[0] * u * u * u * u) / 255) ** 2.2;
        const al = c.alpha * c.bright * 0.55 * (h.wrapped || k < h.head ? 1 : 0);
        for (const j of [a, a + 1]) { C[j * 3] = rd * al; C[j * 3 + 1] = gr * al; C[j * 3 + 2] = bl * al; }
      }
    }
    this.trailGeo.attributes.position.needsUpdate = true; this.trailGeo.attributes.color.needsUpdate = true;
  }
}
