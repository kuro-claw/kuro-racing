// ─── Viper Config Tests ──────────────────────────────────────────
// KR-019: Verify Viper car configuration is correct for FWD hot hatch.

import { describe, it, expect } from 'vitest';
import { VIPER_CONFIG, VIPER_ENGINE, VIPER_GEARBOX, VIPER_CLUTCH, VIPER_DIFF, VIPER_AERO } from '../viper';

describe('Viper Config', () => {
  describe('Vehicle Config', () => {
    it('has correct mass (1100 kg)', () => {
      expect(VIPER_CONFIG.mass).toBe(1100);
    });

    it('has lower CG than a typical sports car (0.40m)', () => {
      expect(VIPER_CONFIG.cgHeight).toBe(0.40);
    });

    it('has 4 wheels configured', () => {
      expect(VIPER_CONFIG.wheels.length).toBe(4);
    });

    it('has FWD configuration — front wheels driven, rear wheels not', () => {
      // Front wheels (indices 0, 1) should be driven
      expect(VIPER_CONFIG.wheels[0].driven).toBe(true);
      expect(VIPER_CONFIG.wheels[1].driven).toBe(true);
      // Rear wheels (indices 2, 3) should NOT be driven
      expect(VIPER_CONFIG.wheels[2].driven).toBe(false);
      expect(VIPER_CONFIG.wheels[3].driven).toBe(false);
    });

    it('has FWD configuration — front wheels steered, rear wheels not', () => {
      expect(VIPER_CONFIG.wheels[0].steered).toBe(true);
      expect(VIPER_CONFIG.wheels[1].steered).toBe(true);
      expect(VIPER_CONFIG.wheels[2].steered).toBe(false);
      expect(VIPER_CONFIG.wheels[3].steered).toBe(false);
    });

    it('has FWD weight bias (0.60 front)', () => {
      expect(VIPER_CONFIG.weightDistributionFront).toBe(0.60);
    });

    it('has 6 gears in gearbox', () => {
      expect(VIPER_GEARBOX.ratios.length).toBe(6);
    });

    it('has shorter wheelbase than Phantom (2.4m)', () => {
      expect(VIPER_CONFIG.wheelbase).toBe(2.4);
    });

    it('has faster steering response (3.0 rad/s)', () => {
      expect(VIPER_CONFIG.steerSpeed).toBe(3.0);
    });

    it('has smaller wheels (0.30m radius)', () => {
      for (const wheel of VIPER_CONFIG.wheels) {
        expect(wheel.radius).toBe(0.30);
      }
    });
  });

  describe('Engine Config', () => {
    it('has higher redline than Phantom (8500 RPM)', () => {
      expect(VIPER_ENGINE.redlineRpm).toBe(8500);
    });

    it('has higher idle RPM (900)', () => {
      expect(VIPER_ENGINE.idleRpm).toBe(900);
    });

    it('has smaller peak torque (280 Nm)', () => {
      expect(VIPER_ENGINE.maxTorqueNm).toBe(280);
    });

    it('has high peak torque RPM (6500 — rev-happy)', () => {
      expect(VIPER_ENGINE.peakTorqueRpm).toBe(6500);
    });

    it('has lighter inertia (0.10 kg·m²)', () => {
      expect(VIPER_ENGINE.inertia).toBe(0.10);
    });
  });

  describe('Gearbox Config', () => {
    it('has close-ratio 6-speed gearbox', () => {
      expect(VIPER_GEARBOX.ratios).toEqual([3.80, 2.30, 1.60, 1.20, 0.95, 0.80]);
    });

    it('has shorter final drive (4.10)', () => {
      expect(VIPER_GEARBOX.finalDrive).toBe(4.10);
    });
  });

  describe('Differential Config', () => {
    it('has slightly more locking for FWD (0.4)', () => {
      expect(VIPER_DIFF.lockingCoeff).toBe(0.4);
    });
  });

  describe('Aero Config', () => {
    it('has minimal downforce (hot hatch)', () => {
      expect(VIPER_AERO.downforceCoefficient).toBe(0.15);
    });

    it('has rear-biased center of pressure (0.60)', () => {
      expect(VIPER_AERO.centerOfPressure).toBe(0.60);
    });
  });
});
