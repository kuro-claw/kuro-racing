// ─── Vehicle — Integrated Physics Vehicle ───────────────────────
// KR-010: Unified vehicle class integrating all physics subsystems.
// KR-019: Refactored to accept car-specific powertrain configs.
// Uses custom physics integration (no HavokPlugin — not in package.json).
// Applies forces to a TransformNode for position/rotation updates.

import { TransformNode, Vector3, Scene, Quaternion, Matrix } from '@babylonjs/core';
import {
  lateralForce,
  longitudinalForce,
  calcSlipAngle,
  calcSlipRatio,
} from './tire';
import {
  allWheelLoads,
  type ChassisConfig,
  PHANTOM_CHASSIS,
} from './chassis';
import {
  calcDrivetrain,
  PHANTOM_GEARBOX,
  PHANTOM_ENGINE,
  PHANTOM_CLUTCH,
  PHANTOM_DIFF,
  type EngineConfig,
  type GearboxConfig,
  type ClutchConfig,
  type DifferentialConfig,
} from './powertrain';
import {
  aeroLoad,
  PHANTOM_AERO,
  type AeroConfig,
} from './aero';
import type { InputState } from '../core/input';

// ─── Types ──────────────────────────────────────────────────────

export interface WheelConfig {
  position: Vector3; // offset from vehicle center (local space)
  radius: number;    // m
  driven: boolean;   // receives engine torque
  steered: boolean;  // responds to steering input
}

export interface VehicleConfig {
  mass: number;           // kg
  cgHeight: number;       // m
  trackWidth: number;     // m
  wheelbase: number;      // m
  weightDistributionFront: number;
  maxSteerAngle: number;  // radians
  steerSpeed: number;     // radians/s
  wheels: WheelConfig[];
  // Optional powertrain sub-configs (KR-019)
  engine?: EngineConfig;
  gearbox?: GearboxConfig;
  clutch?: ClutchConfig;
  diff?: DifferentialConfig;
  aero?: AeroConfig;
}

export interface VehicleState {
  velocity: Vector3;       // world-space (m/s)
  angularVelocity: Vector3; // rad/s (yaw primarily)
  wheelOmega: number[];    // rad/s per wheel
  gear: number;            // 1-indexed
  rpm: number;
  steerAngle: number;      // radians
  grounded: boolean[];
  _lastLongAccel?: number; // cached longitudinal accel for next frame's load transfer
}

// ─── Vehicle Class ───────────────────────────────────────────────

export class Vehicle {
  private _node: TransformNode;
  private readonly _config: VehicleConfig;
  private _state: VehicleState;
  private _input: InputState;

  // Cached powertrain configs (defaults to PHANTOM_* if not provided)
  private readonly _engine: EngineConfig;
  private readonly _gearbox: GearboxConfig;
  private readonly _clutch: ClutchConfig;
  private readonly _diff: DifferentialConfig;
  private readonly _aero: AeroConfig;
  private readonly _chassis: ChassisConfig;

  private readonly GRAVITY = 9.81;

  constructor(scene: Scene, config: VehicleConfig) {
    this._config = config;

    // Use car-specific powertrain configs or fall back to Phantom defaults
    this._engine = config.engine ?? PHANTOM_ENGINE;
    this._gearbox = config.gearbox ?? PHANTOM_GEARBOX;
    this._clutch = config.clutch ?? PHANTOM_CLUTCH;
    this._diff = config.diff ?? PHANTOM_DIFF;
    this._aero = config.aero ?? PHANTOM_AERO;

    // Build chassis config from vehicle config properties
    this._chassis = {
      mass: config.mass,
      cgHeight: config.cgHeight,
      trackWidth: config.trackWidth,
      wheelbase: config.wheelbase,
      weightDistributionFront: config.weightDistributionFront,
    };

    this._node = new TransformNode('vehicle', scene);
    this._node.position = new Vector3(0, 0.5, 0);
    this._node.rotationQuaternion = Quaternion.Identity();

    this._state = {
      velocity: Vector3.Zero(),
      angularVelocity: Vector3.Zero(),
      wheelOmega: config.wheels.map(() => 0),
      gear: 1,
      rpm: 800,
      steerAngle: 0,
      grounded: config.wheels.map(() => true), // assume grounded initially
    };

    this._input = { throttle: 0, brake: 0, steer: 0, clutch: false };
  }

  // ─── Input ────────────────────────────────────────────────────

  setInput(input: InputState): void {
    this._input = { ...input };
  }

  // ─── Physics Update ───────────────────────────────────────────

