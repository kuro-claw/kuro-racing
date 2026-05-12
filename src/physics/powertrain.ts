// ─── Powertrain — Engine, Gearbox, Clutch, Differential ─────────
// KR-008: RPM-dependent torque curve, fixed gear ratios, clutch, differential.
// No Babylon.js dependency — pure math.

export interface EngineConfig {
  idleRpm: number;
  redlineRpm: number;
  maxTorqueNm: number;
  peakTorqueRpm: number;
  inertia: number; // kg·m² — engine moment of inertia
}

export interface GearboxConfig {
  ratios: number[];   // gear ratios [1st, 2nd, 3rd, ...]
  finalDrive: number; // final drive ratio
  efficiency: number; // drivetrain efficiency (0-1)
}

export interface ClutchConfig {
  maxTransferTorque: number; // N·m — max torque clutch can transfer
  engagementSpeed: number;   // rad/s difference at which clutch fully locks
}

export interface DifferentialConfig {
  torqueSplit: number; // 0.5 = 50:50, 0 = all to left, 1 = all to right
  lockingCoeff: number; // 0 = open, 1 = locked
}

export const PHANTOM_ENGINE: EngineConfig = {
  idleRpm: 800,
  redlineRpm: 7500,
  maxTorqueNm: 450,   // N·m — sports car peak torque
  peakTorqueRpm: 4500,
  inertia: 0.15,       // kg·m²
};

export const PHANTOM_GEARBOX: GearboxConfig = {
  ratios: [3.65, 2.43, 1.69, 1.24, 1.0, 0.84],
  finalDrive: 3.73,
  efficiency: 0.92,
};

export const PHANTOM_CLUTCH: ClutchConfig = {
  maxTransferTorque: 600,
  engagementSpeed: 5.0, // rad/s
};

export const PHANTOM_DIFF: DifferentialConfig = {
  torqueSplit: 0.5,
  lockingCoeff: 0.3,
};

// ─── Engine Torque Curve ─────────────────────────────────────────

/**
 * Compute engine torque (N·m) at a given RPM.
 * Uses a smooth bell-curve shape peaking near peakTorqueRpm.
 * Falls off below idle and above redline.
 *
 * @param rpm - Current engine RPM
 * @param config - Engine configuration
 * @returns Torque in N·m (0 below idle / above redline)
 */
export function engineTorque(rpm: number, config: EngineConfig = PHANTOM_ENGINE): number {
  if (rpm <= 0) return 0;
  if (rpm < config.idleRpm) return config.maxTorqueNm * 0.2; // idle torque
  if (rpm > config.redlineRpm) return 0;

  const { idleRpm, redlineRpm, maxTorqueNm, peakTorqueRpm } = config;

  // Normalize RPM to [0, 1] range
  const range = redlineRpm - idleRpm;
  const normalized = (rpm - idleRpm) / range;
  const peakNorm = (peakTorqueRpm - idleRpm) / range;

  // Asymmetric bell curve:
  // - Rises steeply from idle to peak
  // - Falls off more gradually from peak to redline (high-rpm engines)
  let torqueMultiplier: number;
  if (normalized <= peakNorm) {
    // Rising side — smooth cubic rise
    const t = normalized / peakNorm;
    torqueMultiplier = 0.2 + 0.8 * (3 * t * t - 2 * t * t * t); // smoothstep
  } else {
    // Falling side — exponential-ish dropoff
    const t = (normalized - peakNorm) / (1 - peakNorm);
    torqueMultiplier = 1.0 - 0.7 * (t * t); // peak → 30% at redline
  }

  return maxTorqueNm * Math.max(0, torqueMultiplier);
}

/**
 * Convert RPM to angular velocity (rad/s).
 */
export function rpmToRadS(rpm: number): number {
  return (rpm * 2 * Math.PI) / 60;
}

/**
 * Convert angular velocity (rad/s) to RPM.
 */
export function radSToRpm(radS: number): number {
  return (radS * 60) / (2 * Math.PI);
}

// ─── Gearbox ─────────────────────────────────────────────────────

/**
 * Get the total gear ratio (gear ratio × final drive).
 * @param gear - 1-indexed gear number (1 = first, etc.)
 * @param config - Gearbox config
 * @returns Total gear ratio
 */
export function totalGearRatio(gear: number, config: GearboxConfig = PHANTOM_GEARBOX): number {
  if (gear < 1 || gear > config.ratios.length) return 0;
  return config.ratios[gear - 1] * config.finalDrive;
}

/**
 * Calculate wheel torque from engine torque through gear train.
 * @param engineTorqueNm - Engine torque (N·m)
 * @param gear - Current gear (1-indexed)
 * @param config - Gearbox config
 * @returns Wheel torque (N·m)
 */
export function wheelTorque(
  engineTorqueNm: number,
  gear: number,
  config: GearboxConfig = PHANTOM_GEARBOX
): number {
  const ratio = totalGearRatio(gear, config);
  return engineTorqueNm * ratio * config.efficiency;
}

