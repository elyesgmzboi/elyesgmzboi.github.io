// The menu's always-on "zoom blur" (0x2283D0 -> 0x22C3C0): five bilinear shrink-and-stretch round trips through a
// work buffer over the whole 3D layer, after the scene and before the 2D text. It softens the orbs, rods and tunnel
// and, through its half-texel bookkeeping, moves the whole 3D layer up and left (the ROM notes predict 7.8 x 6.2 GS
// pixels over five passes; the capture shows 15 x 25.5 interface px). Display mode ramps it off over ten frames,
// which is why the clock jumps down-right and sharpens when the list goes away.
// Emulated here as a separable Gaussian with the measured spread plus the measured shift, per pass count.
import * as THREE from 'three';

const VERT = `precision highp float; attribute vec3 position; attribute vec2 uv; varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = `precision highp float; varying vec2 vUv;
uniform sampler2D uT; uniform vec2 uStep, uShift; uniform float uSigma;
void main(){
  vec3 c = vec3(0.0); float w = 0.0;
  for (int i = -12; i <= 12; i++) {
    float x = float(i) * 0.5;                       // half-sigma taps out to 6 sigma
    float k = exp(-0.5 * x * x / 4.0);
    c += texture2D(uT, vUv + uShift + uStep * x * uSigma * 0.5).rgb * k; w += k;
  }
  gl_FragColor = vec4(c / w, 1.0);
}`;

export class ZoomBlur {
  constructor() {
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();
    this.mat = new THREE.RawShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
      uniforms: { uT: { value: null }, uStep: { value: new THREE.Vector2() }, uShift: { value: new THREE.Vector2() }, uSigma: { value: 1 } } });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); this.quad.frustumCulled = false; this.scene.add(this.quad);
    this.tmp = null;
  }
  // blur `src` into `dst` with k of the five passes' worth (k in 0..5). pxX/pxY: target pixels per interface px.
  // `shift` (0..1) is how much of the five passes' up-left drift to apply; it defaults to the blur's own share, and
  // System Configuration pins it at 1 so Display mode only sharpens the picture instead of jumping it down-right.
  render(r, src, dst, k, pxX, pxY, type = THREE.UnsignedByteType, shift = null) {
    const w = dst.width, h = dst.height;
    if (!this.tmp || this.tmp.width !== w || this.tmp.height !== h || this.tmp.texture.type !== type) {
      if (this.tmp) this.tmp.dispose();
      this.tmp = new THREE.WebGLRenderTarget(w, h, { type, depthBuffer: false });
      this.tmp.texture.minFilter = this.tmp.texture.magFilter = THREE.LinearFilter;
    }
    const f = Math.max(0, Math.min(5, k)) / 5, g = shift == null ? f : shift;
    // measured: sigma ~3.5 x 3.5 interface px and a shift of (15, 25.5) px up-left for all five passes
    const sx = Math.sqrt(f) * 3.5, sy = Math.sqrt(f) * 3.5;
    const u = this.mat.uniforms;
    u.uT.value = src.texture; u.uSigma.value = Math.max(0.001, sx * pxX);
    u.uStep.value.set(1 / w, 0); u.uShift.value.set(15 * g * pxX / w, 0);
    r.setRenderTarget(this.tmp); r.render(this.scene, this.cam);
    u.uT.value = this.tmp.texture; u.uSigma.value = Math.max(0.001, sy * pxY);
    u.uStep.value.set(0, 1 / h); u.uShift.value.set(0, -25.5 * g * pxY / h);
    r.setRenderTarget(dst); r.render(this.scene, this.cam);
  }
}
