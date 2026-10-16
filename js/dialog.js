export class Dialog { constructor(app) { this.app = app; this.open = false; } build() {} key() {} hit() {} openLink(u) { window.open(u, '_blank', 'noopener'); } }
