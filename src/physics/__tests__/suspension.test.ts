import { describe, it, expect } from 'vitest';

// ─── Suspension Model (Reference Implementation) ────────────────

interface SuspensionConfig {
  springRate: number; // N/m
  compressionDamping: number; // N/(m/s)
  reboundDamping: number; // N/(m/s)
  restLength: number; // m
}

interface AntiRollBarConfig {
  stiffness: number; // N·m/rad
  leverRatio: number; // moment arm ratio
}

interface VehicleConfig {
  mass: number; // kg
  cgHeight: number; // m (above roll axis)
  trackWidth: number; // m (left-right distance between wheel contact patches)
  wheelbase: number; // m
  weightDistributionFront: number; // fraction (0.45 = 45% front)
}

const GRAVITY = 9.81;

/**
 * Spring force: F = -k * displacement
 * Positive displacement = compression (spring pushes back up)
 */
function springForce(displacement: number, springRate: number): number {
  if (displacement === 0) return 0;
  return -springRate * displacement;
}

/**
 * Damping force: F = -c * velocity
 * Compression (body moving down, shock extending): use compressionDamping
 * Rebound (body moving up, shock compressing): use reboundDamping
 */
function dampingForce(
  velocity: number,
  compressionDamping: number,
  reboundDamping: number
): number {
  if (velocity === 0) return 0;
  if (velocity > 0) {
    // Body moving downward → shock extending → compression damping
    return -compressionDamping * velocity;
  } else {
    // Body moving upward → shock compressing → rebound damping
    return -reboundDamping * velocity;
  }
}

/**
 * Total suspension force from one shock.
 */
function suspensionForce(
  displacement: number,
  velocity: number,
  config: SuspensionConfig
): number {
  const fSpring = springForce(displacement, config.springRate);
  const fDamp = dampingForce(velocity, config.compressionDamping, config.reboundDamping);
  return fSpring + fDamp;
}

/**
 * Lateral load transfer:
 * ΔF = (lateralAccel * cgHeight * mass) / (2 * trackWidth)
 * Positive = weight shifts to outside wheels.
 */
function lateralLoadTransfer(
  lateralAccel: number,
  config: VehicleConfig
): number {
  return (lateralAccel * config.cgHeight * config.mass) / (2 * config.trackWidth);
}

/**
 * Longitudinal load transfer:
 * ΔF = (longAccel * cgHeight * mass) / (2 * wheelbase)
 * Braking (longAccel > 0) → weight shifts front
 * Acceleration (longAccel < 0) → weight shifts rear
 */
function longitudinalLoadTransfer(
  longAccel: number,
  config: VehicleConfig
): number {
  return (longAccel * config.cgHeight * config.mass) / (2 * config.wheelbase);
}

/**
 * Anti-roll bar: transfers force between inner and outer wheels.
 * F_transfer = (stiffness * rollAngle) / leverRatio
 */
function antiRollBarForce(
  rollAngle: number,
  config: AntiRollBarConfig
): number {
  return (config.stiffness * rollAngle) / config.leverRatio;
}

/**
 * Calculate static wheel loads.
 */
