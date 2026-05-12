import { describe, it, expect } from 'vitest';

// ─── Vehicle Dynamics (Reference Implementation) ────────────────

interface VehicleParams {
  wheelRadius: number; // m
  wheelbase: number; // m
  cgHeight: number; // m
  mass: number; // kg
  wheelInertia: number; // kg·m² (per wheel)
}

const GRAVITY = 9.81;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Convert wheel angular velocity (rad/s) to vehicle forward speed (m/s).
 * v = ω * r
 */
function wheelSpeedToVehicleSpeed(omega: number, wheelRadius: number): number {
  return omega * wheelRadius;
}

/**
 * Convert vehicle speed (m/s) to wheel angular velocity (rad/s).
 */
function vehicleSpeedToWheelSpeed(speed: number, wheelRadius: number): number {
  return speed / wheelRadius;
}

/**
 * Convert vehicle speed (m/s) to km/h.
 */
function mpsToKmh(speed: number): number {
  return speed * 3.6;
}

/**
 * Convert km/h to m/s.
 */
function kmhToMps(kmh: number): number {
  return kmh / 3.6;
}

/**
 * Approximate yaw rate from lateral velocity and wheelbase.
 * For steady-state cornering: yawRate ≈ lateralVelocity / wheelbase
 * More precisely: yawRate = v_y / L (first-order bicycle model)
 */
function estimateYawRate(lateralVelocity: number, wheelbase: number): number {
  return lateralVelocity / wheelbase;
}

/**
 * Roll moment from lateral acceleration.
 * M = mass * lateralAccel * cgHeight
 */
function rollMoment(lateralAccel: number, mass: number, cgHeight: number): number {
  return mass * lateralAccel * cgHeight;
}

/**
 * Pitch moment from longitudinal acceleration.
 * M = mass * longAccel * cgHeight
 */
function pitchMoment(longAccel: number, mass: number, cgHeight: number): number {
  return mass * longAccel * cgHeight;
}

/**
 * Wheel rotational kinetic energy: 0.5 * I * ω²
 */
function wheelRotationalEnergy(omega: number, wheelInertia: number): number {
  return 0.5 * wheelInertia * omega * omega;
}

/**
 * Vehicle translational kinetic energy: 0.5 * m * v²
 */
function vehicleTranslationalEnergy(speed: number, mass: number): number {
  return 0.5 * mass * speed * speed;
}

/**
 * Total kinetic energy (translational + 4 wheels rotational).
 */
function totalKineticEnergy(
  speed: number,
  params: VehicleParams
): number {
  const omega = vehicleSpeedToWheelSpeed(speed, params.wheelRadius);
  const translational = vehicleTranslationalEnergy(speed, params.mass);
  const rotational = 4 * wheelRotationalEnergy(omega, params.wheelInertia);
  return translational + rotational;
}

// ─── Tests ──────────────────────────────────────────────────────

