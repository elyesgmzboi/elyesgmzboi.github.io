// System Configuration: the crystal clock, the five glass cubes, the tunnel, and the settings carousel.
//
// The 3D stage is drawn the way OSDSYS draws it (cfgworld.js, from the aap/osdbits ROM reverse engineering). What
// the ROM notes leave open was measured from a console capture (4:3, 1440x1080 interface px):
//  - the clock's placement: twelve rods seen from 1223 px, turned about the lit hour rod, the whole clock tilted
//    6.3 degrees (hour end away); centre (588,513) in the list, (603,538.5) in Display mode, where it matches the ROM
//    camera exactly. Fitted to rod axes on 27 frames, median error 1-1.7 px (_scratch/ps2ref/fitjoint.py).
//  - the turn itself is the ROM's: the ring's spin eases toward the OSD clock's second hand (6 deg per second).
//    The console only manages ~50 fps on this screen while the cubes are up, so frame-based animations run at 5/6
//    speed there; the displayed clock remains tied to wall time.
//  - the unlit rods' body colour cycles teal -> blue -> indigo (ROM keyframe tables not decoded; 1275 frames).
import * as THREE from 'three';
import { CfgWorld, ROD, ROD_N, ROD_UV, CUBE, CUBE_N, CUBE_POS, FX, FY } from './cfgworld.js';
import { Screen } from './screen.js';
import { el, tx, place, hints, measure, SVG_UPDOWN, SVG_SUN } from './ui.js';
import { t, LANGS, langName } from './i18n.js';
import { S, save, clockNow, clockNowFrom, realMs, fmtDate, fmtTime, pad, TIMEZONES, summerOn, tzLabel, dstNow } from './settings.js';
import { sfx, bed, applyMute } from './audio.js';
import { osd } from './osdclock.js';
import { ZoomBlur } from './gsfx.js';

const DIST = 1223;            // camera to clock centre; one world unit is one interface pixel at the clock
const FOV = THREE.MathUtils.radToDeg(2 * Math.atan(540 / DIST));   // vertical field of view of the 4:3 picture
const UNIT = DIST / 103;      // world units per ROM unit (the ROM camera sits 103 units from the ring)
const ROD_SCALE = 533 / 46.39; // the rod model (0..26.39 above a ring of radius 20) scaled so its tip lands on r 533
// fixed tilt of the clock plane: 6.31 degrees about an axis 25.3 degrees anticlockwise from 12 o'clock
const TILT_AXIS = new THREE.Vector3(-Math.sin(THREE.MathUtils.degToRad(25.3)), Math.cos(THREE.MathUtils.degToRad(25.3)), 0);
const TILT = THREE.MathUtils.degToRad(6.31);
const HOME = { x: 603, y: 538.5 };   // the ROM camera's ring centre; the zoom blur shows it at (588,513) in the list
const HUE_P = 1275;           // frames per teal -> indigo -> teal cycle
// unlit rod body colours along the cycle (0x27EAC0 is the teal; the other two keep the measured hue ratios)
const BODY = { teal: [47, 100, 108], blue: [45, 72, 104], indigo: [56, 62, 104] };
const FRONT_LOW = [167, 217, 255];   // 0x34E940, the lit rod's bright piece

// test hooks: ?theta=deg&hue=s&freeze pins the clock for side-by-side comparisons with captures
const Q = new URLSearchParams(location.search);
const DBG = { theta: Q.get('theta'), hue: Q.get('hue'), freeze: Q.has('freeze') };