function staticWheelLoads(config: VehicleConfig): { front: number; rear: number } {
  const totalWeight = config.mass * GRAVITY;
  const front = totalWeight * config.weightDistributionFront;
  const rear = totalWeight * (1 - config.weightDistributionFront);
  return { front, rear };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('Suspension Model', () => {
  const suspensionConfig: SuspensionConfig = {
    springRate: 30000, // N/m — typical sport sedan front
    compressionDamping: 3000,
    reboundDamping: 1200,
    restLength: 0.3,
  };

  const vehicleConfig: VehicleConfig = {
    mass: 1400,
    cgHeight: 0.45,
    trackWidth: 1.5,
    wheelbase: 2.6,
    weightDistributionFront: 0.55,
  };

  const arbConfig: AntiRollBarConfig = {
    stiffness: 4000,
    leverRatio: 2.5,
  };

  describe('spring force', () => {
    it('follows Hooke law: F = -k * displacement', () => {
      const displacement = 0.05; // 50mm compression
      const force = springForce(displacement, suspensionConfig.springRate);
      expect(force).toBe(-30000 * 0.05);
      expect(force).toBe(-1500);
    });

    it('returns zero at rest position', () => {
      expect(springForce(0, suspensionConfig.springRate)).toBeCloseTo(0, 10);
    });

    it('pushes back in opposite direction for rebound (negative displacement)', () => {
      const force = springForce(-0.03, suspensionConfig.springRate);
      expect(force).toBeGreaterThan(0);
      expect(force).toBe(900);
    });

    it('scales linearly with displacement', () => {
      const f1 = springForce(0.02, suspensionConfig.springRate);
      const f2 = springForce(0.04, suspensionConfig.springRate);
      expect(Math.abs(f2)).toBeCloseTo(Math.abs(f1) * 2, 5);
    });
  });

  describe('damping', () => {
    it('compression damping opposes downward velocity', () => {
      const force = dampingForce(0.5, 3000, 1200);
      expect(force).toBe(-3000 * 0.5);
      expect(force).toBe(-1500);
      expect(force).toBeLessThan(0);
    });

    it('rebound damping opposes upward velocity', () => {
      const force = dampingForce(-0.3, 3000, 1200);
      expect(force).toBe(-1200 * -0.3);
      expect(force).toBe(360);
      expect(force).toBeGreaterThan(0);
    });

    it('compression damping is typically stronger than rebound', () => {
      const vel = 0.5;
      const compForce = Math.abs(dampingForce(vel, 3000, 1200));
      const rebForce = Math.abs(dampingForce(-vel, 3000, 1200));
      expect(compForce).toBeGreaterThan(rebForce);
    });

    it('returns zero at zero velocity', () => {
      expect(dampingForce(0, 3000, 1200)).toBeCloseTo(0, 10);
    });
  });

  describe('combined suspension force', () => {
    it('combines spring and damping', () => {
      const force = suspensionForce(0.05, 0.3, suspensionConfig);
      const expected = springForce(0.05, suspensionConfig.springRate) +
        dampingForce(0.3, suspensionConfig.compressionDamping, suspensionConfig.reboundDamping);
      expect(force).toBeCloseTo(expected, 5);
    });

    it('net force opposes displacement + velocity in compression', () => {
      // Compressed 50mm, body still moving down
      const force = suspensionForce(0.05, 0.3, suspensionConfig);
      expect(force).toBeLessThan(0); // pushing back up
    });
  });

  describe('lateral load transfer', () => {
    it('moves weight to outside wheels during cornering', () => {
      const transfer = lateralLoadTransfer(5, vehicleConfig); // 0.5g lateral
      expect(transfer).toBeGreaterThan(0);

      // Expected: (5 * 0.45 * 1400) / (2 * 1.5) = 1050 N
      expect(transfer).toBeCloseTo(1050, 0);
    });

    it('negative lateral accel shifts weight to inside', () => {
      const transfer = lateralLoadTransfer(-5, vehicleConfig);
      expect(transfer).toBeLessThan(0);
    });

    it('zero lateral accel means no lateral transfer', () => {
      expect(lateralLoadTransfer(0, vehicleConfig)).toBeCloseTo(0, 10);
    });

    it('higher CG increases load transfer', () => {
      const lowCG = { ...vehicleConfig, cgHeight: 0.35 };
      const highCG = { ...vehicleConfig, cgHeight: 0.55 };
      expect(lateralLoadTransfer(5, highCG)).toBeGreaterThan(
        lateralLoadTransfer(5, lowCG)
      );
    });

    it('wider track reduces load transfer', () => {
      const narrow = { ...vehicleConfig, trackWidth: 1.3 };
      const wide = { ...vehicleConfig, trackWidth: 1.7 };
      expect(lateralLoadTransfer(5, wide)).toBeLessThan(
        lateralLoadTransfer(5, narrow)
      );
    });
  });

  describe('longitudinal load transfer', () => {
    it('braking shifts weight forward', () => {
      const transfer = longitudinalLoadTransfer(-5, vehicleConfig); // negative = deceleration
      expect(transfer).toBeLessThan(0); // weight moves to front

      // Expected: (-5 * 0.45 * 1400) / (2 * 2.6) = -605.77 N
      expect(transfer).toBeCloseTo(-605.77, 0);
    });

    it('acceleration shifts weight rearward', () => {
      const transfer = longitudinalLoadTransfer(5, vehicleConfig);
      expect(transfer).toBeGreaterThan(0);
    });

    it('zero acceleration means no longitudinal transfer', () => {
      expect(longitudinalLoadTransfer(0, vehicleConfig)).toBeCloseTo(0, 10);
    });

    it('higher CG increases longitudinal transfer', () => {
      const lowCG = { ...vehicleConfig, cgHeight: 0.35 };
      const highCG = { ...vehicleConfig, cgHeight: 0.55 };
      expect(Math.abs(longitudinalLoadTransfer(5, highCG))).toBeGreaterThan(
        Math.abs(longitudinalLoadTransfer(5, lowCG))
      );
    });

    it('longer wheelbase reduces longitudinal transfer', () => {
      const short = { ...vehicleConfig, wheelbase: 2.4 };
      const long = { ...vehicleConfig, wheelbase: 2.9 };
      expect(Math.abs(longitudinalLoadTransfer(5, long))).toBeLessThan(
        Math.abs(longitudinalLoadTransfer(5, short))
      );
    });
  });

  describe('anti-roll bar', () => {
    it('transfers load between inner and outer wheels', () => {
      const force = antiRollBarForce(0.02, arbConfig); // 0.02 rad ≈ 1.15°
      expect(force).toBeGreaterThan(0);

      // Expected: (4000 * 0.02) / 2.5 = 32 N
      expect(force).toBeCloseTo(32, 0);
    });

    it('zero roll angle means no ARB force', () => {
      expect(antiRollBarForce(0, arbConfig)).toBeCloseTo(0, 10);
    });

    it('stiffer ARB produces more transfer force', () => {
      const soft = antiRollBarForce(0.02, { stiffness: 2000, leverRatio: 2.5 });
      const stiff = antiRollBarForce(0.02, { stiffness: 6000, leverRatio: 2.5 });
      expect(stiff).toBeGreaterThan(soft);
    });

    it('larger lever ratio reduces effective transfer', () => {
      const short = antiRollBarForce(0.02, { stiffness: 4000, leverRatio: 1.5 });
      const long = antiRollBarForce(0.02, { stiffness: 4000, leverRatio: 3.5 });
      expect(short).toBeGreaterThan(long);
    });
  });

  describe('static wheel loads', () => {
    it('front + rear equals total weight', () => {
      const loads = staticWheelLoads(vehicleConfig);
      const total = loads.front + loads.rear;
      expect(total).toBeCloseTo(vehicleConfig.mass * GRAVITY, 0);
    });

    it('front load matches weight distribution', () => {
      const loads = staticWheelLoads(vehicleConfig);
      const expectedFront = vehicleConfig.mass * GRAVITY * vehicleConfig.weightDistributionFront;
      expect(loads.front).toBeCloseTo(expectedFront, 0);
    });

    it('50/50 distribution splits weight equally', () => {
      const balanced = { ...vehicleConfig, weightDistributionFront: 0.5 };
      const loads = staticWheelLoads(balanced);
      expect(loads.front).toBeCloseTo(loads.rear, 0);
    });
  });
});
