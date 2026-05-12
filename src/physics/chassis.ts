// ─── Chassis — Load Transfer & Weight Distribution ───────────────
// KR-007: Load transfer under accel/braking/cornering, ARB, static loads.

const GRAVITY = 9.81;

export interface ChassisConfig {
  mass: number;                  // kg
  cgHeight: number;              // m (above roll axis)
  trackWidth: number;            // m (left-right contact patch distance)
  wheelbase: number;             // m
  weightDistributionFront: number; // fraction (0.45 = 45% front)
}

export interface AntiRollBarConfig {
  stiffness: number;   // N·m/rad
  leverRatio: number;  // moment arm ratio
}

export const PHANTOM_CHASSIS: ChassisConfig = {
  mass: 1400,
  cgHeight: 0.45,
  trackWidth: 1.5,
  wheelbase: 2.6,
  weightDistributionFront: 0.55,
};

export const PHANTOM_ARB_FRONT: AntiRollBarConfig = {
  stiffness: 4000,
  leverRatio: 2.5,
};

export const PHANTOM_ARB_REAR: AntiRollBarConfig = {
  stiffness: 3000,
  leverRatio: 2.5,
};

// ─── Static Wheel Loads ──────────────────────────────────────────

/**
 * Static wheel loads (N) per axle.
 */
export function staticWheelLoads(config: ChassisConfig): { front: number; rear: number } {
  const totalWeight = config.mass * GRAVITY;
  return {
    front: totalWeight * config.weightDistributionFront,
    rear: totalWeight * (1 - config.weightDistributionFront),
  };
}

// ─── Lateral Load Transfer ───────────────────────────────────────

/**
 * Lateral load transfer (N) during cornering.
 * ΔF = (lateralAccel × cgHeight × mass) / (2 × trackWidth)
 * Positive = weight shifted to outside (right during left turn).
 */
export function lateralLoadTransfer(
  lateralAccel: number, // m/s² (positive = right)
  config: ChassisConfig = PHANTOM_CHASSIS
): number {
  return (lateralAccel * config.cgHeight * config.mass) / (2 * config.trackWidth);
}

// ─── Longitudinal Load Transfer ──────────────────────────────────

/**
 * Longitudinal load transfer (N) during braking/acceleration.
 * ΔF = (longAccel × cgHeight × mass) / (2 × wheelbase)
 * Braking (negative accel) → weight shifts to front (negative return)
 * Acceleration (positive accel) → weight shifts to rear (positive return)
 */
export function longitudinalLoadTransfer(
  longAccel: number, // m/s² (positive = accelerating)
  config: ChassisConfig = PHANTOM_CHASSIS
): number {
  return (longAccel * config.cgHeight * config.mass) / (2 * config.wheelbase);
}

// ─── Anti-Roll Bar ───────────────────────────────────────────────

/**
 * Anti-roll bar force (N).
 * F = (stiffness × rollAngle) / leverRatio
 */
export function antiRollBarForce(
  rollAngle: number, // radians
  config: AntiRollBarConfig
): number {
  return (config.stiffness * rollAngle) / config.leverRatio;
}

// ─── All-Wheels Load ─────────────────────────────────────────────

export interface WheelLoads {
  frontLeft: number;
  frontRight: number;
  rearLeft: number;
  rearRight: number;
}

/**
 * Compute the normal load at all 4 wheels, accounting for:
 * - Static weight distribution
 * - Longitudinal load transfer (braking/accel)
 * - Lateral load transfer (cornering)
 *
 * @param lateralAccel - m/s² (positive = right turn)
 * @param longAccel - m/s² (positive = acceleration, negative = braking)
 * @param config - Chassis config
 */
export function allWheelLoads(
  lateralAccel: number,
  longAccel: number,
  config: ChassisConfig = PHANTOM_CHASSIS
): WheelLoads {
  const { front: staticFront, rear: staticRear } = staticWheelLoads(config);
  const dLateral = lateralLoadTransfer(lateralAccel, config);
  const dLong = longitudinalLoadTransfer(longAccel, config);

  // Each axle load is split 50/50 left/right, then adjusted for lateral transfer
  // Longitudinal transfer affects front/rear axle loads
  const frontAxle = staticFront - dLong;
  const rearAxle = staticRear + dLong;

  // Per-wheel: half axle load ± lateral transfer
  return {
    frontLeft: frontAxle / 2 - dLateral,
    frontRight: frontAxle / 2 + dLateral,
    rearLeft: rearAxle / 2 - dLateral,
    rearRight: rearAxle / 2 + dLateral,
  };
}
