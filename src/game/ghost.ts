// ─── Ghost — Ghost Car Recording & Playback ───────────────────────
// KR-015: Records position/rotation over time, replays on next lap.

import { Vector3, Quaternion, TransformNode, Scene, MeshBuilder, StandardMaterial, Color3, Mesh } from '@babylonjs/core';

export interface GhostFrame {
  time: number;     // ms from lap start
  position: Vector3;
  rotation: Quaternion;
  speed: number;
}

// ─── Ghost Recorder ───────────────────────────────────────────────

export class GhostRecorder {
  private _frames: GhostFrame[] = [];
  private _lapStartTime: number = 0;
  private _recording: boolean = false;
  private readonly _sampleInterval = 100; // ms between samples
  private _lastSampleTime: number = 0;

  start(now: number): void {
    this._frames = [];
    this._lapStartTime = now;
    this._recording = true;
    this._lastSampleTime = now;
  }

  stop(): GhostFrame[] {
    this._recording = false;
    return [...this._frames];
  }

  record(pos: Vector3, rot: Quaternion, speed: number, now: number): void {
    if (!this._recording) return;
    if (now - this._lastSampleTime < this._sampleInterval) return;

    this._frames.push({
      time: now - this._lapStartTime,
      position: pos.clone(),
      rotation: rot.clone(),
      speed,
    });
    this._lastSampleTime = now;
  }

  get isRecording(): boolean { return this._recording; }
  get frameCount(): number { return this._frames.length; }
}

// ─── Ghost Player ─────────────────────────────────────────────────

export class GhostPlayer {
  private _frames: GhostFrame[] = [];
  private _node: TransformNode;
  private _mesh: Mesh | null = null;
  private _lapStartTime: number = 0;
  private _playing: boolean = false;

  constructor(scene: Scene) {
    this._node = new TransformNode('ghost', scene);
    this._buildMesh(scene);
  }

  private _buildMesh(scene: Scene): void {
    // Simple box representing the ghost car
    const mesh = MeshBuilder.CreateBox('ghost-mesh', { width: 1.8, height: 1.0, depth: 4.0 }, scene);
    mesh.parent = this._node;
    mesh.position.y = 0.5;

    const mat = new StandardMaterial('ghost-mat', scene);
    mat.diffuseColor = new Color3(0.3, 0.7, 1.0);
    mat.emissiveColor = new Color3(0.1, 0.3, 0.5);
    mat.alpha = 0.4; // semi-transparent
    mesh.material = mat;

    this._mesh = mesh;
  }

  load(frames: GhostFrame[]): void {
    this._frames = frames;
  }

  start(now: number): void {
    if (this._frames.length === 0) return;
    this._lapStartTime = now;
    this._playing = true;
    this._node.setEnabled(true);
  }

  stop(): void {
    this._playing = false;
    this._node.setEnabled(false);
  }

  update(now: number): void {
    if (!this._playing || this._frames.length === 0) return;

    const elapsed = now - this._lapStartTime;
    const maxTime = this._frames[this._frames.length - 1].time;

    if (elapsed > maxTime) {
      this.stop();
      return;
    }

    // Find surrounding frames
    let lo = 0;
    let hi = this._frames.length - 1;
    while (lo < hi - 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (this._frames[mid].time <= elapsed) lo = mid;
      else hi = mid;
    }

    const f0 = this._frames[lo];
    const f1 = this._frames[hi];
    const t = f1.time > f0.time ? (elapsed - f0.time) / (f1.time - f0.time) : 0;

    // Interpolate position and rotation
    this._node.position = Vector3.Lerp(f0.position, f1.position, t);
    this._node.rotationQuaternion = Quaternion.Slerp(f0.rotation, f1.rotation, t);
  }

  get isPlaying(): boolean { return this._playing; }
  get node(): TransformNode { return this._node; }

  dispose(): void {
    this._mesh?.dispose();
    this._node.dispose();
  }
}
