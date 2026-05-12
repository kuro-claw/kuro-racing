import { describe, it, expect } from 'vitest';

// ─── Pacejka Magic Formula Reference Implementation ─────────────
// Produces realistic tire behavior for a typical road tire:
//   - Lateral force peaks at ~8-10° slip angle then drops
//   - Longitudinal force peaks at ~12-18% slip ratio then drops
//   - Non-linear load sensitivity (roughly √ dependency)
//   - Correct sign: positive input → positive output
//   - Combined slip reduces both forces via loading factor

const DEG_TO_RAD = Math.PI / 180;

interface PacejkaParams {
  B: number; // stiffness
  C: number; // shape
  D: number; // peak amplitude
  E: number; // curvature
}

// ─── Lateral (slip angle in radians) ───────────────────────────
// Peak at ~9° (0.157 rad). B=7.5, C=1.1, E=0.75 → peak at Bx~1.0
// so x_peak ≈ 1/7.5 ≈ 0.133 rad ≈ 7.6°... but E shifts it up.
// Empirical tuning: B=6.0, C=1.2, E=0.8 → peak ~9°

function calcLateralCoeffs(load: number): PacejkaParams {
  // Peak force scales sub-linearly with load (roughly √ dependency)
  const D = 10.0 * Math.sqrt(load);

  // B stiffens very slightly with load
  const B = 6.0 * Math.pow(load / 4000, 0.1);
  const C = 1.2;
  const E = 0.8;

  return { B, C, D, E };
}

// ─── Longitudinal (slip ratio, 0-0.3 range) ────────────────────
// Peak at ~0.15 slip ratio. B=7.0, C=1.2, E=0.7 → peak at Bx~1.0
// so x_peak ≈ 1/7.0 ≈ 0.143, E shifts it up a bit to ~0.15

function calcLongitudinalCoeffs(load: number): PacejkaParams {
  // Peak force scales sub-linearly with load (roughly √ dependency)
  const D = 10.0 * Math.sqrt(load);

  const B = 7.0 * Math.pow(load / 4000, 0.1);
  const C = 1.2;
  const E = 0.7;

  return { B, C, D, E };
}

// ─── Core Magic Formula ────────────────────────────────────────

function magicFormula(x: number, p: PacejkaParams): number {
  const { B, C, D, E } = p;
  const Bx = B * x;
  return D * Math.sin(C * (Math.atan(Bx) - E * (Bx - Math.atan(Bx))));
}

/**
 * Lateral force from slip angle (degrees).
 */
function lateralForce(slipAngleDeg: number, load: number): number {
  const x = slipAngleDeg * DEG_TO_RAD;
  return magicFormula(x, calcLateralCoeffs(load));
}

/**
 * Longitudinal force from slip ratio.
 */
function longitudinalForce(slipRatio: number, load: number): number {
  return magicFormula(slipRatio, calcLongitudinalCoeffs(load));
}

/**
 * Combined slip: loading factor reduces each component.
 */
function combinedForce(
  slipAngleDeg: number,
  slipRatio: number,
  load: number
): { lateral: number; longitudinal: number } {
  const FyPure = lateralForce(slipAngleDeg, load);
  const FxPure = longitudinalForce(slipRatio, load);

  // Find each axis's peak for normalization
  const FyMax = lateralForce(9, load); // near-peak reference
  const FxMax = longitudinalForce(0.15, load); // near-peak reference

  const fyRatio = Math.abs(FyPure) / Math.abs(FyMax);
  const fxRatio = Math.abs(FxPure) / Math.abs(FxMax);

  const loadFactorY = 1 / Math.sqrt(1 + fxRatio * fxRatio);
  const loadFactorX = 1 / Math.sqrt(1 + fyRatio * fyRatio);

  return {
    lateral: FyPure * loadFactorY,
    longitudinal: FxPure * loadFactorX,
  };
}

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
      // Find actual peak first
      let peakAngle = 0;
      let peakForce = 0;
      for (let angle = 0; angle <= 25; angle += 0.25) {
        const fy = lateralForce(angle, load);
        if (fy > peakForce) {
          peakForce = fy;
          peakAngle = angle;
        }
      }
      // Force at 2× the peak angle should be lower
      const at2xPeak = lateralForce(peakAngle * 2, load);
      expect(at2xPeak).toBeLessThan(peakForce);
    });

    it('scales with load (more load = more grip, but non-linear)', () => {
      const fy3000 = lateralForce(5, 3000);
      const fy4000 = lateralForce(5, 4000);
      const fy6000 = lateralForce(5, 6000);

      expect(fy4000).toBeGreaterThan(fy3000);
      expect(fy6000).toBeGreaterThan(fy4000);

      // Non-linear: doubling load does NOT double grip (sub-linear)
      const ratio4k_3k = fy4000 / fy3000;
      expect(ratio4k_3k).toBeLessThan(4000 / 3000);
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
      // Find actual peak first
      let peakRatio = 0;
      let peakForce = 0;
      for (let ratio = 0; ratio <= 0.3; ratio += 0.005) {
        const fx = longitudinalForce(ratio, load);
        if (fx > peakForce) {
          peakForce = fx;
          peakRatio = ratio;
        }
      }
      // Force at 2× the peak ratio should be lower
      const at2xPeak = longitudinalForce(peakRatio * 2, load);
      expect(at2xPeak).toBeLessThan(peakForce);
    });

    it('scales with load', () => {
      const fx3000 = longitudinalForce(0.1, 3000);
      const fx6000 = longitudinalForce(0.1, 6000);
      expect(fx6000).toBeGreaterThan(fx3000);
    });
  });

  describe('combinedForce', () => {
    it('reduces both forces under combined slip', () => {
      const load = 4000;
      const pure = lateralForce(5, load);
      const combined = combinedForce(5, 0.1, load);

      expect(Math.abs(combined.lateral)).toBeLessThan(Math.abs(pure));
      expect(Math.abs(combined.longitudinal)).toBeLessThan(
        Math.abs(longitudinalForce(0.1, load))
      );
    });

    it('returns zero for both when slip is zero', () => {
      const result = combinedForce(0, 0, 4000);
      expect(result.lateral).toBeCloseTo(0, 3);
      expect(result.longitudinal).toBeCloseTo(0, 3);
    });

    it('loading factor reduces grip as other axis demand increases', () => {
      const load = 4000;

      // Light longitudinal slip → mild reduction in lateral
      const mild = combinedForce(5, 0.05, load);

      // Heavy longitudinal slip → stronger reduction in lateral
      const heavy = combinedForce(5, 0.2, load);

      expect(Math.abs(mild.lateral)).toBeGreaterThan(Math.abs(heavy.lateral));
    });
  });
});
