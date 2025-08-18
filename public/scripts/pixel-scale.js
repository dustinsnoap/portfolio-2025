const CFG = {
  baseWidth: 198,
  maxWidthRatio: 0.8,
  minScale: 1,
  maxScale: 8,
  cssVar: '--pixel-scale',
  fixedScale: null,        // NEW: when set to an integer, use this exactly
  globalMultiplier: 1.0,   // (optional) keep if you like; ignored when fixedScale set
  targetWidthPx: null,     // (optional) ignored when fixedScale set
};

let scale = 4;
const listeners = new Set();

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function computeScale() {
  // NEW: absolute lock
  if (Number.isInteger(CFG.fixedScale) && CFG.fixedScale > 0) {
    return clamp(CFG.fixedScale, CFG.minScale, CFG.maxScale);
  }

  // otherwise compute responsive scale (existing behavior, kept for flexibility)
  const targetCssWidth = (typeof CFG.targetWidthPx === 'number' && CFG.targetWidthPx > 0)
    ? CFG.targetWidthPx
    : window.innerWidth * CFG.maxWidthRatio;

  let s = Math.floor((targetCssWidth / CFG.baseWidth) * (CFG.globalMultiplier ?? 1));
  if (s < 1) s = 1;
  return clamp(s, CFG.minScale, CFG.maxScale);
}

function apply(newScale) {
  scale = newScale;
  document.documentElement.style.setProperty(CFG.cssVar, String(scale));
  listeners.forEach(fn => { try { fn(scale); } catch {} });
}

function recalc() { apply(computeScale()); }

let t = null;
function onResize() {
  clearTimeout(t);
  t = setTimeout(recalc, 100);
}

export function initPixelScale(opts = {}) {
  Object.assign(CFG, opts);
  recalc();
  window.addEventListener('resize', onResize);
  return scale;
}

export function getPixelScale() { return scale; }
export function onPixelScaleChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}