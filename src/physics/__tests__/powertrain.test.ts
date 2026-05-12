import { describe, it, expect } from 'vitest';
import {
  engineTorque,
  wheelTorque,
  totalGearRatio,
  clutchEngagement,
  clutchTorque,
  differentialTorque,
  rpmToRadS,
  radSToRpm,
  engineRpmFromWheelSpeed,
  PHANTOM_ENGINE,
  PHANTOM_GEARBOX,
  PHANTOM_CLUTCH,
} from '../powertrain';

describe('Powertrain', () => {
  describe('engineTorque', () => {
    it('produces zero torque at zero RPM', () => {
      expect(engineTorque(0)).toBe(0);
    });

    it('produces zero torque above redline', () => {
      expect(engineTorque(PHANTOM_ENGINE.redlineRpm + 100)).toBe(0);
    });

    it('is RPM-dependent (different RPMs → different torque)', () => {
      const t1000 = engineTorque(1000);
      const t3000 = engineTorque(3000);
      const t5000 = engineTorque(5000);
      // All different
      expect(t1000).not.toBeCloseTo(t3000, 0);
      expect(t3000).not.toBeCloseTo(t5000, 0);
    });

    it('peaks near peakTorqueRpm', () => {
      let peakRpm = 0;
      let peakTorque = 0;
      for (let rpm = 1000; rpm <= 7000; rpm += 100) {
        const t = engineTorque(rpm);
        if (t > peakTorque) {
          peakTorque = t;
          peakRpm = rpm;
        }
      }
      // Peak should be within ±1000 RPM of peakTorqueRpm
      expect(peakRpm).toBeGreaterThanOrEqual(PHANTOM_ENGINE.peakTorqueRpm - 1000);
      expect(peakRpm).toBeLessThanOrEqual(PHANTOM_ENGINE.peakTorqueRpm + 1000);
      expect(peakTorque).toBeCloseTo(PHANTOM_ENGINE.maxTorqueNm, 0);
    });

    it('never exceeds max torque', () => {
      for (let rpm = 0; rpm <= 8000; rpm += 100) {
        expect(engineTorque(rpm)).toBeLessThanOrEqual(PHANTOM_ENGINE.maxTorqueNm + 1);
      }
    });

    it('torque at idle is positive', () => {
      expect(engineTorque(PHANTOM_ENGINE.idleRpm)).toBeGreaterThan(0);
    });
  });

  describe('RPM / angular velocity conversion', () => {
    it('converts RPM to rad/s', () => {
      const radS = rpmToRadS(60);
      expect(radS).toBeCloseTo(2 * Math.PI, 4);
    });

    it('converts rad/s to RPM', () => {
      const rpm = radSToRpm(2 * Math.PI);
      expect(rpm).toBeCloseTo(60, 4);
    });

    it('round-trips correctly', () => {
      const original = 4500;
      expect(radSToRpm(rpmToRadS(original))).toBeCloseTo(original, 4);
    });
  });

  describe('gearbox', () => {
    it('first gear has highest ratio', () => {
      const r1 = totalGearRatio(1);
      const r2 = totalGearRatio(2);
      const r3 = totalGearRatio(3);
      expect(r1).toBeGreaterThan(r2);
      expect(r2).toBeGreaterThan(r3);
    });

    it('gear shifts change effective wheel torque', () => {
      const torque = 300; // N·m engine torque
      const t1 = wheelTorque(torque, 1);
      const t2 = wheelTorque(torque, 2);
      const t3 = wheelTorque(torque, 3);
      // Lower gear = more torque multiplication
      expect(t1).toBeGreaterThan(t2);
      expect(t2).toBeGreaterThan(t3);
    });

    it('wheel torque is engine torque × gear ratio × efficiency', () => {
      const engineNm = 400;
      const gear = 2;
      const expected =
        engineNm * PHANTOM_GEARBOX.ratios[gear - 1] * PHANTOM_GEARBOX.finalDrive * PHANTOM_GEARBOX.efficiency;
      expect(wheelTorque(engineNm, gear)).toBeCloseTo(expected, 1);
    });

    it('gear 0 or invalid returns 0 wheel torque', () => {
      expect(wheelTorque(400, 0)).toBe(0);
      expect(wheelTorque(400, 10)).toBe(0);
    });

    it('engine RPM from wheel speed increases in lower gear', () => {
      const omega = 50; // rad/s wheel speed
      const rpm1 = engineRpmFromWheelSpeed(omega, 1);
      const rpm3 = engineRpmFromWheelSpeed(omega, 3);
      expect(rpm1).toBeGreaterThan(rpm3);
    });
  });

  describe('clutch', () => {
    it('fully engaged at zero slip', () => {
      expect(clutchEngagement(0)).toBeCloseTo(1.0, 4);
    });

    it('fully slipping at or above engagement speed', () => {
      expect(clutchEngagement(PHANTOM_CLUTCH.engagementSpeed)).toBeCloseTo(0, 4);
      expect(clutchEngagement(PHANTOM_CLUTCH.engagementSpeed * 2)).toBeCloseTo(0, 4);
    });

    it('linearly decreases between 0 and engagement speed', () => {
      const half = clutchEngagement(PHANTOM_CLUTCH.engagementSpeed / 2);
      expect(half).toBeCloseTo(0.5, 4);
    });

    it('clutch slip reduces transferred torque', () => {
      const engineNm = 400;
      const noSlip = clutchTorque(engineNm, 0);
      const slipping = clutchTorque(engineNm, PHANTOM_CLUTCH.engagementSpeed / 2);
      expect(noSlip).toBeGreaterThan(slipping);
    });

    it('fully slipping clutch transfers near-zero torque', () => {
      const transferred = clutchTorque(400, PHANTOM_CLUTCH.engagementSpeed * 10);
      expect(transferred).toBeCloseTo(0, 1);
    });

    it('clutch limits to maxTransferTorque', () => {
      // Even if engine produces more, clutch caps it
      const veryHighTorque = PHANTOM_CLUTCH.maxTransferTorque * 3;
      const transferred = clutchTorque(veryHighTorque, 0);
      expect(transferred).toBeLessThanOrEqual(PHANTOM_CLUTCH.maxTransferTorque + 1);
    });
  });

  describe('differential', () => {
    it('splits torque 50/50 with no speed difference (open diff)', () => {
      const { left, right } = differentialTorque(600, 0);
      expect(left).toBeCloseTo(300, 1);
      expect(right).toBeCloseTo(300, 1);
    });

    it('transfers torque to slower wheel under locking', () => {
      // Right wheel faster → left gets more torque
      const { left, right } = differentialTorque(600, 5);
      expect(left).toBeGreaterThan(right);
    });

    it('total torque is conserved', () => {
      const total = 500;
      const { left, right } = differentialTorque(total, 3);
      expect(left + right).toBeCloseTo(total, 1);
    });

    it('symmetric at zero speed diff', () => {
      const { left, right } = differentialTorque(400, 0);
      expect(left).toBeCloseTo(right, 4);
    });
  });
});