/**
 * Calculate engine RPM from wheel angular speed and gear.
 * @param wheelOmega - Wheel angular speed (rad/s)
 * @param gear - Current gear (1-indexed)
 * @param config - Gearbox config
 * @returns Engine RPM
 */
export function engineRpmFromWheelSpeed(
  wheelOmega: number,
  gear: number,
  config: GearboxConfig = PHANTOM_GEARBOX
): number {
  const ratio = totalGearRatio(gear, config);
  if (ratio === 0) return 0;
  const engineRadS = wheelOmega * ratio;
  return radSToRpm(engineRadS);
}

// ─── Clutch ──────────────────────────────────────────────────────

/**
 * Compute clutch engagement factor (0 = fully slipping, 1 = fully locked).
 * @param slipSpeed - Speed difference between engine and gearbox input (rad/s)
 * @param config - Clutch config
 * @returns Engagement factor [0, 1]
 */
export function clutchEngagement(
  slipSpeed: number,
  config: ClutchConfig = PHANTOM_CLUTCH
): number {
  const absSlip = Math.abs(slipSpeed);
  if (absSlip <= 0) return 1.0;
  if (absSlip >= config.engagementSpeed) return 0.0;
  // Linear ramp: fully engaged at 0 slip, fully slipping at engagementSpeed
  return 1.0 - (absSlip / config.engagementSpeed);
}

/**
 * Compute torque transferred through clutch.
 * @param engineTorqueNm - Engine torque (N·m)
 * @param slipSpeed - Engine-gearbox speed difference (rad/s)
 * @param config - Clutch config
 * @returns Transferred torque (N·m)
 */
export function clutchTorque(
  engineTorqueNm: number,
  slipSpeed: number,
  config: ClutchConfig = PHANTOM_CLUTCH
): number {
  const engagement = clutchEngagement(slipSpeed, config);
  const maxTransfer = Math.min(Math.abs(engineTorqueNm), config.maxTransferTorque);
  return maxTransfer * engagement * Math.sign(engineTorqueNm || 1);
}

// ─── Differential ────────────────────────────────────────────────

/**
 * Compute torque to each driven wheel from diff.
 * @param totalWheelTorque - Total torque from gearbox (N·m)
 * @param speedDiffRadS - Speed difference between left and right wheel (rad/s)
 * @param config - Differential config
 * @returns { left, right } torque in N·m
 */
export function differentialTorque(
  totalWheelTorque: number,
  speedDiffRadS: number,
  config: DifferentialConfig = PHANTOM_DIFF
): { left: number; right: number } {
  // Open diff: 50/50 split
  const half = totalWheelTorque / 2;

  // Locking torque: transfers torque from faster to slower wheel
  const lockTorque = config.lockingCoeff * Math.abs(speedDiffRadS) * 50; // 50 N·m per rad/s
  const clampedLock = Math.min(lockTorque, Math.abs(half));

  // Sign: positive speedDiff means right faster than left
  const transfer = speedDiffRadS > 0 ? clampedLock : -clampedLock;

  return {
    left: half + transfer,
    right: half - transfer,
  };
}

// ─── Convenience: Full Drivetrain ────────────────────────────────

export interface DrivetrainState {
  rpm: number;
  gear: number;
  clutchSlipSpeed: number;
  wheelSpeedLeft: number;  // rad/s
  wheelSpeedRight: number; // rad/s
  throttle: number; // 0-1
}

export interface DrivetrainOutput {
  engineTorqueNm: number;
  clutchedTorque: number;
  totalWheelTorque: number;
  leftWheelTorque: number;
  rightWheelTorque: number;
}

/**
 * Full drivetrain calculation: throttle → wheel torques.
 */
export function calcDrivetrain(
  state: DrivetrainState,
  engineConfig: EngineConfig = PHANTOM_ENGINE,
  gearboxConfig: GearboxConfig = PHANTOM_GEARBOX,
  clutchConfig: ClutchConfig = PHANTOM_CLUTCH,
  diffConfig: DifferentialConfig = PHANTOM_DIFF
): DrivetrainOutput {
  // 1. Engine torque at current RPM, scaled by throttle
  const rawTorque = engineTorque(state.rpm, engineConfig) * state.throttle;

  // 2. Clutch: slip reduces transferred torque
  const clutchedTorque = clutchTorque(rawTorque, state.clutchSlipSpeed, clutchConfig);

  // 3. Gearbox: multiply by ratio
  const totalWheelTorqueNm = wheelTorque(clutchedTorque, state.gear, gearboxConfig);

  // 4. Differential: split between wheels
  const speedDiff = state.wheelSpeedRight - state.wheelSpeedLeft;
  const { left, right } = differentialTorque(totalWheelTorqueNm, speedDiff, diffConfig);

  return {
    engineTorqueNm: rawTorque,
    clutchedTorque,
    totalWheelTorque: totalWheelTorqueNm,
    leftWheelTorque: left,
    rightWheelTorque: right,
  };
}
