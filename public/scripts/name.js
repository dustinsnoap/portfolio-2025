// ===================================
// Initialization + Configuration
// ===================================

import { getPixelScale, onPixelScaleChange } from "./pixel-scale.js";

// Grab canvas + 2D context
const canvas = document.getElementById("nameCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

// Image metadata and raw image data
let originalData = null; // pristine pixels from the source image
let pixelWidth = 198;    // fallback; replaced after image decode
let pixelHeight = 0;

// 🎛️ Grain configuration
const GRAIN_BASE = 1;        // grain intensity at the very top row
const GRAIN_MULTIPLIER = 50; // how much intensity increases from top→bottom
const GRAIN_SCALE = 0.5;     // global multiplier applied to the random offset

// Animation handle
let rafId = null;

// ===================================
// Bootstrap (load image + subscriptions)
// ===================================

loadStaticImage("/images/name.png"); // <-- path to your PNG

// Keep CSS scale synced with global pixel-scale service
onPixelScaleChange(() => {
  if (originalData) updateCanvasDisplaySize();
});

// Pause/resume animation when tab visibility changes (saves CPU/GPU)
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopLoop();
  else if (originalData) startLoop();
});

// Optional: clean up on page unload (helps during hot reloads)
window.addEventListener("beforeunload", stopLoop);

// ===================================
// Image Loading + Drawing
// ===================================

/**
 * Loads a static PNG, draws it once, caches the pristine pixels,
 * then starts the animation loop.
 * @param {string} src - Path to the image in /public
 */
async function loadStaticImage(src) {
  const img = new Image();
  img.src = src;
  await img.decode();

  // Match internal canvas resolution to the source pixel grid
  pixelWidth = img.width;
  pixelHeight = img.height;
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;

  // Apply current CSS scale
  updateCanvasDisplaySize();

  // Seed the canvas and cache pristine pixels
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  originalData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  startLoop();
}

/**
 * Applies the shared pixel scale to the canvas CSS size.
 * Keeps “pixel size” identical across components.
 */
function updateCanvasDisplaySize() {
  const scale = getPixelScale();
  canvas.style.width  = `${pixelWidth * scale}px`;
  canvas.style.height = `${pixelHeight * scale}px`;
}

// ===================================
// Animation Loop (requestAnimationFrame)
// ===================================

/**
 * Starts the animation loop if not already running.
 */
function startLoop() {
  if (rafId !== null) return;
  const tick = () => {
    renderGrainFrame();
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

/**
 * Cancels the animation loop if running.
 */
function stopLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

// ===================================
// Grain Rendering (modularized)
// ===================================

/**
 * Renders one frame of grain by cloning pristine pixels,
 * applying grain, and pushing the result to the canvas.
 */
function renderGrainFrame() {
  if (!originalData) return;

  // 1) Clone the original pixel buffer for this frame
  const frame = cloneImageData(originalData);

  // 2) Apply grain in-place to the cloned buffer
  applyVerticalGrain(frame, {
    base: GRAIN_BASE,
    multiplier: GRAIN_MULTIPLIER,
    scale: GRAIN_SCALE,
  });

  // 3) Commit to the canvas
  ctx.putImageData(frame, 0, 0);
}

/**
 * Returns a deep copy of an ImageData object.
 */
function cloneImageData(src) {
  return new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
}

/**
 * Applies vertically weighted grain to an ImageData buffer.
 * Stronger grain appears toward the bottom of the image.
 */
function applyVerticalGrain(imgData, cfg) {
  const { width, height, data } = imgData;
  const { base, multiplier, scale } = cfg;

  // Iterate per pixel (RGBA stride = 4)
  // Micro-opts: hoist width to avoid repeated property lookups
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (!isOpaque(a)) continue; // only touch fully opaque pixels

    const pixelIndex = i >> 2;            // divide by 4
    const y = Math.floor(pixelIndex / width);
    const intensity = computeGrainIntensity(y, height, base, multiplier);
    const offset = computeRandomOffset(intensity, scale);

    // Apply offset to RGB channels (clamped to 0..255)
    data[i]     = clamp8(data[i]     + offset); // R
    data[i + 1] = clamp8(data[i + 1] + offset); // G
    data[i + 2] = clamp8(data[i + 2] + offset); // B
  }
}

/**
 * Returns true if the alpha channel indicates a fully opaque pixel.
 */
function isOpaque(alpha) {
  return alpha === 255;
}

/**
 * Computes the raw grain intensity for a given row `y`.
 * Intensity increases linearly from top (0) to bottom (height-1).
 */
function computeGrainIntensity(y, height, base, multiplier) {
  const t = y / height; // 0..1 vertical factor
  return base + t * multiplier;
}

/**
 * Converts an intensity + scale into a signed random offset for RGB channels.
 * The offset is centered around 0.
 */
function computeRandomOffset(intensity, scale) {
  // Random in [-intensity/2, +intensity/2], then scaled
  const raw = Math.random() * intensity - intensity / 2;
  return Math.floor(raw * scale);
}

// ===================================
// Utilities
// ===================================

/**
 * Fast clamp to 0..255 for 8-bit channel math.
 */
function clamp8(v) {
  // Bit trick is unsafe for negatives; stick to Math for clarity.
  return Math.max(0, Math.min(255, v));
}