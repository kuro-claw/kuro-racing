// ─── Vehicle — Integrated Physics Vehicle ───────────────────────
// KR-010: Unified vehicle class integrating all physics subsystems.
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
} from './chassis';
import {
  calcDrivetrain,
  PHANTOM_GEARBOX,
} from './powertrain';
import {
  aeroLoad,
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
}

export interface VehicleState {
  velocity: Vector3;       // world-space (m/s)
  angularVelocity: Vector3; // rad/s (yaw primarily)
  wheelOmega: number[];    // rad/s per wheel
  gear: number;            // 1-indexed
  rpm: number;
  steerAngle: number;      // radians
  grounded: boolean[];
}

// ─── Vehicle Class ───────────────────────────────────────────────

export class Vehicle {
  private _node: TransformNode;
  private readonly _config: VehicleConfig;
  private _state: VehicleState;
  private _input: InputState;

  private readonly GRAVITY = 9.81;

  constructor(scene: Scene, config: VehicleConfig) {
    this._config = config;

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

    // ── Steering ────────────────────────────────────────────────
    const targetSteer = input.steer * config.maxSteerAngle;
    const steerDelta = targetSteer - state.steerAngle;
    const maxDelta = config.steerSpeed * safeDt;
    state.steerAngle += Math.max(-maxDelta, Math.min(maxDelta, steerDelta));

    // ── Local velocity ───────────────────────────────────────────
    const rot = this._node.rotationQuaternion!;
    const rotMat = Matrix.Identity();
    rot.toRotationMatrix(rotMat);
    const invRotMat = Matrix.Invert(rotMat);
    const localVel = Vector3.TransformCoordinates(state.velocity, invRotMat);
    const speedForward = localVel.z;
    const speedLateral = localVel.x;

    // ── Auto-shift ───────────────────────────────────────────────
    this._autoShift();

    // ── Aero ─────────────────────────────────────────────────────
    const aero = aeroLoad(Math.abs(speedForward));

    // ── Wheel loads ──────────────────────────────────────────────
    const lateralAccel = state.angularVelocity.y * speedForward;
    const wheelLoads = allWheelLoads(lateralAccel, 0);
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
    const drivetrain = calcDrivetrain(driveState);

    // ── Per-wheel forces ─────────────────────────────────────────
    let totalFX = 0; // local X (lateral)
    let totalFZ = 0; // local Z (forward)

    for (let i = 0; i < config.wheels.length; i++) {
      const wheel = config.wheels[i];
      const normal = wheelNormals[i] ?? 0;
      if (normal <= 0) { state.grounded[i] = false; continue; }
      state.grounded[i] = true;

      const wheelSurfaceSpeed = state.wheelOmega[i] * wheel.radius;
      const steerContrib = wheel.steered ? state.steerAngle : 0;
      const slipAngleDeg = calcSlipAngle(speedForward, speedLateral - steerContrib * speedForward);
      const slipRatio = calcSlipRatio(wheelSurfaceSpeed, speedForward);

      const fy = lateralForce(slipAngleDeg, normal);
      const fx = longitudinalForce(slipRatio, normal);
      // fx is negative for driving slip (convention: negative slip = driving).
      // Forward force in local +Z is -fx; lateral force adds directly.
      totalFZ -= fx;
      totalFX += fy;

      // Wheel spin
      let driveTorque = 0;
      if (wheel.driven) {
        driveTorque = i === 2 ? drivetrain.leftWheelTorque : drivetrain.rightWheelTorque;
      }
      const brakeTorque = input.brake * 1200 * (state.wheelOmega[i] >= 0 ? 1 : -1);
      const tireTorque = fx * wheel.radius; // reaction torque opposes wheel spin
      const netTorque = driveTorque - brakeTorque + tireTorque;
      const wheelInertia = 1.2;
      state.wheelOmega[i] += (netTorque / wheelInertia) * safeDt;
      // Soft clamp to prevent spin beyond reasonable limits
      const maxOmega = Math.abs(speedForward) / wheel.radius + 20;
      state.wheelOmega[i] = Math.max(-maxOmega, Math.min(maxOmega, state.wheelOmega[i]));
    }

    // ── Drag + rolling resistance (only when moving) ──────────────
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

    // Speed cap
    const spd = state.velocity.length();
    if (spd > 90) state.velocity.scaleInPlace(90 / spd);

    // ── Yaw (simplified bicycle model) ───────────────────────────
    if (Math.abs(speedForward) > 0.5) {
      const corneringStiffness = 8000;
      const yawTorque = corneringStiffness * state.steerAngle;
      const yawInertia = config.mass * config.cgHeight * 1.5;
      state.angularVelocity.y += (yawTorque / yawInertia) * safeDt;
    }
    // Yaw damping
    state.angularVelocity.y *= Math.exp(-3.0 * safeDt);

    // ── Integrate position & rotation ────────────────────────────
    this._node.position.addInPlace(state.velocity.scale(safeDt));
    this._node.position.y = 0.5; // flat ground

    const deltaYaw = Quaternion.RotationAxis(Vector3.Up(), state.angularVelocity.y * safeDt);
    this._node.rotationQuaternion = rot.multiply(deltaYaw);

    // ── RPM update (derived from vehicle speed × gear ratio) ──────
    const wheelRadius = this._config.wheels[2]?.radius ?? 0.33;
    const groundOmega = Math.abs(speedForward) / wheelRadius;
    const ratio = (PHANTOM_GEARBOX.ratios[state.gear - 1] ?? 1) * PHANTOM_GEARBOX.finalDrive;
    const speedRpm = (groundOmega * ratio * 60) / (2 * Math.PI);
    state.rpm = Math.max(800, Math.min(7500, speedRpm));
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
    const maxGear = PHANTOM_GEARBOX.ratios.length;
    if (this._state.rpm > 7500 * 0.85 && this._state.gear < maxGear) {
      this._state.gear++;
    } else if (this._state.rpm < 7500 * 0.25 && this._state.gear > 1) {
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
