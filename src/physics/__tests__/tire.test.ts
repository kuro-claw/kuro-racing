import { describe, it, expect } from 'vitest';
import {
  lateralForce,
  longitudinalForce,
  combinedForce,
} from '../tire';

// ─── Tests ──────────────────────────────────────────────────────

describe('Tire Model', () => {
  describe('lateralForce', () => {
    it('returns near-zero force at zero slip angle', () => {
      const fy = lateralForce(0, 4000);
      expect(fy).toBeCloseTo(0, 3);
    });

    it('returns positive force for positive slip angle', () => {
      const fy = lateralForce(5, 4000);
      expect(fy).toBeGreaterThan(0);
    });

    it('returns negative force for negative slip angle', () => {
      const fy = lateralForce(-5, 4000);
      expect(fy).toBeLessThan(0);
    });

    it('peaks at moderate slip angle (8-12 degrees)', () => {
      const load = 4000;
      let peakAngle = 0;
      let peakForce = 0;

      for (let angle = 0; angle <= 25; angle += 0.25) {
        const fy = lateralForce(angle, load);
        if (fy > peakForce) {
          peakForce = fy;
          peakAngle = angle;
        }
      }

      expect(peakAngle).toBeGreaterThanOrEqual(8);
      expect(peakAngle).toBeLessThanOrEqual(12);
    });

    it('drops after peak slip angle', () => {
      const load = 4000;
      let peakAngle = 0;
      let peakForce = 0;
      for (let angle = 0; angle <= 25; angle += 0.5) {
        const fy = lateralForce(angle, load);
        if (fy > peakForce) {
          peakForce = fy;
          peakAngle = angle;
        }
      }
      const postPeak = lateralForce(peakAngle + 8, load);
      expect(postPeak).toBeLessThan(peakForce);
    });

    it('scales with load (more load = more grip, but non-linear)', () => {
      const fy3000 = lateralForce(2, 3000);
      const fy4000 = lateralForce(2, 4000);
      const fy6000 = lateralForce(2, 6000);

      expect(fy4000).toBeGreaterThan(fy3000);
      expect(fy6000).toBeGreaterThan(fy4000);

      const ratio6k_3k = fy6000 / fy3000;
      expect(ratio6k_3k).toBeGreaterThan(1);
      expect(ratio6k_3k).toBeLessThan(2);
    });
  });

  describe('longitudinalForce', () => {
    it('returns near-zero force at zero slip ratio', () => {
      const fx = longitudinalForce(0, 4000);
      expect(fx).toBeCloseTo(0, 3);
    });

    it('returns positive force for positive slip ratio (braking)', () => {
      const fx = longitudinalForce(0.1, 4000);
      expect(fx).toBeGreaterThan(0);
    });

    it('returns negative force for negative slip ratio (driving)', () => {
      const fx = longitudinalForce(-0.1, 4000);
      expect(fx).toBeLessThan(0);
    });

    it('peaks at moderate slip ratio (10-20%)', () => {
      const load = 4000;
      let peakRatio = 0;
      let peakForce = 0;

      for (let ratio = 0; ratio <= 0.3; ratio += 0.005) {
        const fx = longitudinalForce(ratio, load);
        if (fx > peakForce) {
          peakForce = fx;
          peakRatio = ratio;
        }
      }

      expect(peakRatio).toBeGreaterThanOrEqual(0.08);
      expect(peakRatio).toBeLessThanOrEqual(0.20);
    });

    it('drops after peak slip ratio (wheel lockup)', () => {
      const load = 4000;
      let peakRatio = 0;
      let peakForce = 0;
      for (let ratio = 0; ratio <= 0.3; ratio += 0.005) {
        const fx = longitudinalForce(ratio, load);
        if (fx > peakForce) {
          peakForce = fx;
          peakRatio = ratio;
        }
      }
      const locked = longitudinalForce(Math.min(peakRatio + 0.1, 0.3), load);
      expect(locked).toBeLessThan(peakForce);
    });

    it('scales with load', () => {
      const fx3000 = longitudinalForce(0.05, 3000);
      const fx6000 = longitudinalForce(0.05, 6000);
      expect(fx6000).toBeGreaterThan(fx3000);
    });
  });

  describe('combinedForce', () => {
    it('reduces both forces under combined slip', () => {
      const load = 4000;
      const pure = lateralForce(3, load);
      const combined = combinedForce(3, 0.05, load);

      expect(Math.abs(combined.lateral)).toBeLessThan(Math.abs(pure));
      expect(Math.abs(combined.longitudinal)).toBeLessThan(
        Math.abs(longitudinalForce(0.05, load))
      );
    });

    it('returns zero for both when slip is zero', () => {
      const result = combinedForce(0, 0, 4000);
      expect(result.lateral).toBeCloseTo(0, 3);
      expect(result.longitudinal).toBeCloseTo(0, 3);
    });

    it('loading factor reduces grip as other axis demand increases', () => {
      const load = 4000;

      const mild = combinedForce(3, 0.03, load);
      const heavy = combinedForce(3, 0.15, load);

      expect(Math.abs(mild.lateral)).toBeGreaterThan(Math.abs(heavy.lateral));
    });
  });
});
