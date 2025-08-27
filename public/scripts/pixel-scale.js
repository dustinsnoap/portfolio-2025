/**
 * pixel-scale.js
 * ----------------
 * Central service for managing pixel scaling across all pixel-art canvases.
 *
 * Purpose:
 * - Ensures consistent pixel size for every component (status bar, name, backgrounds).
 * - Publishes scale changes to subscribers (other scripts) so they can redraw
 *   when pixel size updates.
 * - Exposes config flags for responsive scaling or fixed scaling.
 *
 * Modes:
 * - Fixed scale (preferred for retro HUD): set `fixedScale` to an integer (e.g., 2, 3, 4).
 *   Every canvas will render at that multiplier regardless of viewport width.
 * - Responsive scale: leave `fixedScale` null. Scale will be calculated from
 *   viewport width and CFG.baseWidth, clamped by minScale/maxScale.
 *
 * Key Configs:
 * - baseWidth: intrinsic design width of your art (e.g., name.png’s 198px width).
 * - maxWidthRatio: % of viewport to occupy if responsive scaling is used.
 * - minScale / maxScale: clamps to avoid pixels being too tiny or too huge.
 * - cssVar: the CSS variable injected (`--pixel-scale`) so CSS and JS agree.
 * - fixedScale: force integer multiplier (disables responsive scaling).
 * - globalMultiplier: fine-tune shrink/grow factor (applied to responsive only).
 * - targetWidthPx: override viewport ratio; pick a fixed CSS width target.
 *
 * Usage:
 *   import { initPixelScale, getPixelScale, onPixelScaleChange } from "/scripts/pixel-scale.js";
 *   initPixelScale({ fixedScale: 4, minScale: 1, maxScale: 6 });
 *
 *   const scale = getPixelScale(); // read once
 *   onPixelScaleChange((s) => console.log("new scale", s)); // subscribe to changes
 */

const CFG = {
  baseWidth: 198,           // design pixel width of your art (e.g., name.png)
  maxWidthRatio: 0.8,       // responsive: % of viewport to target
  minScale: 1,              // minimum pixel multiplier allowed
  maxScale: 8,              // maximum pixel multiplier allowed
  cssVar: '--pixel-scale',  // CSS var injected on <html> for styling
  fixedScale: null,         // when set, use this exact multiplier
  globalMultiplier: 1.0,    // applied in responsive mode only
  targetWidthPx: null,      // override viewport ratio with a fixed target width
};

let scale = 4;                // current pixel scale (shared globally)
const listeners = new Set();  // callbacks to notify when scale changes

// Clamp helper
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

/**
 * Compute the new scale based on config + viewport.
 * - If fixedScale is set, always use it.
 * - Otherwise, use responsive math: viewport * ratio / baseWidth.
 */
function computeScale() {
  if (Number.isInteger(CFG.fixedScale) && CFG.fixedScale > 0) {
    return clamp(CFG.fixedScale, CFG.minScale, CFG.maxScale);
  }

  const targetCssWidth = (typeof CFG.targetWidthPx === 'number' && CFG.targetWidthPx > 0)
    ? CFG.targetWidthPx
    : window.innerWidth * CFG.maxWidthRatio;

  let s = Math.floor((targetCssWidth / CFG.baseWidth) * (CFG.globalMultiplier ?? 1));
  if (s < 1) s = 1;
  return clamp(s, CFG.minScale, CFG.maxScale);
}

/**
 * Apply a new scale:
 * - Update internal variable
 * - Push to CSS var for styling
 * - Notify subscribers
 */
function apply(newScale) {
  scale = newScale;
  document.documentElement.style.setProperty(CFG.cssVar, String(scale));
  listeners.forEach(fn => { try { fn(scale); } catch {} });
}

// Recalculate scale and apply
function recalc() { apply(computeScale()); }

// Debounced resize handler
let t = null;
function onResize() {
  clearTimeout(t);
  t = setTimeout(recalc, 100);
}

/**
 * Initialize pixel-scale service.
 * - Optionally override CFG with passed opts.
 * - Computes initial scale and attaches resize listener.
 */
export function initPixelScale(opts = {}) {
  Object.assign(CFG, opts);
  recalc();
  window.addEventListener('resize', onResize);
  return scale;
}

/**
 * Get current scale multiplier.
 */
export function getPixelScale() { return scale; }

/**
 * Subscribe to scale changes.
 * - Returns an unsubscribe function.
 */
export function onPixelScaleChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}