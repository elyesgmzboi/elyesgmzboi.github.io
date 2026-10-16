// Renderer, picture geometry (Screen Size), the 1440x1080 interface box, and the video output pass.
import * as THREE from 'three';
import { S } from './settings.js';

export const DW = 1440, DH = 1080; // interface design space (a 4:3 capture of the console, in pixels)

const FS_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export class Stage {
  constructor(canvas, ui) {
    this.canvas = canvas; this.ui = ui;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.autoClear = false;
    this.fxCanvas = document.getElementById('fx');
    this.fxRenderer = new THREE.WebGLRenderer({ canvas: this.fxCanvas, antialias: false, alpha: true, premultipliedAlpha: false, powerPreference: 'low-power' });
    this.fxRenderer.setClearColor(0x000000, 0);
    this.fxScene = new THREE.Scene();
    this.fxCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fxMat = new THREE.ShaderMaterial({
      uniforms: { res: { value: new THREE.Vector2(1, 1) }, time: { value: 0 } },
      vertexShader: FS_VERT,
        fragmentShader: `uniform vec2 res; uniform float time; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
        void main(){
          float frame=floor(time*24.0);
          float grain=hash(floor(gl_FragCoord.xy)+vec2(frame));
          float triad=mod(floor(gl_FragCoord.x),3.0);
          vec3 mask=triad<0.5?vec3(0.0,0.035,0.035):triad<1.5?vec3(0.035,0.0,0.035):vec3(0.035,0.035,0.0);
          float scan=0.5+0.5*cos(vUv.y*res.y*3.14159265);
          float roll=exp(-pow((fract(vUv.y-time*0.012)-0.08)*res.y/24.0,2.0));
          float flicker=0.985+0.015*sin(time*47.0);
          float alpha=(0.025+scan*0.065+roll*0.04+step(0.997,grain)*0.012)*flicker;
          gl_FragColor=vec4(mask,alpha);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.fxQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.fxMat);
    this.fxQuad.frustumCulled = false;
    this.fxScene.add(this.fxQuad);
    const rtOpts = { depthBuffer: true, stencilBuffer: false, type: THREE.HalfFloatType, samples: 4 };
    this.rtA = new THREE.WebGLRenderTarget(4, 4, rtOpts);
    this.rtB = new THREE.WebGLRenderTarget(4, 4, rtOpts);
    this.rtM = new THREE.WebGLRenderTarget(4, 4, { ...rtOpts, samples: 0 });
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const tri = new THREE.PlaneGeometry(2, 2);
    this.mixMat = new THREE.ShaderMaterial({
      uniforms: { tA: { value: null }, tB: { value: null }, mixv: { value: 0 }, fade: { value: 1 } },
      vertexShader: FS_VERT,
      fragmentShader: `uniform sampler2D tA,tB; uniform float mixv,fade; varying vec2 vUv;
        void main(){ vec4 a=texture2D(tA,vUv); vec4 b=texture2D(tB,vUv); gl_FragColor=vec4(mix(a.rgb,b.rgb,mixv)*fade,1.0); }`,
      depthTest: false, depthWrite: false,
    });
    this.outMat = new THREE.ShaderMaterial({
      uniforms: { tM: { value: null }, res: { value: new THREE.Vector2(1, 1) }, rgb: { value: 0 }, crt: { value: 0 }, lines: { value: 448 }, time: { value: 0 } },
      vertexShader: FS_VERT,
      fragmentShader: `uniform sampler2D tM; uniform vec2 res; uniform float rgb, crt, lines, time; varying vec2 vUv;
        vec3 lin2srgb(vec3 c){ return mix(c*12.92, 1.055*pow(max(c,0.0),vec3(1.0/2.4))-0.055, step(0.0031308,c)); }
        void main(){
          vec2 uv=vUv;
          vec3 c;
          if(rgb>0.5||crt>0.5){
            vec2 cc=uv-0.5; float r2=dot(cc,cc); uv=0.5+cc*(1.0+0.035*r2);
            vec2 px=1.0/res;
            c.r=texture2D(tM,uv+vec2(px.x*0.9,0.0)).r; c.g=texture2D(tM,uv).g; c.b=texture2D(tM,uv-vec2(px.x*0.9,0.0)).b;
            vec3 glow=(texture2D(tM,uv+vec2(px.x*3.0,0.)).rgb+texture2D(tM,uv-vec2(px.x*3.0,0.)).rgb+texture2D(tM,uv+vec2(0.,px.y*3.)).rgb+texture2D(tM,uv-vec2(0.,px.y*3.)).rgb)*0.25;
            c=c+glow*0.18;
            float l=sin((uv.y*lines)*3.14159265*2.0)*0.5+0.5; c*=mix(1.0,0.72+0.28*l,0.85);
            float mask=0.94+0.06*sin(gl_FragCoord.x*2.094);
            c*=mask*1.12;
            float v=smoothstep(0.62,0.28,length(cc*vec2(1.0,1.1))); c*=mix(0.72,1.0,v);
            if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) c=vec3(0.0);
            if(crt>0.5) c*=0.99+0.01*sin(time*52.0);
          } else c=texture2D(tM,uv).rgb;
          gl_FragColor=vec4(lin2srgb(c),1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(tri, this.mixMat);
    this.quad.frustumCulled = false;
    this.fsScene = new THREE.Scene(); this.fsScene.add(this.quad);
    // overlay layer in interface space (orbs, glows that must survive world crossfades)
    this.overCam = new THREE.OrthographicCamera(0, DW, 0, -DH, -1000, 1000);
    this.frame = { x: 0, y: 0, w: 1, h: 1 };
    this.box = { x: 0, y: 0, s: 1 };
    this.fade = 1;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  get aspect() { return this.frame.w / this.frame.h; }

  resize() {
    const W = innerWidth, H = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(W, H, false);
    this.fxRenderer.setPixelRatio(dpr);
    this.fxRenderer.setSize(W, H, false);
    this.fxMat.uniforms.res.value.set(Math.round(W * dpr), Math.round(H * dpr));
    this.canvas.style.width = W + 'px'; this.canvas.style.height = H + 'px';
    // picture rectangle
    let fw = W, fh = H;
    if (S.screen === '43' || S.screen === '169') {
      const a = S.screen === '43' ? 4 / 3 : 16 / 9;
      if (W / H > a) { fh = H; fw = H * a; } else { fw = W; fh = W / a; }
    }
    this.frame = { x: (W - fw) / 2, y: (H - fh) / 2, w: fw, h: fh };
    // interface box: 4:3, fitted into the picture
    const s = Math.min(fw / DW, fh / DH);
    this.box = { s, x: this.frame.x + (fw - DW * s) / 2, y: this.frame.y + (fh - DH * s) / 2 };
    this.ui.style.transform = `translate(${this.box.x}px,${this.box.y}px) scale(${s})`;
    // the overlay camera covers the whole picture, in interface units
    // (overlay world units: x = interface x, y = -interface y)
    const ox = (this.box.x - this.frame.x) / s, oy = (this.box.y - this.frame.y) / s;
    this.overCam.left = -ox; this.overCam.right = DW + ox; this.overCam.top = oy; this.overCam.bottom = -(DH + oy);
    this.overCam.updateProjectionMatrix();
    // render targets
    const low = S.texMap === 'standard';
    const rh = low ? 448 : Math.round(fh * dpr), rw = low ? Math.round(448 * fw / fh) : Math.round(fw * dpr);
    for (const rt of [this.rtA, this.rtB, this.rtM]) {
      rt.setSize(rw, rh);
      rt.texture.minFilter = rt.texture.magFilter = THREE.LinearFilter;
    }
    this.rtW = rw; this.rtH = rh;
    this.outMat.uniforms.res.value.set(rw, rh);
    this.outMat.uniforms.lines.value = low ? 448 : Math.min(480, Math.round(fh / 2.25));
    for (const f of this.onResize || []) f();
  }

  // perspective camera whose 4:3 core matches the design framing at any picture aspect
  fitCamera(cam, fov43) {
    const a = this.aspect;
    cam.aspect = a;
    if (a >= 4 / 3) cam.fov = fov43;
    else cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov43) / 2) * (4 / 3) / a));
    // keep the interface box and the camera in agreement when the box is letterboxed inside the picture
    cam.updateProjectionMatrix();
  }

  // interface pixel -> normalised device coordinates of the picture
  toNDC(dx, dy) {
    const { s } = this.box, f = this.frame;
    const px = this.box.x - f.x + dx * s, py = this.box.y - f.y + dy * s;
    return new THREE.Vector2(px / f.w * 2 - 1, 1 - py / f.h * 2);
  }

  // world point on the plane at distance `dist` from the camera that lands on interface pixel (dx,dy)
  toWorld(cam, dx, dy, dist) {
    const n = this.toNDC(dx, dy);
    const v = new THREE.Vector3(n.x, n.y, 0.5).unproject(cam).sub(cam.position).normalize();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    return cam.position.clone().add(v.multiplyScalar(dist / v.dot(fwd)));
  }

  // interface pixels per world unit at distance dist (for sizing objects)
  pxPerUnit(cam, dist) {
    const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    return (this.frame.h / this.box.s) / h;
  }

  render(worldA, worldB, mixv, overlay, time) {
    const r = this.renderer;
    document.body.classList.toggle('crt-on', S.crt === 'on');
    worldA.render(r, this.rtA);
    if (worldB && mixv > 0.001) worldB.render(r, this.rtB);
    r.setRenderTarget(this.rtM);
    r.setClearColor(0x000000, 1); r.clear();
    this.quad.material = this.mixMat;
    const u = this.mixMat.uniforms;
    u.tA.value = this.rtA.texture; u.tB.value = this.rtB.texture;
    u.mixv.value = worldB ? mixv : 0; u.fade.value = this.fade;
    r.render(this.fsScene, this.fsCam);
    if (overlay) { r.clearDepth(); r.render(overlay, this.overCam); }
    // output
    r.setRenderTarget(null);
    r.setScissorTest(false);
    r.setViewport(0, 0, innerWidth, innerHeight); r.setClearColor(0x000000, 1); r.clear();
    const f = this.frame;
    r.setViewport(f.x, innerHeight - f.y - f.h, f.w, f.h);
    this.quad.material = this.outMat;
    this.outMat.uniforms.tM.value = this.rtM.texture;
    this.outMat.uniforms.rgb.value = 0;
    this.outMat.uniforms.crt.value = S.crt === 'on' ? 1 : 0;
    this.outMat.uniforms.time.value = time;
    r.render(this.fsScene, this.fsCam);
    this.fxCanvas.style.display = S.crt === 'on' ? 'block' : 'none';
    if (S.crt === 'on') {
      this.fxMat.uniforms.time.value = time;
      this.fxRenderer.setViewport(0, 0, this.fxCanvas.width, this.fxCanvas.height);
      this.fxRenderer.clear(true, true, true);
      this.fxRenderer.render(this.fxScene, this.fxCam);
    }
  }
}

// A world renders itself into a target; worlds share this tiny base.
export class World {
  constructor(stage) { this.stage = stage; this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(40, 4 / 3, 0.1, 500); this.clear = 0x000000; }
  update() {}
  render(r, target) {
    r.setRenderTarget(target);
    r.setClearColor(this.clear, 1); r.clear();
    r.render(this.scene, this.camera);
  }
}
