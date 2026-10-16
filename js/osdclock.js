// The menu module's frame loop and its own clock.
//
// Animations use the console's frame loop; wall-clock time stays tied to the RTC so low frame rates cannot make
// the displayed clock drift and jump back into sync.
import { realMs, clockNowFrom, S } from './settings.js';

export const osd = {
  ms: realMs(),      // the OSD clock, in the same epoch as realMs()
  rate: 60,          // frames per second the console is managing right now
  acc: 0,
  frame: 0,
  // how many frames to step for dt seconds of wall time
  frames(dt) {
    this.acc += Math.min(dt, 0.25) * this.rate;
    const n = Math.floor(this.acc); this.acc -= n;
    return n;
  },
  tick() {
    this.frame++;
    this.ms = realMs();
  },
  now() { return clockNowFrom(this.ms); },
  // clock hands as the ROM reads them (0x22B5E8 / 0x22B6B0 / 0x22B720)
  seconds() { const c = this.now(); return c.s + ((((this.ms + S.clockOffset) % 1000) + 1000) % 1000) / 1000; },
  minutes() { const c = this.now(); return c.mi + this.seconds() / 60; },
  hours() { const c = this.now(); return c.h + this.minutes() / 60; },
};