describe('Vehicle Dynamics', () => {
  const params: VehicleParams = {
    wheelRadius: 0.33, // ~16" tire
    wheelbase: 2.6,
    cgHeight: 0.45,
    mass: 1400,
    wheelInertia: 1.2,
  };

  describe('wheel speed → vehicle speed', () => {
    it('converts correctly: v = omega * r', () => {
      const omega = 50; // rad/s
      const speed = wheelSpeedToVehicleSpeed(omega, params.wheelRadius);
      expect(speed).toBeCloseTo(50 * 0.33, 5);
      expect(speed).toBeCloseTo(16.5, 5);
    });

    it('converts vehicle speed back to wheel speed', () => {
      const speed = 30; // m/s (~108 km/h)
      const omega = vehicleSpeedToWheelSpeed(speed, params.wheelRadius);
      expect(omega * params.wheelRadius).toBeCloseTo(speed, 5);
    });

    it('round-trips correctly', () => {
      const originalOmega = 75;
      const speed = wheelSpeedToVehicleSpeed(originalOmega, params.wheelRadius);
      const recovered = vehicleSpeedToWheelSpeed(speed, params.wheelRadius);
      expect(recovered).toBeCloseTo(originalOmega, 5);
    });

    it('zero omega means zero speed', () => {
      expect(wheelSpeedToVehicleSpeed(0, params.wheelRadius)).toBeCloseTo(0, 10);
    });
  });

  describe('speed unit conversions', () => {
    it('mps to km/h', () => {
      expect(mpsToKmh(27.78)).toBeCloseTo(100, 0);
      expect(mpsToKmh(0)).toBe(0);
    });

    it('km/h to m/s', () => {
      expect(kmhToMps(100)).toBeCloseTo(27.78, 1);
      expect(kmhToMps(0)).toBe(0);
    });

    it('round-trips correctly', () => {
      const kmh = 120;
      const mps = kmhToMps(kmh);
      const recovered = mpsToKmh(mps);
      expect(recovered).toBeCloseTo(kmh, 5);
    });
  });

  describe('yaw rate estimation', () => {
    it('relates lateral velocity to wheelbase', () => {
      const lateralVel = 3; // m/s
      const yawRate = estimateYawRate(lateralVel, params.wheelbase);
      expect(yawRate).toBeCloseTo(3 / 2.6, 5);
      expect(yawRate).toBeCloseTo(1.15, 1);
    });

    it('zero lateral velocity means no yaw', () => {
      expect(estimateYawRate(0, params.wheelbase)).toBeCloseTo(0, 10);
    });

    it('longer wheelbase reduces yaw rate for same lateral velocity', () => {
      const short = estimateYawRate(3, 2.4);
      const long = estimateYawRate(3, 2.9);
      expect(long).toBeLessThan(short);
    });

    it('negative lateral velocity produces negative yaw rate', () => {
      const yawRate = estimateYawRate(-2, params.wheelbase);
      expect(yawRate).toBeLessThan(0);
    });
  });

  describe('roll moment', () => {
    it('CG height affects roll moment', () => {
      const lowCG = rollMoment(5, params.mass, 0.35);
      const highCG = rollMoment(5, params.mass, 0.55);
      expect(highCG).toBeGreaterThan(lowCG);
    });

    it('scales with lateral acceleration', () => {
      const mild = rollMoment(2, params.mass, params.cgHeight);
      const hard = rollMoment(8, params.mass, params.cgHeight);
      expect(hard).toBeCloseTo(mild * 4, 1);
    });

    it('scales with mass', () => {
      const light = rollMoment(5, 1000, params.cgHeight);
      const heavy = rollMoment(5, 2000, params.cgHeight);
      expect(heavy).toBeCloseTo(light * 2, 1);
    });

    it('computes expected value for reference car at 0.5g', () => {
      // 1400 * 5 * 0.45 = 3150 N·m
      const moment = rollMoment(5, params.mass, params.cgHeight);
      expect(moment).toBeCloseTo(3150, 0);
    });

    it('zero lateral accel means no roll moment', () => {
      expect(rollMoment(0, params.mass, params.cgHeight)).toBeCloseTo(0, 10);
    });
  });

  describe('pitch moment', () => {
    it('braking creates pitch moment (nose-down)', () => {
      const moment = pitchMoment(-5, params.mass, params.cgHeight);
      expect(moment).toBeLessThan(0);
      expect(moment).toBeCloseTo(-3150, 0);
    });

    it('acceleration creates pitch moment (nose-up)', () => {
      const moment = pitchMoment(5, params.mass, params.cgHeight);
      expect(moment).toBeGreaterThan(0);
      expect(moment).toBeCloseTo(3150, 0);
    });

    it('zero acceleration means no pitch moment', () => {
      expect(pitchMoment(0, params.mass, params.cgHeight)).toBeCloseTo(0, 10);
    });
  });

  describe('kinetic energy', () => {
    it('wheel rotational energy scales with omega squared', () => {
      const e1 = wheelRotationalEnergy(50, params.wheelInertia);
      const e2 = wheelRotationalEnergy(100, params.wheelInertia);
      expect(e2).toBeCloseTo(e1 * 4, 1);
    });

    it('vehicle translational energy scales with v squared', () => {
      const e1 = vehicleTranslationalEnergy(20, params.mass);
      const e2 = vehicleTranslationalEnergy(40, params.mass);
      expect(e2).toBeCloseTo(e1 * 4, 1);
    });

    it('total KE includes both translational and rotational', () => {
      const speed = 30;
      const total = totalKineticEnergy(speed, params);
      const translational = vehicleTranslationalEnergy(speed, params.mass);
      const omega = vehicleSpeedToWheelSpeed(speed, params.wheelRadius);
      const rotational = 4 * wheelRotationalEnergy(omega, params.wheelInertia);

      expect(total).toBeCloseTo(translational + rotational, 1);
      expect(total).toBeGreaterThan(translational); // wheels add energy
    });

    it('rotational KE is a small but non-negligible fraction', () => {
      const speed = 30;
      const total = totalKineticEnergy(speed, params);
      const translational = vehicleTranslationalEnergy(speed, params.mass);
      const rotational = total - translational;

      const fraction = rotational / total;
      expect(fraction).toBeGreaterThan(0.01);  // at least 1%
      expect(fraction).toBeLessThan(0.15);      // less than 15%
    });

    it('zero speed means zero total energy', () => {
      expect(totalKineticEnergy(0, params)).toBeCloseTo(0, 10);
    });
  });
});
