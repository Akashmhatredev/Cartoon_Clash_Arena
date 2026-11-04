// Minimal recording stand-in for CanvasRenderingContext2D so Phaser-free art code can run under Node.
// Every method call is accepted; numeric arguments and numeric property writes are checked for NaN/Infinity.
const DEFAULTS = {
  lineWidth: 1, globalAlpha: 1, fillStyle: '#000000', strokeStyle: '#000000', lineCap: 'butt', lineJoin: 'miter',
  miterLimit: 10, globalCompositeOperation: 'source-over', filter: 'none', font: '10px sans-serif', textAlign: 'start',
  textBaseline: 'alphabetic', shadowBlur: 0, shadowColor: 'rgba(0, 0, 0, 0)', shadowOffsetX: 0, shadowOffsetY: 0,
  lineDashOffset: 0, imageSmoothingEnabled: true,
};
const GRADIENT = () => ({ addColorStop() {} });

export function fakeCtx() {
  const bad = [];
  const log = [];
  let calls = 0;
  const props = { ...DEFAULTS, canvas: { width: 256, height: 256 } };
  const stack = [];
  const check = (name, args) => {
    calls++;
    log.push(name + '(' + args.map((a) => (typeof a === 'number' ? Math.round(a * 100) / 100 : typeof a)).join(',') + ')');
    for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) { bad.push(`${name}(${args.join(', ')})`); break; }
  };
  const special = {
    save: () => { calls++; stack.push({ ...props }); },
    restore: () => { calls++; const s = stack.pop(); if (s) Object.assign(props, s); },
    createLinearGradient: (...a) => { check('createLinearGradient', a); return GRADIENT(); },
    createRadialGradient: (...a) => { check('createRadialGradient', a); return GRADIENT(); },
    createConicGradient: (...a) => { check('createConicGradient', a); return GRADIENT(); },
    createPattern: () => GRADIENT(),
    measureText: (t) => ({ width: String(t).length * 6 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    getLineDash: () => [],
    isPointInPath: () => false,
  };
  const ctx = new Proxy({}, {
    get(_, k) {
      if (k === '__bad') return bad;
      if (k === '__calls') return calls;
      if (k === '__log') return log;
      if (k === '__depth') return stack.length;
      if (k in special) return special[k];
      if (k in props) return props[k];
      if (typeof k === 'symbol') return undefined;
      return (...a) => check(String(k), a);
    },
    set(_, k, v) {
      if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${String(k)} = ${v}`);
      log.push(`${String(k)}=${typeof v === 'number' ? Math.round(v * 100) / 100 : typeof v === 'string' ? v : typeof v}`);
      props[k] = v;
      return true;
    },
  });
  return ctx;
}
