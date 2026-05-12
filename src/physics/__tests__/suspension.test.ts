import { describe, it, expect } from 'vitest';
import {
  springForce,
  dampingForce,
  suspensionForce,
  DEFAULT_SUSPENSION,
} from '../suspension';
import {
  lateralLoadTransfer,
  longitudinalLoadTransfer,
  antiRollBarForce,
  staticWheelLoads,
  PHANTOM_CHASSIS,
  PHANTOM_ARB_FRONT,
} from '../chassis';

describe('Suspension Model', () => {
  const suspensionConfig = DEFAULT_SUSPENSION;
  const vehicleConfig = PHANTOM_CHASSIS;
  const arbConfig = PHANTOM_ARB_FRONT;

  describe('spring force', () => {
    it('follows Hooke law: F = -k * displacement', () => {
      const displacement = 0.05;
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
      const expected =
        springForce(0.05, suspensionConfig.springRate) +
        dampingForce(0.3, suspensionConfig.compressionDamping, suspensionConfig.reboundDamping);
      expect(force).toBeCloseTo(expected, 5);
    });

    it('net force opposes displacement + velocity in compression', () => {
      const force = suspensionForce(0.05, 0.3, suspensionConfig);
      expect(force).toBeLessThan(0);
    });
  });

  describe('lateral load transfer', () => {
    it('moves weight to outside wheels during cornering', () => {
      const transfer = lateralLoadTransfer(5, vehicleConfig);
      expect(transfer).toBeGreaterThan(0);
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
      expect(lateralLoadTransfer(5, highCG)).toBeGreaterThan(lateralLoadTransfer(5, lowCG));
    });

    it('wider track reduces load transfer', () => {
      const narrow = { ...vehicleConfig, trackWidth: 1.3 };
      const wide = { ...vehicleConfig, trackWidth: 1.7 };
      expect(lateralLoadTransfer(5, wide)).toBeLessThan(lateralLoadTransfer(5, narrow));
    });
  });

  describe('longitudinal load transfer', () => {
    it('braking shifts weight forward', () => {
      const transfer = longitudinalLoadTransfer(-5, vehicleConfig);
      expect(transfer).toBeLessThan(0);
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
      const force = antiRollBarForce(0.02, arbConfig);
      expect(force).toBeGreaterThan(0);
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
      expect(total).toBeCloseTo(vehicleConfig.mass * 9.81, 0);
    });

    it('front load matches weight distribution', () => {
      const loads = staticWheelLoads(vehicleConfig);
      const expectedFront = vehicleConfig.mass * 9.81 * vehicleConfig.weightDistributionFront;
      expect(loads.front).toBeCloseTo(expectedFront, 0);
    });

    it('50/50 distribution splits weight equally', () => {
      const balanced = { ...vehicleConfig, weightDistributionFront: 0.5 };
      const loads = staticWheelLoads(balanced);
      expect(loads.front).toBeCloseTo(loads.rear, 0);
    });
  });
});
