// ─── Tire Model — Pacejka-Inspired Magic Formula ────────────────
// KR-006: Lateral force, longitudinal force, combined slip, load sensitivity.
// Pure math — no Babylon.js dependency.

export const DEG_TO_RAD = Math.PI / 180;

// ─── Pacejka Reference Constants ────────────────────────────────
// Stiffness factor: how fast force rises from zero slip
export const PACEJKA_STIFFNESS = 18.0;
// Shape factor (C): controls curve shape
export const PACEJKA_SHAPE = 1.2;
// Peak force coefficient: peak scales with √load
export const PACEJKA_PEAK_SCALE = 1.3;
// Curvature factor (E): controls post-peak dropoff
export const PACEJKA_CURVATURE = 0.5;
// B factor for both lateral and longitudinal
export const PACEJKA_B = 9.0;

// ─── Types ──────────────────────────────────────────────────────

export interface PacejkaCoeffs {
  B: number; // stiffness factor
  C: number; // shape factor
  D: number; // peak value
  E: number; // curvature factor
}

export interface CombinedForceResult {
  lateral: number;    // N
  longitudinal: number; // N
}

export interface TireConfig {
  peakScale: number;   // peak force coefficient (scales with √load)
  shapeC: number;      // shape factor C
  stiffnessB: number;  // stiffness factor B
  curvatureE: number;  // curvature factor E
}

export const DEFAULT_TIRE_CONFIG: TireConfig = {
  peakScale: PACEJKA_PEAK_SCALE,
  shapeC: PACEJKA_SHAPE,
  stiffnessB: PACEJKA_B,
  curvatureE: PACEJKA_CURVATURE,
};

// ─── Core Magic Formula ──────────────────────────────────────────

/**
 * Core Pacejka Magic Formula: y = D * sin(C * atan(B*x - E * (B*x - atan(B*x))))
 * Odd function: f(-x) = -f(x). Handles both positive and negative input.
 */
export function applyMagicFormula(
  x: number,
  B: number,
  C: number,
  D: number,
  E: number
): number {
  const Bx = B * x;
  const atanBx = Math.atan(Bx);
  const inner = C * (atanBx - E * (Bx - atanBx));
  return D * Math.sin(inner);
}

// ─── Coefficients from Vertical Load ────────────────────────────

/**
 * Compute Pacejka coefficients from vertical load (N).
 * D (peak value) scales with √load — non-linear load sensitivity.
 */
export function calcPacejkaCoeffs(
  load: number,
  config: TireConfig = DEFAULT_TIRE_CONFIG
): PacejkaCoeffs {
  const sqrtLoad = Math.sqrt(load);
  return {
    B: config.stiffnessB,
    C: config.shapeC,
    D: config.peakScale * sqrtLoad,
    E: config.curvatureE,
  };
}

// ─── Lateral Force ───────────────────────────────────────────────

/**
 * Lateral force (Fy) from slip angle.
 * @param slipAngleDeg - Slip angle in degrees (positive = positive force)
 * @param load - Vertical load (N)
 * @param config - Optional tire config (defaults to reference Pacejka set)
 * @returns Lateral force (N)
 */
export function lateralForce(
  slipAngleDeg: number,
  load: number,
  config: TireConfig = DEFAULT_TIRE_CONFIG
): number {
  const { B, C, D, E } = calcPacejkaCoeffs(load, config);
  const x = slipAngleDeg * DEG_TO_RAD;
  return applyMagicFormula(x, B, C, D, E);
}

// ─── Longitudinal Force ──────────────────────────────────────────

/**
 * Longitudinal force (Fx) from slip ratio.
 * @param slipRatio - Slip ratio (positive = braking, negative = driving)
 * @param load - Vertical load (N)
 * @param config - Optional tire config
 * @returns Longitudinal force (N)
 */
export function longitudinalForce(
  slipRatio: number,
  load: number,
  config: TireConfig = DEFAULT_TIRE_CONFIG
): number {
  const { B, C, D, E } = calcPacejkaCoeffs(load, config);
  return applyMagicFormula(slipRatio, B, C, D, E);
}

// ─── Combined Slip ───────────────────────────────────────────────

/**
 * Combined slip: distributes grip between lateral and longitudinal.
 * Uses friction circle concept — total force cannot exceed peak.
 * @param slipAngleDeg - Slip angle in degrees
 * @param slipRatio - Slip ratio
 * @param load - Vertical load (N)
 * @param config - Optional tire config
 */
export function combinedForce(
  slipAngleDeg: number,
  slipRatio: number,
  load: number,
  config: TireConfig = DEFAULT_TIRE_CONFIG
): CombinedForceResult {
  const FyPure = lateralForce(slipAngleDeg, load, config);
  const FxPure = longitudinalForce(slipRatio, load, config);

  const sqrtLoad = Math.sqrt(load);
  const FyMax = config.peakScale * sqrtLoad;
  const FxMax = config.peakScale * sqrtLoad;

  const fyRatio = Math.abs(FyPure) / FyMax;
  const fxRatio = Math.abs(FxPure) / FxMax;

  // Loading factor: reduces each component based on the other axis's demand
  const loadFactorY = 1 / Math.sqrt(1 + fxRatio * fxRatio);
  const loadFactorX = 1 / Math.sqrt(1 + fyRatio * fyRatio);

  return {
    lateral: FyPure * loadFactorY,
    longitudinal: FxPure * loadFactorX,
  };
}

// ─── Slip Angle Calculation ──────────────────────────────────────

/**
 * Calculate slip angle from forward and lateral velocity components.
 * @param vx - Forward velocity (m/s)
 * @param vy - Lateral velocity (m/s)
 * @returns Slip angle in degrees
 */
export function calcSlipAngle(vx: number, vy: number): number {
  if (Math.abs(vx) < 0.01) return 0;
  return Math.atan2(vy, Math.abs(vx)) * (180 / Math.PI);
}

/**
 * Calculate slip ratio from wheel speed and vehicle speed.
 * @param wheelSpeed - Wheel surface speed (m/s) = omega * radius
 * @param vehicleSpeed - Vehicle forward speed (m/s)
 * @returns Slip ratio (0 = no slip, +1 = full lockup)
 */
export function calcSlipRatio(wheelSpeed: number, vehicleSpeed: number): number {
  const refSpeed = Math.max(Math.abs(vehicleSpeed), Math.abs(wheelSpeed), 0.01);
  return (vehicleSpeed - wheelSpeed) / refSpeed;
}