  update(dt: number): void {
    const { _config: config, _state: state, _input: input } = this;
    const safeDt = Math.min(dt, 0.05);

    // ── Local velocity ───────────────────────────────────────────
    const rot = this._node.rotationQuaternion!;
    const rotMat = Matrix.Identity();
    rot.toRotationMatrix(rotMat);
    const invRotMat = Matrix.Invert(rotMat);
    const localVel = Vector3.TransformCoordinates(state.velocity, invRotMat);
    const speedForward = localVel.z;
    const speedLateral = localVel.x;

    // ── Steering ─────────────────────────────────────────────────
    const targetSteer = input.steer * config.maxSteerAngle;
    const steerDelta = targetSteer - state.steerAngle;
    const maxDelta = config.steerSpeed * safeDt;
    state.steerAngle += Math.max(-maxDelta, Math.min(maxDelta, steerDelta));

    // ── Wheel loads ──────────────────────────────────────────────
    // Use estimated longitudinal acceleration from last frame for load transfer.
    // This breaks the circular dependency (need forces to get accel, need loads for forces).
    const lateralAccel = state.angularVelocity.y * speedForward;
    const estLongAccel = (state._lastLongAccel ?? 0);
    const wheelLoads = allWheelLoads(lateralAccel, estLongAccel, this._chassis);

    // ── RPM: blend of ground speed and wheel spin ────────────────
    // At launch ground speed is near-zero, so we blend with actual wheel omega
    // to break the chicken-and-egg (no speed → no RPM → no torque → no speed)
    const wheelRadius = this._config.wheels[2]?.radius ?? 0.33;
    const avgDrivenOmega = this._avgDrivenWheelOmega();
    const gearRatio = (this._gearbox.ratios[state.gear - 1] ?? 1) * this._gearbox.finalDrive;
    const wheelRpm = (avgDrivenOmega * gearRatio * 60) / (2 * Math.PI);
    const groundOmega = Math.abs(speedForward) / wheelRadius;
    const groundRpm = (groundOmega * gearRatio * 60) / (2 * Math.PI);
    // Blend: at low speed trust wheel spin more, at high speed trust ground speed
    const blendFactor = Math.min(1, Math.abs(speedForward) / 10);
    const blendedRpm = wheelRpm * (1 - blendFactor) + groundRpm * blendFactor;
    state.rpm = Math.max(this._engine.idleRpm, Math.min(this._engine.redlineRpm, blendedRpm));

    // ── Auto-shift ───────────────────────────────────────────────
    this._autoShift();

    // ── Aero ─────────────────────────────────────────────────────
    const aero = aeroLoad(Math.abs(speedForward), this._aero);

    // ── Wheel normal forces (with aero downforce) ────────────────
    const frontNormal = Math.max(0, wheelLoads.frontLeft + wheelLoads.frontRight + aero.frontLoad);
    const rearNormal = Math.max(0, wheelLoads.rearLeft + wheelLoads.rearRight + aero.rearLoad);
    const wheelNormals = [
      frontNormal / 2, frontNormal / 2,
      rearNormal / 2,  rearNormal / 2,
    ];

    // ── Drivetrain ───────────────────────────────────────────────
    const driveState = {
      rpm: state.rpm,
      gear: state.gear,
      clutchSlipSpeed: 0,
      wheelSpeedLeft: state.wheelOmega[2] ?? 0,
      wheelSpeedRight: state.wheelOmega[3] ?? 0,
      throttle: input.throttle,
    };
    const drivetrain = calcDrivetrain(driveState, this._engine, this._gearbox, this._clutch, this._diff);

    // ── Per-wheel forces ─────────────────────────────────────────
    let totalFX = 0; // local X (lateral)
    let totalFZ = 0; // local Z (forward)

    for (let i = 0; i < config.wheels.length; i++) {
      const wheel = config.wheels[i];
      const normal = wheelNormals[i] ?? 0;
      if (normal <= 0) { state.grounded[i] = false; continue; }
      state.grounded[i] = true;

      // Wheel spin: update from net torque (drive + brake + tire reaction)
      let driveTorque = 0;
      if (wheel.driven) {
        driveTorque = i === 2 ? drivetrain.leftWheelTorque : drivetrain.rightWheelTorque;
      }
      const brakeTorque = input.brake * 1500 * (state.wheelOmega[i] >= 0 ? 1 : -1);

      // Slip calculations — for driven wheels, compute slip ratio from
      // the DIFFERENCE between wheel surface speed and ground speed.
      // For non-driven wheels, use ground speed as wheel speed.
      const wheelSurfaceSpeed = state.wheelOmega[i] * wheel.radius;
      const steerContrib = wheel.steered ? state.steerAngle : 0;
      const slipAngleDeg = calcSlipAngle(speedForward, speedLateral - steerContrib * speedForward);

      // For driven wheels, engine torque creates a positive slip ratio
      // that generates forward force. At launch (both speeds zero), we
      // need to break the deadlock: apply engine torque directly as force.
      let fx: number;
      if (wheel.driven && Math.abs(speedForward) < 0.1 && state.wheelOmega[i] < 1) {
        // Launch assist: at standstill with driven wheels, apply drive torque
        // directly as longitudinal force to break the zero-slip deadlock.
        let driveTorque = 0;
        if (i === 2) driveTorque = drivetrain.leftWheelTorque;
        else if (i === 3) driveTorque = drivetrain.rightWheelTorque;
        fx = driveTorque / wheel.radius;
        // Update wheel spin from drive torque (this gets wheel spin moving)
        const netTorque = driveTorque;
        const wheelInertia = 1.2;
        state.wheelOmega[i] += (netTorque / wheelInertia) * safeDt;
      } else {
        const slipRatio = calcSlipRatio(wheelSurfaceSpeed, speedForward);
        fx = longitudinalForce(slipRatio, normal);

        // Wheel spin dynamics
        let driveTorque = 0;
        if (wheel.driven) {
          driveTorque = i === 2 ? drivetrain.leftWheelTorque : drivetrain.rightWheelTorque;
        }
        const brakeTorque = input.brake * 1500 * (state.wheelOmega[i] >= 0 ? 1 : -1);
        const tireTorque = fx * wheel.radius;
        const netTorque = driveTorque - brakeTorque + tireTorque;
        const wheelInertia = 1.2;
        state.wheelOmega[i] += (netTorque / wheelInertia) * safeDt;
      }
      // Allow generous wheel spin for launch, but cap at ~3x ground speed + margin
      const maxOmega = Math.abs(speedForward) / wheel.radius + 80;
      state.wheelOmega[i] = Math.max(-maxOmega, Math.min(maxOmega, state.wheelOmega[i]));

      const fy = lateralForce(slipAngleDeg, normal);
      // fx is negative for driving slip (convention: negative slip = driving).
      // Forward force in local +Z is -fx; lateral force adds directly.
      totalFZ -= fx;
      totalFX += fy;
    }

    // ── Drag + rolling resistance ────────────────────────────────
    if (Math.abs(speedForward) > 0.1) {
      totalFZ -= aero.totalDrag * Math.sign(speedForward);
      totalFZ -= 0.015 * config.mass * this.GRAVITY * Math.sign(speedForward);
    }

    // ── Acceleration → velocity ──────────────────────────────────
    const ax = totalFX / config.mass;
    const az = totalFZ / config.mass;
    const localAccel = new Vector3(ax, 0, az);
    const worldAccel = Vector3.TransformCoordinates(localAccel, rotMat);
    worldAccel.y = 0;
    state.velocity.addInPlace(worldAccel.scale(safeDt));

    // Store longitudinal accel for next frame's load transfer
    state._lastLongAccel = az;

    // Speed cap
    const spd = state.velocity.length();
    if (spd > 90) state.velocity.scaleInPlace(90 / spd);

    // ── Yaw (simplified bicycle model) ───────────────────────────
    // Allow steering even at very low speed for launch maneuverability
    const steerEffectiveness = Math.min(1, Math.abs(speedForward) / 2) + 0.3;
    const corneringStiffness = 8000;
    const yawTorque = corneringStiffness * state.steerAngle * steerEffectiveness;
    const yawInertia = config.mass * config.cgHeight * 1.5;
    state.angularVelocity.y += (yawTorque / yawInertia) * safeDt;
    // Yaw damping
    state.angularVelocity.y *= Math.exp(-3.0 * safeDt);

    // ── Integrate position & rotation ────────────────────────────
    this._node.position.addInPlace(state.velocity.scale(safeDt));
    this._node.position.y = 0.5; // flat ground

    const deltaYaw = Quaternion.RotationAxis(Vector3.Up(), state.angularVelocity.y * safeDt);
    this._node.rotationQuaternion = rot.multiply(deltaYaw);
  }