const ease = (x) => x * x * (3 - 2 * x);
const easeOut = (x) => 1 - (1 - x) * (1 - x);
const easeOut3 = (x) => 1 - Math.pow(1 - x, 3);
const easeIn = (x) => x * x;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const seg = (x, a, b) => clamp01((x - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const s16 = (a) => ((Math.round(a) + 32768) % 65536 + 65536) % 65536 - 32768;

// ---------------------------------------------------------------- world
export class ConfigWorld extends CfgWorld {
  constructor(stage, app) {
    super(stage, app);
    this.camera.near = 20; this.camera.far = 60000;
    // clock: place (position, zoom) -> lean (fixed tilt of the clock plane) -> spin (about the hour rod)
    this.place = new THREE.Group(); this.lean = new THREE.Group(); this.spin = new THREE.Group();
    this.place.add(this.lean); this.lean.add(this.spin); this.scene.add(this.place);

    this.theta = THREE.MathUtils.degToRad(DBG.theta != null ? +DBG.theta : 0);
    this.hueF = DBG.hue != null ? +DBG.hue * 50 : 0;   // frames on the hue cycle (teal at 790)
    this.disp = 0; this.dispTarget = 0;          // 0 list, 1 Display mode
    this.phase = 'idle'; this.pt = 0;            // 'in' | 'out' | 'idle' | 'gone'
    this.cubesT = 1; this.cubesTarget = 1;       // the cube timer's progress, 0..1 over 40 frames
    this.clockVis = 0; this.zoom = 1; this.bgFade = 0;
    this.spinY = 0; this.split = 0;              // the ring's eased spin (16-bit angle) and the lit rod's fill
    this.centre = { ...HOME };
    this.blurPhase = 10;                         // gp-28844: 10 = idle (five blur passes), 0 = Display mode (none)
    // the menu vignette (0x27F620 / 0x22AF10): black outside an ellipse round the menu centre, 80 frames each way.
    // Leaving opens it, entering again lifts it
    this.vig = 0; this.vigDir = 0;
    this.outF = 0;                               // frames since the leave (the closing Anim counts them down from 90)
    this.zb = new ZoomBlur();
    // test hook: pose everything as the capture at video time t (clock fit: theta = -4.923 (t - 27.21), entry at 12.7)
    window.__cfgAt = (t, ct) => {
      this.theta = THREE.MathUtils.degToRad(-4.923 * (t - 27.21)); this.hueF = (t - 12.7) * 50;
      if (ct != null) this.cubeSpin = Math.round(ct * 50 * 30) & 0xFFFF;
      // settle the cube colours: the cursor's cube on the menu's blue-cyan, the rest on grey 100
      this.cubeTracker = [0, 150, 200]; this.cubeCol = this.cubeCol.map((c, i) => (i === this.cursor ? [0, 150, 200] : [100, 100, 100]));
    };
    window.__cfgTune = (o) => Object.assign(this.tune || (this.tune = {}), o);
    this.tmpV = new THREE.Vector3();
  }

  // entry from the main menu: the clock grows out of the orbs, then the tunnel, then the cubes
  enter() { this.phase = 'in'; this.pt = 0; this.cubesT = 0; this.cubesTarget = 0; this.clockVis = 0; this.zoom = 0.32; this.bgFade = 0; this.dispTarget = 0; this.vigDir = -1; }
  leave() { this.phase = 'out'; this.pt = 0; this.outF = 0; }
  display(on) { this.dispTarget = on ? 1 : 0; this.cubesTarget = on ? 0 : 1; }
  get done() { return this.phase === 'gone'; }
  setCursor(i) { this.cursor = i; }

  osdNow() { return osd.now(); }

  // one OSD frame (the app steps the shared frame loop, osdclock.js)
  tick() {
    super.tick();
    this.hueF++;
    // the blur ramp: Display mode takes it from 10 to 0 over ten frames and back
    this.blurPhase = Math.max(0, Math.min(10, this.blurPhase + (this.dispTarget > 0.5 ? -1 : 1)));
    // the cube timer: 40 frames each way
    if (this.cubesT < this.cubesTarget) this.cubesT = Math.min(this.cubesTarget, this.cubesT + 1 / 40);
    else if (this.cubesT > this.cubesTarget) this.cubesT = Math.max(this.cubesTarget, this.cubesT - 1 / 40);
    // 0x225628: the ring's spin eases toward the second hand; the lit rod's split grows toward 1 - minutes/60
    const c = osd.now();
    const target = s16(osd.seconds() * 65536 / 60);
    this.spinY = s16(this.spinY + s16(target - this.spinY) * 0.1);
    const splitMax = 1 - c.mi / 60;
    this.split = this.split < splitMax ? Math.min(splitMax, this.split + 0.004) : splitMax;
    if (!DBG.freeze) this.theta = -this.spinY * Math.PI * 2 / 65536;
    // the closing state machine (0x227390), on the Anim's 90-frame close: the cube timer and the vignette open at
    // frame 10, the backdrop fade closes at frame 50 (40 frames), the carousel at frame 89 - rods gone in one frame
    if (this.phase === 'out') {
      this.outF++;
      if (this.outF === 10) { this.cubesTarget = 0; this.vigDir = 1; }
    }
    this.vig = Math.max(0, Math.min(1, this.vig + this.vigDir / 80));
  }

  update(dt, time) {
    const st = this.stage, cam = this.camera;
    st.fitCamera(cam, FOV);
    // the console's frame rate on this screen: ~50 fps while the cubes are up, 60 without them
    osd.rate = DBG.freeze ? 0 : this.cubesT > 0.001 || this.cubesTarget > 0 ? 50 : 60;
    this.disp += (this.dispTarget - this.disp) * (1 - Math.exp(-dt * 2.6));

    // transitions (measured from the capture)
    this.pt += dt;
    const sp = this.app.speed || 1;
    const T = this.pt / sp;
    this.bg40 = null;
    if (this.phase === 'in') {
      this.clockVis = easeOut(seg(T, 0.1, 0.6));
      this.zoom = lerp(0.32, 1, easeOut3(seg(T, 0.1, 0.75)));
      this.bgFade = ease(seg(T, 0.7, 1.35));
      if (T > 0.8) this.cubesTarget = this.dispTarget ? 0 : 1;
      if (T > 1.6) this.phase = 'idle';
    } else if (this.phase === 'out') {
      // the rods keep their full size and colour to the end; what fades the crystal clock is the backdrop it
      // refracts going dark. On the capture the whole backdrop dims linearly from the 15th frame after the press
      // over ~108 frames (fitted to about 1 grey level together with the vignette; the ROM notes do not have this
      // fade), the vignette closes in from frame 10, and the backdrop timer drops its +40 from frame 50. The tunnel
      // goes with that timer (frame 90), the carousel a frame before - rods gone in one frame (0x225B68).
      const F = this.outF;
      this.bgFade = F < 90 ? 1 - Math.min(1, Math.max(0, (F - 15) / 108)) : 0;
      this.bg40 = 1 - Math.min(1, Math.max(0, (F - 50) / 40));
      this.clockVis = F < 89 ? 1 : 0;
      this.zoom = 1;
      if (F >= 90) this.phase = 'gone';
    } else if (this.phase === 'idle') { this.clockVis = 1; this.zoom = 1; this.bgFade = 1; }
    if (DBG.freeze && this.phase === 'idle') this.cubesT = this.cubesTarget;

    // clock placement
    const cx = HOME.x, cy = HOME.y;
    this.centre = { x: cx, y: cy };
    const c = st.toWorld(cam, cx, cy, DIST);
    this.place.position.copy(c);
    this.place.quaternion.copy(cam.quaternion);
    this.place.scale.setScalar(this.zoom);
    const now = this.osdNow();
    this.h12 = now.h % 12;
    const ha = this.h12 * Math.PI / 6;
    const axis = this.tmpV.set(Math.sin(ha), Math.cos(ha), 0);
    this.lean.quaternion.setFromAxisAngle(TILT_AXIS, TILT);
    this.spin.quaternion.setFromAxisAngle(axis, this.theta);
    this.place.updateMatrixWorld(true);
  }

  // unlit rod body colour on the teal -> blue -> indigo cycle
  body() {
    const w = 0.5 + 0.5 * Math.cos(2 * Math.PI * (this.hueF - 790) / HUE_P);
    const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
    return w > 0.5 ? mix(BODY.blue, BODY.teal, (w - 0.5) * 2) : mix(BODY.indigo, BODY.blue, w * 2);
  }

  // the glass pieces of ring slot k (0 = 12 o'clock)
  rodPieces(k, extra) {
    const cam = this.camera, V = cam.matrixWorldInverse, P = cam.projectionMatrix;
    const a = k * Math.PI / 6;
    // ROM: ... RotZ(slot) Translate(0, 20, 0) RotY(4 * spinY) - every rod also turns about itself at 4x the ring
    const local = new THREE.Matrix4().makeRotationZ(-a)
      .multiply(new THREE.Matrix4().makeTranslation(0, 20 * ROD_SCALE, 0))
      .multiply(new THREE.Matrix4().makeScale(ROD_SCALE, ROD_SCALE, ROD_SCALE))
      .multiply(new THREE.Matrix4().makeRotationY(-4 * this.theta));
    const M = new THREE.Matrix4().multiplyMatrices(this.spin.matrixWorld, local);
    const MV = new THREE.Matrix4().multiplyMatrices(V, M);
    const NM = new THREE.Matrix3().getNormalMatrix(MV);
    const toPx = (vv) => {
      const cl = new THREE.Vector4(vv.x, vv.y, vv.z, 1).applyMatrix4(P);
      return [(cl.x / cl.w - this.nax) / this.nbx, (cl.y / cl.w - this.nay) / this.nby];
    };
    const o = new THREE.Vector3(0, 0, 0).applyMatrix4(MV);
    const [ox, oy] = toPx(o);
    const mk = (ys, yo) => (v) => {
      const vv = new THREE.Vector3(v.x, v.y * ys + yo, v.z).applyMatrix4(MV);
      const [dx, dy] = toPx(vv);
      return { cam: new THREE.Vector3(vv.x / UNIT, -vv.y / UNIT, -vv.z / UNIT), dx, dy, z: -vv.z / UNIT };
    };
    const nf = (n) => { const m = n.clone().applyMatrix3(NM).normalize(); return new THREE.Vector3(m.x, -m.y, -m.z); };
    const body = this.body();
    const ref = { x: (ox - 720) * 0.9, y: (oy - 540) * 0.9 };
    const ph = k * 0.1;
    if (k !== this.h12) return { ref, depth: -o.z, pieces: [{ faces: ROD, normals: ROD_N, uv: ROD_UV, phase: ph, xf: mk(1, 0), nf, col: body, size: 160, extra }] };
    // the front rod is split along its length: a bright lower piece growing toward 1 - minutes/60, and the rest
    const sp = this.split, front = body.map((v, i) => Math.floor((v + FRONT_LOW[i]) / 2));
    return { ref, depth: -o.z, pieces: [
      { faces: ROD, normals: ROD_N, uv: ROD_UV, phase: ph, xf: mk(sp, 0), nf, col: FRONT_LOW, size: 100, extra, mask: (i) => i >= 8 },
      { faces: ROD, normals: ROD_N, uv: ROD_UV, phase: ph, vofs: 2 * sp, xf: mk(1 - sp, 26 * sp), nf, col: front, size: 200, extra, mask: (i) => i !== 8 && i !== 9 },
    ] };
  }

  // one config cube, in the ROM's identity-camera space
  cubePieces(i) {
    const s = Math.max(0, this.cubesT + this.cubeBias[i]);
    const ang = s16(this.cubeSpin + i * 7000) * Math.PI * 2 / 65536;
    const [px, py, pz] = CUBE_POS[i];
    const M = new THREE.Matrix4().makeTranslation(px, py, pz)
      .multiply(new THREE.Matrix4().makeRotationX(ang)).multiply(new THREE.Matrix4().makeRotationY(ang)).multiply(new THREE.Matrix4().makeRotationZ(ang))
      .multiply(new THREE.Matrix4().makeScale(s, s, s));
    const R3 = new THREE.Matrix3().setFromMatrix4(M);
    const xf = (v) => { const c = v.clone().applyMatrix4(M); return { cam: c, dx: 720 + FX * c.x / c.z, dy: 540 + FY * c.y / c.z, z: c.z }; };
    const nf = (n) => n.clone().applyMatrix3(R3).normalize();
    const ref = { x: FX * px / pz * 0.35, y: FY * py / pz * 0.35 };
    return { ref, s, pieces: [{ faces: CUBE, normals: CUBE_N, xf, nf, col: this.cubeCol[i].slice(), size: 200, extra: 0 }] };
  }

  cubeAt(x, y) {
    let hit = -1, nearest = Infinity;
    for (let i = 0; i < CUBE_POS.length; i++) {
      const s = Math.max(0, this.cubesT + this.cubeBias[i]);
      if (s < 0.2) continue;
      const ang = s16(this.cubeSpin + i * 7000) * Math.PI * 2 / 65536;
      const [px, py, pz] = CUBE_POS[i];
      const M = new THREE.Matrix4().makeTranslation(px, py, pz)
        .multiply(new THREE.Matrix4().makeRotationX(ang)).multiply(new THREE.Matrix4().makeRotationY(ang)).multiply(new THREE.Matrix4().makeRotationZ(ang))
        .multiply(new THREE.Matrix4().makeScale(s, s, s));
      const points = [];
      for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) {
        const p = new THREE.Vector3(a * 2.64, b * 2.64, c * 2.64).applyMatrix4(M);
        points.push([720 + FX * p.x / p.z, 540 + FY * p.y / p.z]);
      }
      points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lower = [], upper = [];
      for (const p of points) {
        while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
        lower.push(p);
      }
      for (const p of points.slice().reverse()) {
        while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
        upper.push(p);
      }
      const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
      let inside = false;
      for (let j = 0, k = hull.length - 1; j < hull.length; k = j++) {
        const [xi, yi] = hull[j], [xk, yk] = hull[k];
        if ((yi > y) !== (yk > y) && x < (xk - xi) * (y - yi) / (yk - yi) + xi) inside = !inside;
      }
      if (inside) {
        const d = (x - (720 + FX * px / pz)) ** 2 + (y - (540 + FY * py / pz)) ** 2;
        if (d < nearest) { hit = i; nearest = d; }
      }
    }
    return hit;
  }

  render(r, target) {
    const w = target.width, h = target.height;
    for (const t of [this.S, this.W3, this.W4, this.O]) if (t.width !== w || t.height !== h) t.setSize(w, h);
    this.mapNDC();
    this.camera.updateMatrixWorld();
    const tune = this.tune || {};
    r.setClearColor(0x000000, 1);
    // 1 - the tunnel, copied off twice un-tinted, then written back tinted (0x21D0A0)
    this.buildTunnel({ x: 0, y: 0 });
    // on the way in the tunnel itself fades up (the glass stays dark until it has something to refract)
    this.tunMat.uniforms.uFade.value = this.bgFade;
    r.setRenderTarget(this.S); r.clear(); r.render(this.tunScene, this.fsCam);
    this.fs(r, this.W3, this.mCopy, { uT: this.S.texture });
    this.fs(r, this.W4, this.mCopy, { uT: this.S.texture });
    this.fs(r, this.S, this.mTint, { uT: this.W3.texture });
    if (tune.stop === 'backdrop') { this.fs(r, target, this.mOut, { uT: (tune.show === 'W3' ? this.W3 : this.S).texture, uK: 1 }); return; }
    // 2 - the orbs, into the screen and into work buffer 3
    r.setRenderTarget(this.O); r.setClearColor(0x000000, 0); r.clear(); r.render(this.app.overlay, this.stage.overCam); r.setClearColor(0x000000, 1);
    this.fs(r, this.S, this.mOrbs, { uT: this.O.texture });
    this.fs(r, this.W3, this.mOrbs, { uT: this.O.texture });
    // 3 - the ring, far to near: far glass refracting wb3 into wb4, near glass refracting wb4 onto the screen, and the
    //     same near faces washed out (extra 255) into wb3 for the rods after it
    if (this.clockVis > 0.001) {
      const rods = [];
      for (let k = 0; k < 12; k++) rods.push({ k, ...this.rodPieces(k, 0) });
      rods.sort((a, b) => b.depth - a.depth);
      for (const rd of rods) {
        this.buildGlass(rd.pieces, rd.ref, 'refr');
        this.drawGlass(r, this.W4, this.W3.texture, 0, 0);
        this.drawGlass(r, this.S, this.W4.texture, 1, 0);
        for (const pc of rd.pieces) pc.extra = 255;
        this.buildGlass(rd.pieces, rd.ref, 'refr');
        this.drawGlass(r, this.W3, this.W4.texture, 1, 0);
      }
      // 4 - the deferred bloom: every rod env-mapped into a cleared wb4, added over the screen at 30/128, twice
      r.setRenderTarget(this.W4); r.clear();
      for (const rd of rods) {
        for (const pc of rd.pieces) pc.col = [0x3C, 0x3C, 0x3C];
        this.buildGlass(rd.pieces, rd.ref, 'bloom');
        this.drawGlass(r, this.W4, this.flow, 1, 3);
      }
      this.fs(r, this.S, this.mAdd, { uT: this.W4.texture, uK: (tune.bloom != null ? tune.bloom : 30) / 128 });
    }
    // the vignette (0x22AF10), after the object list and before the blur that softens its edge. Its record puts the
    // centre at (266, h/2) GS px and the clear ellipse at 74 x 37 px, opaque from 1.5x out. SceneFlush has reset Z
    // by then, so it lands on the whole scene: on the capture the rods go dark from the outside in with it
    if (this.vig > 0) {
      const u0 = this.uvX(598.5), v0 = this.uvY(540);
      this.mVig.uniforms.uMap.value.set(u0, v0, this.uvX(598.5 + 166.5) - u0, this.uvY(540 - 178.4) - v0);
      this.fs(r, this.S, this.mVig, { uA: Math.floor(this.vig * 128) / 128 });
    }
    // the zoom blur over the 3D layer (orbs, ring, tunnel), before the cubes and the text (0x2283D0)
    const f = this.stage.frame;
    this.zb.render(r, this.S, this.S, Math.max(0, this.blurPhase - 5), this.stage.box.s * w / f.w, this.stage.box.s * h / f.h, THREE.UnsignedByteType, 1);
    // 5 - the cubes: far glass refracting the finished screen into wb4 (plus the far faces' flat colour), near glass
    //     refracting that into wb3; a REFA reflection then masks them back over the screen
    const cubes = [];
    for (let i = 0; i < 5; i++) { const cp = this.cubePieces(i); if (cp.s > 0.002) cubes.push(cp); }
    if (cubes.length) {
      for (const cp of cubes) {
        const own = cp.pieces[0].col;
        if (tune.cubeFar === 'plain') cp.pieces[0].col = [100, 100, 100];
        this.buildGlass(cp.pieces, cp.ref, 'refr');
        this.drawGlass(r, this.W4, this.S.texture, 0, 0);
        cp.pieces[0].col = own;
        this.buildGlass(cp.pieces, cp.ref, 'flat');
        this.drawGlass(r, this.W4, null, 0, 1, 'add');
        this.buildGlass(cp.pieces, cp.ref, 'refr');
        this.drawGlass(r, this.W3, this.W4.texture, 1, 0);
      }
      r.setRenderTarget(this.W4); r.setClearColor(0x000000, 0); r.clear(); r.setClearColor(0x000000, 1);
      for (const cp of cubes) {
        for (const pc of cp.pieces) pc.col = [120, 120, 120];
        this.buildGlass(cp.pieces, cp.ref, 'refl');
        this.drawGlass(r, this.W4, this.refa, 1, 2);
      }
      this.fs(r, this.S, this.mCube, { uA: this.W3.texture, uB: this.W4.texture });
    }
    // 6 - out, as linear light for the stage
    const show = tune.show === 'W3' ? this.W3 : tune.show === 'W4' ? this.W4 : this.S;
    if (tune.lo != null) this.mOut.uniforms.uLo.value.set(...tune.lo.map((v) => v / 255));
    if (tune.gain != null) this.mOut.uniforms.uGain.value.set(...tune.gain);
    this.fs(r, target, this.mOut, { uT: show.texture, uK: 1 });
  }
}

// ---------------------------------------------------------------- screen
// items: key, label key, kind ('clock' | 'row' | 'carousel'), options [[value, html]], setting key
function items() {
  return [
    { id: 'clock', label: 'clock', kind: 'clock' },
    { id: 'screen', label: 'screen', key: 'screen', opts: [['43', '4:3'], ['full', t('full')], ['169', '16:9']] },
    { id: 'optical', label: 'optical', key: 'optical', opts: [['on', t('on')], ['off', t('off')]] },
    { id: 'crt', label: 'crtFilter', key: 'crt', opts: [['off', t('off')], ['on', t('crt')]] },
    { id: 'lang', label: 'lang', key: 'lang', opts: LANGS.map((c) => [c, langName(c)]) },
  ];
}
// the options behind Triangle on Clock Adjustment
function clockItems() {
  return [
    { id: 'clock24', label: 'timeNot', key: 'clock24', opts: [[false, t('h12')], [true, t('h24')]] },
    { id: 'dateFmt', label: 'dateNot', key: 'dateFmt', opts: [['ymd', t('fmtYMD')], ['mdy', t('fmtMDY')], ['dmy', t('fmtDMY')]] },
    { id: 'summer', label: 'summerTime', key: 'summer', opts: [[false, t('winter')], [true, t('summerTime')]] },
    { id: 'tz', label: 'tz', key: 'tz', opts: TIMEZONES.map((z) => [z, z === 'auto' ? t('auto') : tzLabel(z)]) },
  ];
}
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const htmlOf = (s) => esc(s).replace(/\//g, '<i class="sl">/</i>').replace(/:/g, '<i class="co">:</i>');
const ROW_MAX = 640;   // wider option rows turn into a left/right carousel

export class ConfigScreen extends Screen {
  build() {
    const r = this.root; r.innerHTML = '';
    r.classList.add('cfg');
    this.top = el('div', 'layer', null, r);
    this.dateEl = tx(this.top, { x: 56, y: 113, a: 'l', size: 'T' });
    this.sun = el('div', 'cfg-sun', SVG_SUN, this.top);
    this.timeEl = tx(this.top, { x: 1391, y: 113, a: 'r', size: 'T' });
    this.body = el('div', 'layer cfg-body', null, r);
    this.titleEl = tx(this.body, { x: 972, y: 482, a: 'c', size: 'L', cls: 'yl' });
    this.slot = el('div', 'cfg-slot', null, this.body);
    this.ud = el('div', 'cfg-ud', SVG_UPDOWN, this.body);
    this.lArrow = el('div', 'cfg-lr cfg-l', '<svg viewBox="0 0 22 40" width="22" height="40"><path d="M1 20 21 1V39Z"/></svg>', this.body);
    this.rArrow = el('div', 'cfg-lr cfg-r', '<svg viewBox="0 0 22 40" width="22" height="40"><path d="M21 20 1 1V39Z"/></svg>', this.body);
    this.lArrow.dataset.hit = 'left'; this.rArrow.dataset.hit = 'right';
    this.fieldUp = el('div', 'cfg-fa', '<svg viewBox="0 0 26 15" width="26" height="15"><path d="M13 0 26 15H0Z"/></svg>', this.body);
    this.fieldDn = el('div', 'cfg-fa', '<svg viewBox="0 0 26 15" width="26" height="15"><path d="M13 15 26 0H0Z"/></svg>', this.body);
    this.fieldUp.style.top = '614px'; this.fieldDn.style.top = '700px';
    this.hintRow = el('div', 'layer', null, r);
    this.list = this.page === 'clockOpts' ? clockItems() : items();
    this.sel = Math.min(this.sel || 0, this.list.length - 1);
    this.mode = this.mode === 'display' ? 'display' : 'browse';
    this.edit = null;
    this.lastSec = -1;
    this.paintTitle();
    this.showItem(false);
    this.paintHints();
    this.tick(true);
    this.syncMode(true);
  }

  paintTitle() { this.titleEl.innerHTML = this.page === 'clockOpts' ? t('clock') : t('syscfg'); }

  // ---- hints
  paintHints() {
    const row = this.hintRow; row.innerHTML = '';
    const it = this.list[this.sel];
    let list;
    if (this.mode === 'display') list = [['s', 'display']];
    else if (this.edit) list = [['x', 'enter'], ['o', 'back']];
    else {
      list = [];
      if (this.page !== 'clockOpts') list.push(['s', 'display']);
      list.push(['x', 'enter'], ['o', 'back']);
      if (it.id === 'clock' && this.page !== 'clockOpts') list.push(['t', 'options']);
    }
    hints(row, list, (b) => this.app.onButton(b, false, 'mouse'));
  }

  // ---- the value of an item as text
  cur(it) { return it.key === 'summer' ? summerOn() : S[it.key]; }
  valueHtml(it) {
    if (it.kind === 'clock') { const c = clockNow(); return fmtDate(c) + '&nbsp;' + fmtTime(c); }
    const o = it.opts.find((v) => v[0] === this.cur(it)) || it.opts[0];
    return htmlOf(o[1]);
  }

  // ---- item/value pair, crossfading from the previous one
  showItem(fade = true) {
    const it = this.list[this.sel];
    const old = this.pair;
    const pair = el('div', 'cfg-pair', null, this.slot);
    pair.style.opacity = fade ? 0 : 1;
    const label = tx(pair, { x: 972, y: 598, a: 'c', size: 'L', cls: 'cy', html: t(it.label) });
    const value = tx(pair, { x: 972, y: 684, a: 'c', size: 'L', html: this.valueHtml(it) });
    label.dataset.hit = 'item'; value.dataset.hit = 'value';
    this.pair = { el: pair, label, value, it };
    // the item's cube lights up (0x226BB8 eases the cursor's cube to the menu's blue-cyan)
    this.app.worlds.config.setCursor(this.page === 'clockOpts' ? 0 : this.sel);
    if (fade) {
      requestAnimationFrame(() => { pair.style.opacity = 1; });
      if (old) { old.el.style.opacity = 0; setTimeout(() => old.el.remove(), 320); }
    } else if (old) old.el.remove();
    this.paintHints();
  }

  // ---- clock at the top (and in the Clock Adjustment value)
  tick(force) {
    // the header follows wall-clock time even when the console frame loop slows down
    const c = this.app.worlds.config.osdNow();
    if (!force && c.s === this.lastSec) return;
    this.lastSec = c.s;
    this.dateEl.innerHTML = fmtDate(c);
    this.timeEl.innerHTML = fmtTime(c);
    this.sun.style.display = summerOn() ? '' : 'none';
    if (this.pair && this.pair.it.kind === 'clock' && !(this.edit && this.edit.kind === 'clock')) this.pair.value.innerHTML = this.valueHtml(this.pair.it);
  }

  update(dt) {
    this.tick(false);
    const W = this.app.worlds.config;
    if (this.leaving && W.done) { this.leaving = false; }
    // orbs follow the clock
    if (!this.leaving) { this.app.orbs.set({ x: W.centre ? W.centre.x : HOME.x, y: W.centre ? W.centre.y : HOME.y }, 2.2); this.app.orbs.cur.zoom = this.app.orbs.tgt.zoom = W.zoom; }
  }

  // ---- arrows: restart the 2 s pulse from its dark end whenever they (re)appear
  pulse(e, on) {
    e.classList.remove('on');
    if (on) { void e.offsetWidth; e.classList.add('on'); }
  }

  syncMode(now) {
    const disp = this.mode === 'display';
    this.body.classList.toggle('gone', disp);
    const ed = this.edit;
    this.pulse(this.ud, !disp && !ed);
    const car = ed && ed.kind === 'carousel';
    this.pulse(this.lArrow, !!car); this.pulse(this.rArrow, !!car);
    const clk = ed && ed.kind === 'clock';
    this.pulse(this.fieldUp, !!clk); this.pulse(this.fieldDn, !!clk);
    if (this.pair) {
      this.pair.label.classList.toggle('cy', !ed);
      this.pair.value.classList.toggle('cy', !!ed && ed.kind === 'carousel');
    }
  }

  enter(from, arg = {}) {
    const app = this.app, W = app.worlds.config;
    bed('config', 1.8, 0.8, 0.3);     // SNDCLOKS swells in behind the confirm (capture 12.9 -> 14.5)
    this.leaving = false;
    this.page = null; this.mode = 'browse'; this.edit = null;
    if (arg.fromMain || !from) this.sel = this.sel || 0;
    this.build();
    if (from) { from.root.classList.add('quick'); setTimeout(() => from.root.classList.remove('quick'), 400); }
    app.setWorld('config', 0);
    if (arg.instant) { W.phase = 'idle'; W.cubesT = 1; W.cubesTarget = 1; W.clockVis = 1; W.zoom = 1; W.bgFade = 1; }
    else {
      W.enter();
      this.show(false);
      app.lock(1500);
      app.after(1520, () => this.show(true));
    }
    app.orbs.set({ mode: 'menu', x: HOME.x, y: HOME.y, alpha: 1, merge: 0, scatter: 1, bright: 1 }, 2.2);
    return arg.instant ? undefined : 'hold';
  }

  leave(to) {
    const W = this.app.worlds.config;
    if (to && to.id === 'main') { W.leave(); this.leaving = true; this.root.classList.add('quick'); setTimeout(() => this.root.classList.remove('quick'), 400); }
    W.setHover(-1);
    this.app.stage.canvas.style.cursor = '';
    if (this.saved) this.revert();
    this.edit = null;
  }

  // ---- input
  key(b, rep) {
    const app = this.app;
    if (this.mode === 'display') {
      if (b === 's' || b === 'o' || b === 'x') this.displayMode(false);
      return;
    }
    if (this.edit) return this.editKey(b, rep);
    const n = this.list.length;
    if (b === 'up' || b === 'down') {
      this.sel = (this.sel + (b === 'up' ? -1 : 1) + n) % n;
      sfx('cursorV'); this.showItem(true); this.pulse(this.ud, true);
    } else if (b === 'x') {
      sfx('enter'); this.app.worlds.config.kick(this.page === 'clockOpts' ? 0 : this.sel); this.beginEdit();
    } else if (b === 'o') {
      sfx('back');
      if (this.page === 'clockOpts') { this.page = null; this.list = items(); this.sel = 0; this.paintTitle(); this.fadeSwap(); return; }
      app.lock(1700);
      app.go('main', { fromConfig: true });
    } else if (b === 's' && this.page !== 'clockOpts') {
      sfx('dispOn'); this.displayMode(true);
    } else if (b === 't' && this.list[this.sel].id === 'clock' && this.page !== 'clockOpts') {
      sfx('enter'); this.page = 'clockOpts'; this.list = clockItems(); this.sel = 0; this.paintTitle(); this.fadeSwap();
    }
  }

  fadeSwap() {
    this.body.classList.add('swap');
    this.app.lock(260);
    setTimeout(() => { this.showItem(false); this.body.classList.remove('swap'); this.syncMode(); }, 180);
  }

  displayMode(on) {
    const app = this.app, W = app.worlds.config;
    if (on) {
      this.mode = 'display'; W.display(true);
      this.syncMode(); this.paintHints();
      app.lock(600);
    } else {
      sfx('dispOff');
      this.mode = 'browse'; W.display(false);
      this.paintHints();
      this.body.classList.add('gone');
      app.lock(900);
      app.after(900, () => this.syncMode());
    }
  }

  // ---- editing
  beginEdit() {
    const it = this.list[this.sel];
    if (it.kind === 'clock') {
      const c = clockNow();
      this.edit = { kind: 'clock', f: [c.y, c.mo, c.d, c.h, c.mi, c.s], field: 0 };
    } else {
      const idx = Math.max(0, it.opts.findIndex((o) => o[0] === this.cur(it)));
      const wide = measure(it.opts.map((o) => o[1]).join('  '), 64) > ROW_MAX;
      this.edit = { kind: wide ? 'carousel' : 'row', idx, orig: S[it.key] };
      this.saved = { key: it.key, value: S[it.key] };
    }
    this.renderEdit();
    this.syncMode(); this.paintHints();
  }

  renderEdit(dir) {
    const it = this.list[this.sel], ed = this.edit, v = this.pair.value;
    if (ed.kind === 'row') {
      v.innerHTML = it.opts.map((o, i) => `<span class="${i === ed.idx ? 'cy' : 'dimt'}" data-hit="o${i}">${htmlOf(o[1])}</span>`).join(' ');
    } else if (ed.kind === 'carousel') {
      this.slide(htmlOf(it.opts[ed.idx][1]), dir);
    } else {
      const f = ed.f, sp = (i, s) => `<span class="${i === ed.field ? 'cy' : ''}" data-f="${i}">${s}</span>`;
      const dparts = { y: sp(0, f[0]), mo: sp(1, pad(f[1])), d: sp(2, pad(f[2])) };
      const order = S.dateFmt === 'mdy' ? ['mo', 'd', 'y'] : S.dateFmt === 'dmy' ? ['d', 'mo', 'y'] : ['y', 'mo', 'd'];
      const sl = '<i class="sl">/</i>', co = '<i class="co">:</i>';
      let time;
      if (S.clock24) time = sp(3, pad(f[3])) + co + sp(4, pad(f[4])) + co + sp(5, pad(f[5]));
      else time = sp(3, (f[3] < 12 ? 'AM ' : 'PM ') + (f[3] % 12 || 12)) + co + sp(4, pad(f[4])) + co + sp(5, pad(f[5]));
      v.innerHTML = order.map((k) => dparts[k]).join(sl) + '&nbsp;' + time;
      // small arrows over and under the chosen field
      const s = v.querySelector(`[data-f="${ed.field}"]`);
      const w = v.offsetWidth, left = 972 + 2 - w / 2;
      const x = left + s.offsetLeft + s.offsetWidth / 2 - 13;
      this.fieldUp.style.left = this.fieldDn.style.left = x + 'px';
    }
  }

  // Language-style carousel: the new value scrolls in from the side it was asked for
  slide(html, dir) {
    const v = this.pair.value;
    if (!dir) { v.innerHTML = html; v.classList.add('cy'); return; }
    const clip = el('div', 'cfg-clip', null, this.pair.el);
    const a = tx(clip, { x: 972 - 772, y: 684 - 596, a: 'c', size: 'L', cls: 'cy', html: v.innerHTML });
    const b = tx(clip, { x: 972 - 772, y: 684 - 596, a: 'c', size: 'L', cls: 'cy', html });
    const w0 = a.offsetWidth, w1 = b.offsetWidth, d = ((w0 + w1) / 2 + 18) * dir;
    v.innerHTML = html; v.style.opacity = 0;
    for (const e of [a, b]) e.style.transition = 'none';
    a.style.transform = 'translateX(-50%)';
    b.style.transform = `translateX(calc(-50% + ${d}px))`;
    clip.classList.add('moving');
    void clip.offsetWidth;
    for (const e of [a, b]) e.style.transition = 'transform .3s cubic-bezier(.3,.1,.3,1)';
    a.style.transform = `translateX(calc(-50% - ${d}px))`;
    b.style.transform = 'translateX(-50%)';
    clearTimeout(this.slideT);
    this.slideT = setTimeout(() => { clip.remove(); v.style.opacity = ''; }, 320);
  }

  editKey(b) {
    const it = this.list[this.sel], ed = this.edit;
    if (ed.kind === 'clock') {
      if (b === 'left' || b === 'right') { ed.field = (ed.field + (b === 'left' ? 5 : 1)) % 6; sfx('cursor'); this.renderEdit(); }
      else if (b === 'up' || b === 'down') { this.bump(ed, b === 'up' ? 1 : -1); sfx('cursor'); this.renderEdit(); }
      else if (b === 'x') {
        sfx('enter');
        const f = ed.f, real = clockNowFrom(Date.now() - S.clockOffset);
        const want = Date.UTC(f[0], f[1] - 1, f[2], f[3], f[4], f[5]), have = Date.UTC(real.y, real.mo - 1, real.d, real.h, real.mi, real.s);
        S.clockOffset = want - have; save();
        this.endEdit();
      } else if (b === 'o') { sfx('back'); this.endEdit(); }
      return;
    }
    const n = it.opts.length;
    const step = (b === 'left' || b === 'up') ? -1 : (b === 'right' || b === 'down') ? 1 : 0;
    if (step && (ed.kind === 'carousel' ? (b === 'left' || b === 'right') : (b === 'left' || b === 'right'))) {
      const ni = ed.kind === 'carousel' ? (ed.idx + step + n) % n : Math.max(0, Math.min(n - 1, ed.idx + step));
      if (ni === ed.idx) return;
      ed.idx = ni; sfx('cursor');
      this.renderEdit(step);
      this.preview(it.key, it.opts[ni][0]);
    } else if (b === 'x') {
      sfx('enter');
      const val = it.opts[ed.idx][0];
      this.saved = null;
      this.apply(it.key, val);
      this.endEdit();
    } else if (b === 'o') {
      sfx('back');
      this.revert();
      this.endEdit();
    }
  }

  bump(ed, d) {
    const f = ed.f, i = ed.field;
    const lim = [[2000, 2099], [1, 12], [1, 31], [0, 23], [0, 59], [0, 59]];
    if (i === 2) lim[2][1] = new Date(Date.UTC(f[0], f[1], 0)).getUTCDate();
    const [lo, hi] = lim[i];
    f[i] = f[i] + d > hi ? lo : f[i] + d < lo ? hi : f[i] + d;
    const dim = new Date(Date.UTC(f[0], f[1], 0)).getUTCDate();
    if (f[2] > dim) f[2] = dim;
  }

  // live preview while choosing (the console previews Screen Size the same way)
  preview(key, val) {
    if (key === 'screen') { S[key] = val; this.applyLive(key); }
  }
  revert() {
    if (!this.saved) return;
    const { key, value } = this.saved;
    this.saved = null;
    if (S[key] !== value) { S[key] = value; this.applyLive(key); }
  }
  applyLive(key) {
    const app = this.app;
    if (key === 'screen') app.screenChange();
  }
  apply(key, val) {
    const app = this.app;
    const changed = S[key] !== val || key === 'screen';
    S[key] = val; save();
    if (!changed) return;
    if (key === 'optical') applyMute();
    if (key === 'screen') { /* already live */ }
    if (key === 'lang') { app.relocalize(); return; }
    if (key === 'clock24' || key === 'dateFmt' || key === 'summer' || key === 'tz') this.tick(true);
  }

  endEdit() {
    this.edit = null;
    this.showItem(false);
    this.syncMode(); this.paintHints();
  }

  hit(v, kind) {
    if (kind !== 'click') return;
    if (this.mode === 'display') { this.key('s'); return; }
    if (v === 'left' || v === 'right') { this.key(v); return; }
    if (v[0] === 'o' && this.edit && this.edit.kind === 'row') {
      const i = +v.slice(1), ed = this.edit;
      if (i === ed.idx) { this.key('x'); return; }
      const d = i - ed.idx;
      for (let k = 0; k < Math.abs(d); k++) this.key(d < 0 ? 'left' : 'right');
      return;
    }
    if (v === 'item' || v === 'value') { if (!this.edit) this.key('x'); }
  }

  hitCanvas(e) {
    if (!this.root.classList.contains('on') || this.page === 'clockOpts' || this.mode !== 'browse' || this.edit ||
        performance.now() < this.app.lockUntil || this.app.dialog.open) return false;
    const { x, y, s } = this.app.stage.box;
    const i = this.app.worlds.config.cubeAt((e.clientX - x) / s, (e.clientY - y) / s);
    if (i < 0 || i >= this.list.length) return false;
    this.app.worlds.config.setHover(-1);
    if (i !== this.sel) { this.sel = i; sfx('cursorV'); this.showItem(true); }
    return true;
  }

  hoverCanvas(e) {
    const world = this.app.worlds.config;
    const blocked = !e || e.target.closest('[data-hit]') || !this.root.classList.contains('on') ||
      this.page === 'clockOpts' || this.mode !== 'browse' || this.edit ||
      performance.now() < this.app.lockUntil || this.app.dialog.open;
    let i = -1;
    if (!blocked) {
      const { x, y, s } = this.app.stage.box;
      i = world.cubeAt((e.clientX - x) / s, (e.clientY - y) / s);
      if (i >= this.list.length) i = -1;
    }
    world.setHover(i);
    this.app.stage.canvas.style.cursor = i >= 0 ? 'pointer' : '';
  }
}
