const CFG = {
  baseWidth: 198,       // design pixel width to compute scale from
  maxWidthRatio: 0.8,   // % of viewport to target
  minScale: 2,
  maxScale: 8,
  cssVar: '--pixel-scale'
};

let scale = 4;
const listeners = new Set();

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function computeScale() {
  const target = window.innerWidth * CFG.maxWidthRatio;
  const s = Math.floor(target / CFG.baseWidth);
  return clamp(s, CFG.minScale, CFG.maxScale);
}

function apply(newScale) {
  scale = newScale;
  document.documentElement.style.setProperty(CFG.cssVar, String(scale));
  // notify subscribers
  listeners.forEach(fn => { try { fn(scale); } catch {} });
}

function recalc() { apply(computeScale()); }

// simple debounce to avoid thrash on resize
let t = null;
function onResize() {
  clearTimeout(t);
  t = setTimeout(recalc, 100);
}

export function initPixelScale(opts = {}) {
  Object.assign(CFG, opts); // allow overrides at boot
  recalc();
  window.addEventListener('resize', onResize);
  return scale;
}

export function getPixelScale() { return scale; }

export function onPixelScaleChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}