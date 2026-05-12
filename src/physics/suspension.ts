// ─── Suspension — Raycast Suspension Model ───────────────────────
// KR-007: Spring + damper, ride height, raycast integration.
// No Babylon.js dependency for math; Babylon integration done in vehicle.ts.

export interface SuspensionConfig {
  springRate: number;        // N/m
  compressionDamping: number; // N/(m/s)
  reboundDamping: number;    // N/(m/s)
  restLength: number;        // m (natural length of spring)
  travelLimit: number;       // m (max compression/extension from rest)
}

export interface WheelSuspensionState {
  compression: number;   // m (positive = compressed from rest length)
  velocity: number;      // m/s (positive = compressing = body moving down)
  contactLength: number; // m (raycast hit length, 0 = no contact)
}

export const DEFAULT_SUSPENSION: SuspensionConfig = {
  springRate: 30000,
  compressionDamping: 3000,
  reboundDamping: 1200,
  restLength: 0.3,
  travelLimit: 0.15,
};

// ─── Spring Force ────────────────────────────────────────────────

/**
 * Spring force: F = -k * displacement
 * Positive displacement (compression) → negative force (pushes back up).
 */
export function springForce(displacement: number, springRate: number): number {
  if (displacement === 0) return 0;
  return -springRate * displacement;
}

// ─── Damping Force ───────────────────────────────────────────────

/**
 * Damping force: F = -c * velocity
 * - Compressing (velocity > 0): use compressionDamping
 * - Rebounding (velocity < 0): use reboundDamping
 */
export function dampingForce(
  velocity: number,
  compressionDamping: number,
  reboundDamping: number
): number {
  if (velocity === 0) return 0;
  if (velocity > 0) {
    return -compressionDamping * velocity;
  } else {
    return -reboundDamping * velocity;
  }
}

// ─── Total Suspension Force ──────────────────────────────────────

/**
 * Total suspension force from spring + damper.
 * @param displacement - Compression from rest length (m)
 * @param velocity - Compression velocity (m/s, positive = compressing)
 * @param config - Suspension config
 * @returns Total force (N) — positive pushes body up
 */
export function suspensionForce(
  displacement: number,
  velocity: number,
  config: SuspensionConfig = DEFAULT_SUSPENSION
): number {
  const fSpring = springForce(displacement, config.springRate);
  const fDamp = dampingForce(velocity, config.compressionDamping, config.reboundDamping);
  return fSpring + fDamp;
}

// ─── Raycast Suspension State ────────────────────────────────────

/**
 * Compute suspension compression from raycast hit length.
 * @param rayLength - Actual raycast hit distance (m)
 * @param restLength - Natural suspension length (m)
 * @returns Compression (positive = compressed, negative = extended)
 */
export function compressionFromRay(rayLength: number, restLength: number): number {
  return restLength - rayLength;
}

/**
 * Clamp compression to suspension travel limits.
 */
export function clampCompression(compression: number, travelLimit: number): number {
  return Math.max(-travelLimit, Math.min(travelLimit, compression));
}

// ─── Suspension Export Interface ─────────────────────────────────

export interface SuspensionOutput {
  force: number;       // N (total upward force)
  compression: number; // m (clamped)
  isGrounded: boolean; // whether wheel has contact
}

/**
 * Calculate suspension output from wheel state.
 */
export function calcSuspension(
  state: WheelSuspensionState,
  config: SuspensionConfig = DEFAULT_SUSPENSION
): SuspensionOutput {
  const isGrounded = state.contactLength > 0 && state.contactLength <= config.restLength + config.travelLimit;
  
  if (!isGrounded) {
    return { force: 0, compression: -config.travelLimit, isGrounded: false };
  }

  const rawCompression = compressionFromRay(state.contactLength, config.restLength);
  const compression = clampCompression(rawCompression, config.travelLimit);
  const force = suspensionForce(compression, state.velocity, config);

  return { force, compression, isGrounded };
}
