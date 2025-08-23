/**
 * face-priority.js
 * -----------------
 * A priority wrapper around the status bar face system.
 *
 * Purpose:
 * - Allows "low priority" face updates (like mouse-look) that can be overridden.
 * - Allows "high priority" face updates (like click, error, success) that take precedence
 *   and lock the face for a short duration.
 * - Provides explicit lock/unlock control for custom behaviors.
 *
 * How it works:
 * - Uses a timestamp (`lockUntil`) to prevent lower-priority calls from overwriting
 *   the face while a lock is active.
 * - High priority actions set the lock for a duration and update the face immediately.
 * - Low priority actions only apply if no lock is active.
 *
 * Typical usage:
 *   import { setFaceLow, flashFaceHigh } from "/scripts/face-priority.js";
 *
 *   // Low priority (mouse-look eyes follow cursor)
 *   setFaceLow("look_left");
 *
 *   // High priority (click flashes happy face, overrides low priority)
 *   flashFaceHigh("happy", 800);
 *
 *   // Manual lock/unlock
 *   lockFace(2000);   // lock for 2s
 *   clearLock();      // immediately unlock
 */

import { setFace as rawSet, flashFace as rawFlash } from "/scripts/status-bar.js";

// Timestamp (ms) until which low-priority updates are blocked
let lockUntil = 0;

/**
 * Low-priority face update.
 * - Only applies if not locked.
 * - Example: called by mouse-look or idle timer.
 */
export function setFaceLow(name) {
  if (performance.now() >= lockUntil) rawSet(name);
}

/**
 * High-priority face update.
 * - Immediately updates the face and locks further low-priority updates
 *   for the given duration (default: 800ms).
 * - Example: click, success, error feedback.
 */
export function flashFaceHigh(name, ms = 800) {
  lockUntil = performance.now() + ms;
  rawFlash(name, ms);
}

/**
 * Manual lock.
 * - Prevents low-priority updates for `ms` ms (default: 800).
 * - Does not itself change the face.
 */
export function lockFace(ms = 800) { lockUntil = performance.now() + ms; }

/**
 * Clears the lock immediately.
 * - Restores low-priority update eligibility.
 */
export function clearLock() { lockUntil = 0; }
