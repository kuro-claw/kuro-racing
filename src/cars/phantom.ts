// ─── Phantom — Sports Car Configuration ─────────────────────────
// KR-010: Phantom car config (~400hp, RWD, 1400kg).
// KR-019: Extended with powertrain sub-configs for config-driven physics.

import type { VehicleConfig } from '../physics/vehicle';
import { Vector3 } from '@babylonjs/core';
import {
  PHANTOM_ENGINE,
  PHANTOM_GEARBOX,
  PHANTOM_CLUTCH,
  PHANTOM_DIFF,
} from '../physics/powertrain';
import { PHANTOM_AERO } from '../physics/aero';

// Wheel positions relative to vehicle center (in local space)
// +X = right, +Y = up, +Z = forward
const WHEELBASE = 2.6;   // m
const TRACK_HALF = 0.75; // m (1.5m track / 2)
const WHEEL_HEIGHT = -0.35; // m below CG

export const PHANTOM_CONFIG: VehicleConfig = {
  mass: 1400,              // kg
  cgHeight: 0.45,          // m
  trackWidth: 1.5,         // m
  wheelbase: WHEELBASE,    // m
  weightDistributionFront: 0.55,
  maxSteerAngle: 0.52,     // ~30 degrees in radians
  steerSpeed: 2.5,         // rad/s

  wheels: [
    {
      // Front Left
      position: new Vector3(-TRACK_HALF, WHEEL_HEIGHT, WHEELBASE / 2),
      radius: 0.33,
      driven: false, // RWD — front wheels not driven
      steered: true,
    },
    {
      // Front Right
      position: new Vector3(TRACK_HALF, WHEEL_HEIGHT, WHEELBASE / 2),
      radius: 0.33,
      driven: false,
      steered: true,
    },
    {
      // Rear Left
      position: new Vector3(-TRACK_HALF, WHEEL_HEIGHT, -WHEELBASE / 2),
      radius: 0.33,
      driven: true, // RWD
      steered: false,
    },
    {
      // Rear Right
      position: new Vector3(TRACK_HALF, WHEEL_HEIGHT, -WHEELBASE / 2),
      radius: 0.33,
      driven: true,
      steered: false,
    },
  ],

  // Powertrain sub-configs
  engine: PHANTOM_ENGINE,
  gearbox: PHANTOM_GEARBOX,
  clutch: PHANTOM_CLUTCH,
  diff: PHANTOM_DIFF,
  aero: PHANTOM_AERO,
};

// Named export alias
export const Phantom = PHANTOM_CONFIG;
