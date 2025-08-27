// ===================================
// Status Bar (canvas + shadow-canvas face blit)
// - Static bar draw
// - Shared pixel-scale (CSS only; source pixels stay native)
// - Face frames blitted from a cached tileset
// ===================================

import { getPixelScale, onPixelScaleChange } from "./pixel-scale.js";

// --- Final face offsets (visual nudge you found) ---
const FACE_OFFSET = { x: 0, y: -7 }; // source-pixel nudges for your HUD art
const FACE_WIDTH = 32
const FACE_HEIGHT = 32

// DOM
const canvas = document.getElementById("statusBarCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
ctx.imageSmoothingEnabled = false;
canvas.style.backgroundColor = "#111111";

// Assets
const BAR_SRC    = "/images/status_bar.png";
const FACES_IMG  = "/images/faces.png";
const FACES_ATLS = "/images/faces_atlas.json";

// Bar intrinsic pixels
let barW = 0;
let barH = 0;
let barImg = null;

// Faces tileset cache (shadow canvas)
const shadow = document.createElement("canvas");
const sctx = shadow.getContext("2d", { willReadFrequently: true });
sctx.imageSmoothingEnabled = false;

let atlas = null;        // parsed atlas JSON
let facesReady = false;

// Face placement on the bar
let faceRect = { x: 0, y: -7, w: FACE_WIDTH, h: FACE_HEIGHT }; // defaults; updated after load
let currentFace = "idle";

// ===================================
// Bootstrap
// ===================================
init();

async function init() {
  await Promise.all([loadBar(BAR_SRC), loadFaces()]);
  placeFaceRect();
  drawBar();
  blitFace(currentFace);

  // announce
  window.dispatchEvent(new CustomEvent("status-bar-ready",  { detail: { barW, barH } }));
  window.dispatchEvent(new CustomEvent("status-bar-scale",  { detail: { scale: getPixelScale() } }));

  // react to scale/resize (CSS only; redraw keeps frame clean)
  onPixelScaleChange(handleScaleOrResize);
  window.addEventListener("resize", handleScaleOrResize);

  applyCssScale();
}

function handleScaleOrResize() {
  applyCssScale();
  drawBar();
  blitFace(currentFace);
}

// ===================================
// Loading
// ===================================

async function loadBar(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  barImg = img;
  barW = img.width;
  barH = img.height;
  canvas.width  = barW;
  canvas.height = barH;
}

async function loadFaces() {
  atlas = await fetch(FACES_ATLS).then(r => r.json());

  // Force your actual tile size regardless of JSON values
  atlas.tileWidth  = FACE_WIDTH;
  atlas.tileHeight = FACE_HEIGHT;

  const img = new Image();
  img.src = FACES_IMG;
  await img.decode();

  // cache the whole tileset in shadow canvas
  shadow.width  = img.width;
  shadow.height = img.height;
  sctx.clearRect(0, 0, shadow.width, shadow.height);
  sctx.drawImage(img, 0, 0);

  facesReady = true;

  // sync rect size to atlas
  faceRect.w = atlas.tileWidth;
  faceRect.h = atlas.tileHeight;
}

// ===================================
// Layout / Scale
// ===================================

function applyCssScale() {
  const s = getPixelScale();
  canvas.style.width  = `${barW * s}px`;
  canvas.style.height = `${barH * s}px`;
}

/**
 * Center the face in source pixels, with your integer nudges.
 */
function placeFaceRect() {
  const tw = atlas?.tileWidth  ?? faceRect.w;
  const th = atlas?.tileHeight ?? faceRect.h;

  faceRect.w = tw;
  faceRect.h = th;
  faceRect.x = Math.floor((barW - tw) / 2) + (FACE_OFFSET.x | 0);
  faceRect.y = 8 + (FACE_OFFSET.y | 0); // adjust 8 if your HUD window shifts
}

// ===================================
// Drawing
// ===================================

function drawBar() {
  ctx.clearRect(0, 0, barW, barH);
  ctx.drawImage(barImg, 0, 0);
}

function clearFaceArea() {
  ctx.clearRect(faceRect.x, faceRect.y, faceRect.w, faceRect.h);
}

function blitFace(name) {
  if (!facesReady || !atlas) return;

  const frame = atlas.frames[name] || atlas.frames["idle"];
  const [cx, cy] = frame;

  const sx = cx * atlas.tileWidth;
  const sy = cy * atlas.tileHeight;

  clearFaceArea();
  ctx.drawImage(
    shadow,
    sx, sy, atlas.tileWidth, atlas.tileHeight,
    faceRect.x, faceRect.y, atlas.tileWidth, atlas.tileHeight
  );

  currentFace = name;
}

// ===================================
// Public API
// ===================================

/** Set face immediately; draws only if assets are ready. */
export function setFace(name) {
  blitFace(name);
}

/** Flash a face then return to idle. */
let faceTimer = null;
export function flashFace(name, ms = 900) {
  clearTimeout(faceTimer);
  blitFace(name);
  faceTimer = setTimeout(() => blitFace("idle"), ms);
}

/** Bar size/scale for consumers. */
export function getStatusBarMetrics() {
  return { barW, barH, scale: getPixelScale(), faceRect: { ...faceRect } };
}