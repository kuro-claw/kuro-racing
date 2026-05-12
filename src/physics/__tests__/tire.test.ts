import { describe, it, expect } from 'vitest';

// ─── Pacejka Magic Formula Constants (reference set) ────────────
// Tuned for realistic tire behavior:
//   - Lateral force peaks at ~8-10° slip angle then drops
//   - Longitudinal force peaks at ~12-18% slip ratio then drops
//   - Non-linear load sensitivity (roughly √ dependency)
//   - Both forces have correct sign (positive input → positive output)
//
// The "modified" Magic Formula avoids sin() wrapping issues by using
// the y = D * sin(C * atan(B * x)) form for the primary curve,
// then applying a separate dropoff factor for post-peak behavior.

const PACEJKA = {
  // Stiffness factor — how fast force rises from zero slip
  stiffness: 18.0,
  // Shape factor — controls curve shape (1.0 = pure atan, >1.0 = sharper peak)
  shape: 1.2,
  // Peak force coefficient — peak scales with √load
  peakScale: 1.3,
  // Dropoff: where the peak occurs (in radians for lateral, ratio for longitudinal)
  // B parameter: stiffness factor for MF
  // We use the standard MF: y = D * sin(C * atan(B * x - E * (B * x - atan(B * x))))
  // but with carefully chosen B so that the peak falls in the desired range
};

const DEG_TO_RAD = Math.PI / 180;

// ─── Helper: Compute Pacejka coefficients from vertical load ────

function calcPacejkaCoeffs(
  load: number,
  isLateral: boolean
): { B: number; C: number; D: number; E: number } {
  const sqrtLoad = Math.sqrt(load);

  // D-type: peak value — scales with √load (non-linear load sensitivity)
  const D = PACEJKA.peakScale * sqrtLoad;

  // C-type: shape factor — constant
  const C = PACEJKA.shape;

  // E-type: curvature — controls post-peak dropoff
  const E = 0.5;

  if (isLateral) {
    // B=9 gives peak at ~9° slip angle with C=1.2, E=0.5
    const B = 9.0;
    return { B, C, D, E };
  } else {
    // B=9 gives peak at ~15.7% slip ratio with C=1.2, E=0.5
    const B = 9.0;
    return { B, C, D, E };
  }
}

// ─── Pacejka Magic Formula Implementation ───────────────────────

/**
 * Lateral force from slip angle (Pacejka "Magic Formula").
 * Fy = D * sin(C * (atan(B*x) - E * (B*x - atan(B*x))))
 * Positive slip angle → positive lateral force.
 */
function lateralForce(slipAngleDeg: number, load: number): number {
  const { B, C, D, E } = calcPacejkaCoeffs(load, true);
  const x = slipAngleDeg * DEG_TO_RAD;
  return applyMagicFormula(x, B, C, D, E);
}

/**
 * Longitudinal force from slip ratio.
 * slipRatio: positive = braking (force forward), negative = driving (force backward)
 */
function longitudinalForce(slipRatio: number, load: number): number {
  const { B, C, D, E } = calcPacejkaCoeffs(load, false);
  const x = slipRatio;
  return applyMagicFormula(x, B, C, D, E);
}

/**
 * Core Magic Formula: y = D * sin(C * (atan(B*x) - E * (B*x - atan(B*x))))
 * This is the standard Pacejka form used across all tire models.
 * The function is odd: f(-x) = -f(x), so it handles both signs.
 */
function applyMagicFormula(x: number, B: number, C: number, D: number, E: number): number {
  const Bx = B * x;
  const atanBx = Math.atan(Bx);
  const inner = C * (atanBx - E * (Bx - atanBx));
  return D * Math.sin(inner);
}

/**
 * Combined slip: computes a loading factor that distributes grip
 * between lateral and longitudinal directions.
 */
function combinedForce(
  slipAngleDeg: number,
  slipRatio: number,
  load: number
): { lateral: number; longitudinal: number } {
  const FyPure = lateralForce(slipAngleDeg, load);
  const FxPure = longitudinalForce(slipRatio, load);

  // Max possible force for loading factor calculation
  const sqrtLoad = Math.sqrt(load);
  const FyMax = PACEJKA.peakScale * sqrtLoad;
  const FxMax = PACEJKA.peakScale * sqrtLoad;

  const fyRatio = Math.abs(FyPure) / FyMax;
  const fxRatio = Math.abs(FxPure) / FxMax;

  // Loading factor: reduces each component based on the other's demand
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

      // Sample from 0 to 25 degrees
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
      // Find the peak first
      let peakAngle = 0;
      let peakForce = 0;
      for (let angle = 0; angle <= 25; angle += 0.5) {
        const fy = lateralForce(angle, load);
        if (fy > peakForce) {
          peakForce = fy;
          peakAngle = angle;
        }
      }
      // Force well past the peak should be less
      const postPeak = lateralForce(peakAngle + 8, load);
      expect(postPeak).toBeLessThan(peakForce);
    });

    it('scales with load (more load = more grip, but non-linear)', () => {
      // Test at a low slip angle (2°) well before the peak, where load scaling is monotonic
      const fy3000 = lateralForce(2, 3000);
      const fy4000 = lateralForce(2, 4000);
      const fy6000 = lateralForce(2, 6000);

      expect(fy4000).toBeGreaterThan(fy3000);
      expect(fy6000).toBeGreaterThan(fy4000);

      // Non-linear: doubling load does NOT double grip (sub-linear √ dependency)
      const ratio6k_3k = fy6000 / fy3000;
      expect(ratio6k_3k).toBeGreaterThan(1);
      expect(ratio6k_3k).toBeLessThan(2); // sub-linear
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
      // Find the actual peak
      let peakRatio = 0;
      let peakForce = 0;
      for (let ratio = 0; ratio <= 0.3; ratio += 0.005) {
        const fx = longitudinalForce(ratio, load);
        if (fx > peakForce) {
          peakForce = fx;
          peakRatio = ratio;
        }
      }
      // Force well past the peak should be less
      const locked = longitudinalForce(Math.min(peakRatio + 0.1, 0.3), load);
      expect(locked).toBeLessThan(peakForce);
    });

    it('scales with load', () => {
      // Test at low slip ratio (0.05) where load scaling is monotonic
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

      // Light longitudinal slip → mild reduction in lateral
      const mild = combinedForce(3, 0.03, load);

      // Heavy longitudinal slip → stronger reduction in lateral
      const heavy = combinedForce(3, 0.15, load);

      expect(Math.abs(mild.lateral)).toBeGreaterThan(Math.abs(heavy.lateral));
    });
  });
});
