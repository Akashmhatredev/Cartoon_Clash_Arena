// Offline driver: runs the shared engine directly. Same interface as net/OnlineDriver.
import { createMatch, step } from '@shared/index.js';

export class LocalDriver {
  constructor(opts) {
    this.opts = { ...opts };
    this.localSide = null;
    this.stats = { ping: 0, drift: 0 };
    this.state = createMatch(this.opts);
  }

  tick(inputs) {
    step(this.state, inputs);
    return this.state.events;
  }

  /** Fresh match with the same options (training reset / restart). Overrides are merged in. */
  reset(overrides) {
    if (overrides) Object.assign(this.opts, overrides);
    this.state = createMatch(this.opts);
    return this.state;
  }

  destroy() {
    this.state = null;
  }
}
