/**
 * mouse-look.js
 * -----------------
 * Low-priority behavior: update face direction based on mouse position
 * across the viewport. This gives the effect of eyes "following" the cursor.
 *
 * Priority:
 * - Uses setFaceLow() from face-priority.js so it only applies if no
 *   high-priority lock is active (e.g., click, error, success).
 *
 * Zones:
 * - Viewport is divided into thirds (horizontal + vertical).
 * - Horizontal: Left (< 0.33), Right (> 0.66), else Center.
 * - Vertical:   Up (< 0.33), Down (> 0.66), else Center.
 * - Combined into a zone code: e.g., "UL", "C", "R", "D".
 *
 * Throttling:
 * - Movement events are throttled (default 80ms) to avoid excessive
 *   face changes and improve performance.
 *
 * Extension:
 * - Adjust thresholds in T.edge/center to make "eye tracking" more or less sensitive.
 * - Add new entries to FACE_BY_ZONE if you have additional sprites (e.g., diagonal variants).
 */

import { setFaceLow } from "/scripts/face-priority.js";

// Mapping of zone codes -> atlas frame names (must exist in faces_atlas.json)
const FACE_BY_ZONE = {
  C:  "idle",          // center / default
  L:  "look_left",
  R:  "look_right",
  U:  "look_up",
  D:  "look_down",
  UL: "look_up_left",
  UR: "look_up_right",
  DL: "look_down_left",
  DR: "look_down_right",
};

// Remember the last applied zone to avoid redundant updates
let lastZone = null;

// Tuning constants
const T = {
  throttleMs: 80,  // min ms between updates
  edge: 0.33,      // left/up cutoff (% of viewport)
  center: 0.66     // right/down cutoff (% of viewport)
};

let t = 0; // last update timestamp

/**
 * Mouse move handler
 * - Normalizes cursor coords to 0..1 range
 * - Maps to a zone code based on thresholds
 * - Calls setFaceLow() with the corresponding frame
 */
function onMove(e) {
  const now = performance.now();
  if (now - t < T.throttleMs) return; // throttle
  t = now;

  const vw = window.innerWidth  || 1;
  const vh = window.innerHeight || 1;
  const nx = e.clientX / vw; // 0..1 normalized X
  const ny = e.clientY / vh; // 0..1 normalized Y

  // Determine horizontal + vertical directions
  const h = nx < T.edge   ? "L" : nx > T.center ? "R" : "";
  const v = ny < T.edge   ? "U" : ny > T.center ? "D" : "";
  const zone = (v + h) || "C"; // e.g. "UL", "R", or "C"

  if (zone === lastZone) return; // no change
  lastZone = zone;

  const face = FACE_BY_ZONE[zone] || "idle";
  setFaceLow(face);
}

/**
 * Mouse leave handler
 * - Reset to idle when cursor leaves the window
 */
function onLeave() {
  lastZone = null;
  setFaceLow("idle");
}

/**
 * Initializes mouse-look behavior
 * - Registers event listeners
 */
export function initMouseLook() {
  window.addEventListener("mousemove", onMove, { passive: true });
  window.addEventListener("mouseleave", onLeave);
}
