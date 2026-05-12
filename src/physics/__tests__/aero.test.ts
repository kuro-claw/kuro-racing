import { describe, it, expect } from 'vitest';
import {
  dragForce,
  downforce,
  downforceDistribution,
  aeroLoad,
  liftToDragRatio,
  PHANTOM_AERO,
} from '../aero';

describe('Aerodynamics', () => {
  describe('dragForce', () => {
    it('returns zero at zero speed', () => {
      expect(dragForce(0)).toBe(0);
    });

    it('increases with v² (double speed = 4× drag)', () => {
      const d30 = dragForce(30);
      const d60 = dragForce(60);
      expect(d60).toBeCloseTo(d30 * 4, 0);
    });

    it('is always positive (opposes motion)', () => {
      for (const speed of [10, 30, 60, 100]) {
        expect(dragForce(speed)).toBeGreaterThan(0);
      }
    });

    it('scales with drag coefficient', () => {
      const lowCd = { ...PHANTOM_AERO, dragCoefficient: 0.25 };
      const highCd = { ...PHANTOM_AERO, dragCoefficient: 0.45 };
      expect(dragForce(50, highCd)).toBeGreaterThan(dragForce(50, lowCd));
    });

    it('matches manual calculation Fd = 0.5ρv²CdA', () => {
      const speed = 50;
      const expected =
        0.5 * PHANTOM_AERO.airDensity * speed * speed *
        PHANTOM_AERO.dragCoefficient * PHANTOM_AERO.frontalArea;
      expect(dragForce(speed)).toBeCloseTo(expected, 1);
    });
  });

  describe('downforce', () => {
    it('returns zero at zero speed', () => {
      expect(downforce(0)).toBe(0);
    });

    it('increases with v² (double speed = 4× downforce)', () => {
      const df30 = downforce(30);
      const df60 = downforce(60);
      expect(df60).toBeCloseTo(df30 * 4, 0);
    });

    it('is always positive (pushes car into ground)', () => {
      for (const speed of [10, 30, 60, 100]) {
        expect(downforce(speed)).toBeGreaterThan(0);
      }
    });

    it('scales with downforce coefficient', () => {
      const lowCl = { ...PHANTOM_AERO, downforceCoefficient: 0.2 };
      const highCl = { ...PHANTOM_AERO, downforceCoefficient: 0.8 };
      expect(downforce(50, highCl)).toBeGreaterThan(downforce(50, lowCl));
    });

    it('matches manual calculation Fl = 0.5ρv²ClA', () => {
      const speed = 50;
      const expected =
        0.5 * PHANTOM_AERO.airDensity * speed * speed *
        PHANTOM_AERO.downforceCoefficient * PHANTOM_AERO.wingArea;
      expect(downforce(speed)).toBeCloseTo(expected, 1);
    });
  });

  describe('downforceDistribution', () => {
    it('front + rear equals total downforce', () => {
      const total = 500;
      const { front, rear } = downforceDistribution(total);
      expect(front + rear).toBeCloseTo(total, 4);
    });

    it('50/50 CoP splits evenly', () => {
      const balanced = { ...PHANTOM_AERO, centerOfPressure: 0.5 };
      const total = 600;
      const { front, rear } = downforceDistribution(total, balanced);
      expect(front).toBeCloseTo(rear, 4);
    });

    it('rear-biased CoP puts more load on rear', () => {
      const rearBiased = { ...PHANTOM_AERO, centerOfPressure: 0.7 };
      const total = 600;
      const { rear, front } = downforceDistribution(total, rearBiased);
      expect(rear).toBeGreaterThan(front);
    });
  });

  describe('aeroLoad', () => {
    it('higher speed = more grip (higher aero loads)', () => {
      const slow = aeroLoad(30);
      const fast = aeroLoad(60);
      expect(fast.frontLoad).toBeGreaterThan(slow.frontLoad);
      expect(fast.rearLoad).toBeGreaterThan(slow.rearLoad);
      expect(fast.totalDrag).toBeGreaterThan(slow.totalDrag);
    });

    it('returns all zeros at zero speed', () => {
      const result = aeroLoad(0);
      expect(result.totalDrag).toBe(0);
      expect(result.totalDownforce).toBe(0);
    });

    it('totalDownforce = frontLoad + rearLoad', () => {
      const result = aeroLoad(50);
      expect(result.frontLoad + result.rearLoad).toBeCloseTo(result.totalDownforce, 2);
    });
  });

  describe('liftToDragRatio', () => {
    it('returns a positive ratio', () => {
      expect(liftToDragRatio()).toBeGreaterThan(0);
    });

    it('higher Cl/Cd gives better L/D ratio', () => {
      const efficient = { ...PHANTOM_AERO, downforceCoefficient: 0.8, dragCoefficient: 0.25 };
      const inefficient = { ...PHANTOM_AERO, downforceCoefficient: 0.3, dragCoefficient: 0.50 };
      expect(liftToDragRatio(efficient)).toBeGreaterThan(liftToDragRatio(inefficient));
    });
  });
});
