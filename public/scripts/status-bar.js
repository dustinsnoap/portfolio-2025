// ===================================
// Status Bar
// - Draws static bar
// - Syncs CSS scale via pixel-scale service
// - Provides placeholders for future tilesets (faces/icons)
// ===================================

import { getPixelScale, onPixelScaleChange } from "./pixel-scale.js";

// DOM
const canvas = document.getElementById("statusBarCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

// Optional overlay container for future DOM sprites/icons
const overlay = document.getElementById("statusBarOverlay");

// Source bar image
const BAR_SRC = "/images/status_bar.png";

// Intrinsic size
let barW = 0;
let barH = 0;
let barImg = null;

// RAF handle (kept for future effects; currently no-op)
let rafId = null;

// --- Placeholders for future tilesets ---
let faceTileset = null;     // { img: HTMLImageElement, atlas: {...} }
let iconTileset = null;     // { img: HTMLImageElement, atlas: {...} }
let faceState = "idle";     // current face frame name
const mountedIcons = new Map(); // key -> { visible: boolean, x,y,w,h }

// ===================================
// Bootstrap
// ===================================
loadBar(BAR_SRC);

// scale sync
onPixelScaleChange(() => {
  if (!barImg) return;
  applyCssScale();
  layoutOverlay();
  // You might reflow DOM sprites here later
});

// perf-friendly pause on tab hide
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopLoop();
  else if (barImg) startLoop();
});

// cleanup on unload (hot reload)
window.addEventListener("beforeunload", stopLoop);

// keep sizing sane on resize (scale service already debounces)
window.addEventListener("resize", () => {
  if (!barImg) return;
  applyCssScale();
  layoutOverlay();
  stopLoop();
  startLoop();
});

// ===================================
// Load + size + base draw
// ===================================
async function loadBar(src) {
  const img = new Image();
  img.src = src;
  await img.decode();

  barImg = img;
  barW = img.width;
  barH = img.height;

  // internal pixel grid
  canvas.width = barW;
  canvas.height = barH;

  applyCssScale();
  drawBase();

  // announce ready for anyone who cares
  window.dispatchEvent(
    new CustomEvent("status-bar-ready", { detail: { barW, barH } })
  );
  // also emit current scale
  window.dispatchEvent(
    new CustomEvent("status-bar-scale", { detail: { scale: getPixelScale() } })
  );

  startLoop(); // no-op for now
}

/** Apply shared integer pixel scale to CSS size. */
function applyCssScale() {
  const s = getPixelScale();
  canvas.style.width = `${barW * s}px`;
  canvas.style.height = `${barH * s}px`;
}

/** Size overlay box to match canvas CSS size (so children can be placed in source-pixel coords). */
function layoutOverlay() {
  if (!overlay) return;
  const s = getPixelScale();
  overlay.style.width = `${barW * s}px`;
  overlay.style.height = `${barH * s}px`;
}

/** Draw static bar (no cutouts). */
function drawBase() {
  ctx.clearRect(0, 0, barW, barH);
  ctx.drawImage(barImg, 0, 0);
}

// Minimal loop kept for future scanlines/CRT fx (currently idle)
function tick() {
  // drawBase(); // uncomment if you add transient effects
  rafId = requestAnimationFrame(tick);
}
function startLoop() {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(tick);
}
function stopLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

// ===================================
// PUBLIC API (placeholders for quick upgrade later)
// ===================================

/**
 * Register the face tileset to be used later.
 * @param {{img: HTMLImageElement, atlas: object}} tileset
 */
export function registerFaceTileset(tileset) {
  faceTileset = tileset;
}

/**
 * Register the icon tileset to be used later.
 * @param {{img: HTMLImageElement, atlas: object}} tileset
 */
export function registerIconTileset(tileset) {
  iconTileset = tileset;
}

/**
 * Change the face state (frame name). No-op until tileset is wired.
 * @param {string} state - e.g., 'idle' | 'hover' | 'success'
 */
export function setFace(state) {
  faceState = state;
  // TODO: when wired, update a DOM sprite/background-position here.
  // For now, just emit an event for debugging.
  window.dispatchEvent(new CustomEvent("status-bar-face", { detail: { state } }));
}

/**
 * Declare an icon position by key. No draw until tileset is wired.
 * @param {string} key       - unique id, e.g., 'java'
 * @param {{x:number,y:number,w?:number,h?:number,visible?:boolean}} opts
 *        x/y/w/h are source-pixel coords relative to status bar.
 */
export function defineIcon(key, opts) {
  const { x, y, w = 16, h = 16, visible = true } = opts || {};
  mountedIcons.set(key, { x, y, w, h, visible });
  // TODO: when wired, create/position DOM sprite here.
}

/** Show a previously defined icon (no-op until wired). */
export function showIcon(key) {
  const it = mountedIcons.get(key);
  if (it) it.visible = true;
}

/** Hide a previously defined icon (no-op until wired). */
export function hideIcon(key) {
  const it = mountedIcons.get(key);
  if (it) it.visible = false;
}

// For convenience: expose dimensions
export function getStatusBarMetrics() {
  return { barW, barH, scale: getPixelScale() };
}