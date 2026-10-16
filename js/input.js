// Keyboard, gamepad, wheel and swipe, reduced to controller buttons:
// up down left right | x (Enter) o (Back) t (Triangle) s (Square) | start select
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Enter: 'x', NumpadEnter: 'x', Space: 'x', KeyX: 'x', KeyK: 'x',
  Escape: 'o', Backspace: 'o', KeyO: 'o', KeyC: 'o', KeyL: 'o',
  KeyT: 't', KeyI: 't', Tab: 't',
  KeyQ: 's', KeyE: 's', KeyJ: 's',
  KeyP: 'start', KeyF: 'select',
};
const DIRS = new Set(['up', 'down', 'left', 'right']);

export class Input {
  constructor(handler) {
    this.handler = handler;
    this.enabled = true;
    this.pads = {};
    this.held = {};
    addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'KeyM') { this.emit('mute'); return; }
      const b = KEYMAP[e.code];
      if (!b) { this.emit('any', e); return; }
      e.preventDefault();
      if (e.repeat && !DIRS.has(b)) return;
      this.emit(b, e.repeat);
    });
    let wheelAcc = 0, wheelT = 0;
    addEventListener('wheel', (e) => {
      const now = performance.now();
      if (now - wheelT > 300) wheelAcc = 0;
      wheelT = now; wheelAcc += e.deltaY;
      if (Math.abs(wheelAcc) > 60) { this.emit(wheelAcc > 0 ? 'down' : 'up', false, 'wheel'); wheelAcc = 0; }
    }, { passive: true });
    let ts = null;
    addEventListener('touchstart', (e) => { const p = e.touches[0]; ts = { x: p.clientX, y: p.clientY, t: performance.now() }; }, { passive: true });
    addEventListener('touchend', (e) => {
      if (!ts) return;
      const p = e.changedTouches[0], dx = p.clientX - ts.x, dy = p.clientY - ts.y;
      const dt = performance.now() - ts.t; ts = null;
      if (dt > 600 || Math.max(Math.abs(dx), Math.abs(dy)) < 40) return;
      this.swiped = performance.now();
      if (Math.abs(dx) > Math.abs(dy)) this.emit(dx > 0 ? 'right' : 'left', false, 'swipe');
      else this.emit(dy > 0 ? 'down' : 'up', false, 'swipe');
    }, { passive: true });
    addEventListener('contextmenu', (e) => { e.preventDefault(); this.emit('o', false, 'mouse'); });
  }
  emit(b, repeat = false, src = 'key') { if (this.enabled || b === 'any') this.handler(b, repeat, src); }

  // gamepads are polled from the frame loop
  poll(now) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const st = this.pads[gp.index] || (this.pads[gp.index] = {});
      const B = gp.buttons.map((b) => b && b.pressed);
      const ax = gp.axes || [];
      const state = {
        x: B[0], o: B[1], s: B[2], t: B[3], select: B[8], start: B[9],
        up: B[12] || ax[1] < -0.55, down: B[13] || ax[1] > 0.55, left: B[14] || ax[0] < -0.55, right: B[15] || ax[0] > 0.55,
      };
      for (const k in state) {
        const was = st[k];
        if (state[k] && !was) { st[k] = now; st[k + 'R'] = now + 380; this.emit(k, false, 'pad'); }
        else if (state[k] && DIRS.has(k) && now > st[k + 'R']) { st[k + 'R'] = now + 110; this.emit(k, true, 'pad'); }
        else if (!state[k] && was) st[k] = 0;
      }
    }
  }
}