  // ─── Private helpers ─────────────────────────────────────────

  private _avgDrivenWheelOmega(): number {
    const driven = this._config.wheels
      .map((w, i) => w.driven ? this._state.wheelOmega[i] : null)
      .filter((v): v is number => v !== null);
    if (driven.length === 0) return 0;
    return driven.reduce((a, b) => a + b, 0) / driven.length;
  }

  private _autoShift(): void {
    const maxGear = this._gearbox.ratios.length;
    if (this._state.rpm > this._engine.redlineRpm * 0.85 && this._state.gear < maxGear) {
      this._state.gear++;
    } else if (this._state.rpm < this._engine.redlineRpm * 0.25 && this._state.gear > 1) {
      this._state.gear--;
    }
  }

  // ─── Accessors ────────────────────────────────────────────────

  get position(): Vector3 { return this._node.position.clone(); }
  get rotation(): Quaternion { return this._node.rotationQuaternion!; }
  get velocity(): Vector3 { return this._state.velocity.clone(); }
  get speed(): number { return this._state.velocity.length(); }
  get speedKmh(): number { return this.speed * 3.6; }
  get rpm(): number { return this._state.rpm; }
  get gear(): number { return this._state.gear; }
  get steerAngle(): number { return this._state.steerAngle; }
  get node(): TransformNode { return this._node; }
  get state(): Readonly<VehicleState> { return this._state; }

  dispose(): void {
    this._node.dispose();
  }
}
