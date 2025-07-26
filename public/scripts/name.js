// ===================================
// Initialization + Configuration
// ===================================

// Grab canvas element and its 2D context
const canvas = document.getElementById('nameCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

// Image metadata and raw image data
let originalData = null;
let pixelWidth = 198;            // default fallback
let pixelHeight = 0;

// 🎛️ Grain configuration
const GRAIN_BASE = 1;            // grain intensity at top
const GRAIN_MULTIPLIER = 50;     // how much intensity increases toward bottom
const GRAIN_SCALE = 0.5;         // overall multiplier for visual strength

// 🎛️ Pixel display config (CSS scale)
const MAX_WIDTH_RATIO = 0.8;     // % of screen width to use for canvas
const MIN_PIXEL_SCALE = 2;       // never render smaller than this multiple
const MAX_PIXEL_SCALE = 8;       // never render larger than this multiple

// ===================================
// Bootstrap (load image + start loop)
// ===================================

loadStaticImage('/images/name.png');  // <-- path to static PNG

// Resize canvas when window resizes
window.addEventListener('resize', () => {
  if (originalData) updateCanvasDisplaySize();
});

// ===================================
// Image Loading + Drawing
// ===================================

/**
 * Loads a static PNG, draws it to canvas, and starts grain loop.
 * @param {string} src - Path to image (relative to /public)
 */
async function loadStaticImage(src) {
  const img = new Image();
  img.src = src;
  await img.decode();  // wait for full decoding

  // Set internal canvas resolution to match image
  pixelWidth = img.width;
  pixelHeight = img.height;
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;

  // Apply CSS scale
  updateCanvasDisplaySize();

  // Draw the image once to initialize canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  // Cache the clean pixel data
  originalData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Begin animation loop
  animateGrain();
}

/**
 * Dynamically sets the canvas’s on-screen pixel scale based on viewport width.
 */
function updateCanvasDisplaySize() {
  const screenWidth = window.innerWidth;
  const targetWidth = screenWidth * MAX_WIDTH_RATIO;

  const scale = clamp(
    Math.floor(targetWidth / pixelWidth),
    MIN_PIXEL_SCALE,
    MAX_PIXEL_SCALE
  );

  canvas.style.width = `${pixelWidth * scale}px`;
  canvas.style.height = `${pixelHeight * scale}px`;
}

// ===================================
// Grain Animation Loop
// ===================================

/**
 * Applies animated grain to the image, stronger at the bottom.
 * Runs continuously using requestAnimationFrame.
 */
function animateGrain() {
  if (!originalData) return;

  const width = originalData.width;
  const height = originalData.height;

  // Create a fresh copy of the pixel data each frame
  const grainData = new ImageData(
    new Uint8ClampedArray(originalData.data),
    width,
    height
  );

  const data = grainData.data;

  // Loop over every pixel (each pixel = 4 RGBA values)
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];

    // Skip transparent pixels
    if (alpha !== 255) continue;

    // Get vertical Y position of pixel
    const pixelIndex = i / 4;
    const y = Math.floor(pixelIndex / width);
    const verticalFactor = y / height;

    // Calculate grain range at this height
    const grainRange = GRAIN_BASE + verticalFactor * GRAIN_MULTIPLIER;

    // Random grain offset, centered around 0
    const grain = Math.floor((Math.random() * grainRange - grainRange / 2) * GRAIN_SCALE);

    // Apply to RGB channels
    data[i]     = clamp(data[i]     + grain); // R
    data[i + 1] = clamp(data[i + 1] + grain); // G
    data[i + 2] = clamp(data[i + 2] + grain); // B
  }

  // Push result to canvas
  ctx.putImageData(grainData, 0, 0);

  // Schedule next frame
  requestAnimationFrame(animateGrain);
}

// ===================================
// Utilities
// ===================================

/**
 * Restricts a number between a min and max value.
 * Used for color values and pixel scaling.
 */
function clamp(v, min = 0, max = 255) {
  return Math.max(min, Math.min(max, v));
}
