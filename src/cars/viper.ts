// ─── Viper — FWD Hot Hatch Configuration ──────────────────────────
// KR-019: Viper car config — lightweight FWD hot hatch (~280Nm peak, 8500 RPM).

import type { VehicleConfig } from '../physics/vehicle';
import type { EngineConfig, GearboxConfig, ClutchConfig, DifferentialConfig } from '../physics/powertrain';
import type { AeroConfig } from '../physics/aero';
import { Vector3 } from '@babylonjs/core';

// Wheel positions relative to vehicle center (in local space)
// +X = right, +Y = up, +Z = forward
const WHEELBASE = 2.4;    // m (shorter than Phantom)
const TRACK_HALF = 0.725; // m (1.45m track / 2)
const WHEEL_HEIGHT = -0.32; // m below CG

// ─── Powertrain ──────────────────────────────────────────────────

export const VIPER_ENGINE: EngineConfig = {
  idleRpm: 900,
  redlineRpm: 8500,
  maxTorqueNm: 280,    // N·m — smaller, rev-happy engine
  peakTorqueRpm: 6500,
  inertia: 0.10,       // lighter rotating mass
};

export const VIPER_GEARBOX: GearboxConfig = {
  ratios: [3.80, 2.30, 1.60, 1.20, 0.95, 0.80],
  finalDrive: 4.10,    // shorter overall ratio for more acceleration
  efficiency: 0.90,
};

export const VIPER_CLUTCH: ClutchConfig = {
  maxTransferTorque: 400,
  engagementSpeed: 4.0,
};

export const VIPER_DIFF: DifferentialConfig = {
  torqueSplit: 0.5,
  lockingCoeff: 0.4,   // slightly more locking for FWD
};

// ─── Aero ────────────────────────────────────────────────────────

export const VIPER_AERO: AeroConfig = {
  dragCoefficient: 0.32,
  frontalArea: 1.9,
  downforceCoefficient: 0.15,  // minimal aero — hot hatch
  wingArea: 0.8,               // small rear wing
  centerOfPressure: 0.60,      // rear-biased — only rear has wing
  airDensity: 1.225,
  wheelbase: WHEELBASE,
};

// ─── Viper Config ────────────────────────────────────────────────

export const VIPER_CONFIG: VehicleConfig = {
  mass: 1100,               // kg — lighter than Phantom
  cgHeight: 0.40,           // m — lower center of gravity
  trackWidth: 1.45,         // m
  wheelbase: WHEELBASE,     // m — shorter wheelbase
  weightDistributionFront: 0.60, // FWD bias
  maxSteerAngle: 0.48,      // rad — sharp steering
  steerSpeed: 3.0,          // rad/s — faster steering response

  wheels: [
    {
      // Front Left — driven (FWD) + steered
      position: new Vector3(-TRACK_HALF, WHEEL_HEIGHT, WHEELBASE / 2),
      radius: 0.30,
      driven: true,
      steered: true,
    },
    {
      // Front Right — driven (FWD) + steered
      position: new Vector3(TRACK_HALF, WHEEL_HEIGHT, WHEELBASE / 2),
      radius: 0.30,
      driven: true,
      steered: true,
    },
    {
      // Rear Left — NOT driven (FWD), NOT steered
      position: new Vector3(-TRACK_HALF, WHEEL_HEIGHT, -WHEELBASE / 2),
      radius: 0.30,
      driven: false,
      steered: false,
    },
    {
      // Rear Right — NOT driven (FWD), NOT steered
      position: new Vector3(TRACK_HALF, WHEEL_HEIGHT, -WHEELBASE / 2),
      radius: 0.30,
      driven: false,
      steered: false,
    },
  ],

  // Powertrain sub-configs
  engine: VIPER_ENGINE,
  gearbox: VIPER_GEARBOX,
  clutch: VIPER_CLUTCH,
  diff: VIPER_DIFF,
  aero: VIPER_AERO,
};

// Named export alias
export const Viper = VIPER_CONFIG;
