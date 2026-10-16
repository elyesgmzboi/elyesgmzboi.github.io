import { el } from './ui.js';

export class Screen {
  constructor(app, id) {
    this.app = app; this.id = id;
    this.root = el('div', 'scr', null, app.ui);
    this.root.id = 'scr-' + id;
    this.build();
  }
  build() {}
  enter() {}
  leave() {}
  key() {}
  show(on) { this.root.classList.toggle('on', on); }
}
