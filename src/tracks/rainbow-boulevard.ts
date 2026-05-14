// ─── Rainbow Boulevard — Track Definition ────────────────────────
// KR-020: A longer, figure-8 inspired circuit with elevation changes.

import {
  Scene,
  Vector3,
  MeshBuilder,
  Mesh,
  StandardMaterial,
  Color3,
  Path3D,
  VertexData,
} from '@babylonjs/core';
import type { TrackConfig } from '../track/track-config';
import { sampleTrack, buildRoadMesh, TrackSample } from './neon-circuit';

// ─── Track Control Points ────────────────────────────────────────
// 20 control points — figure-8 inspired layout with elevation

export const RAINBOW_BOULEVARD_POINTS: Vector3[] = [
  new Vector3(0, 0, 0),          // Start
  new Vector3(40, 0, 30),        // T1 entry (slight uphill)
  new Vector3(80, 2, 60),        // T1 (elevation change)
  new Vector3(100, 3, 100),      // Back straight
  new Vector3(80, 2, 140),       // T2
  new Vector3(40, 0, 160),       // Back straight return
  new Vector3(0, -1, 140),       // T3 (dips below start)
  new Vector3(-40, -2, 100),     // Left straight
  new Vector3(-60, -1, 60),      // T4
  new Vector3(-40, 1, 30),       // U-turn
  new Vector3(0, 2, 10),         // Infield climb
  new Vector3(20, 3, -20),       // T5
  new Vector3(0, 2, -50),        // Outer loop
  new Vector3(-30, 0, -40),      // T6
  new Vector3(-60, -1, -10),     // Lower straight
  new Vector3(-40, 0, 20),       // T7
  new Vector3(-20, 1, 40),       // Infield
  new Vector3(0, 0, 0),          // Close loop
];

export const RAINBOW_TRACK_WIDTH = 12; // wider road
export const RAINBOW_TRACK_POINTS = 240; // interpolated points

export const RAINBOW_BOULEVARD_CONFIG: TrackConfig = {
  id: 'rainbow-boulevard',
  name: 'Rainbow Boulevard',
  width: RAINBOW_TRACK_WIDTH,
  numSamples: RAINBOW_TRACK_POINTS,
  numSectors: 3,
  description: 'Elevated figure-8 · 12m wide',
};

// ─── Rainbow Boulevard Builder ───────────────────────────────────

export class RainbowBoulevard {
  private _scene: Scene;
  private _roadMesh: Mesh | null = null;
  private _boundaries: Mesh[] = [];
  private _samples: TrackSample[] = [];

  constructor(scene: Scene) {
    this._scene = scene;
  }

  build(): void {
    this._samples = sampleTrack(RAINBOW_BOULEVARD_POINTS, RAINBOW_TRACK_POINTS);
    this._buildRoad();
    this._buildBoundaries();
  }

  private _buildRoad(): void {
    const { positions, indices, normals, uvs } = buildRoadMesh(this._samples, RAINBOW_TRACK_WIDTH);

    const mesh = new Mesh('rainbow-boulevard-road', this._scene);
    const vd = new VertexData();
    vd.positions = positions;
    vd.indices = indices;
    vd.normals = normals;
    vd.uvs = uvs;
    vd.applyToMesh(mesh);

    const mat = new StandardMaterial('rainbow-road-mat', this._scene);
    mat.diffuseColor = new Color3(0.06, 0.04, 0.09);
    mat.specularColor = new Color3(0.4, 0.3, 0.5);
    mat.specularPower = 64;
    mesh.material = mat;
    mesh.receiveShadows = true;

    this._roadMesh = mesh;
  }

  private _buildBoundaries(): void {
    const halfWidth = RAINBOW_TRACK_WIDTH / 2 + 0.5; // just outside road edge
    const barrierHeight = 0.8;

    for (const side of [-1, 1]) { // -1 = left, +1 = right
      for (let i = 0; i < this._samples.length - 1; i++) {
        const s = this._samples[i];
        const s2 = this._samples[i + 1];

        const pos = s.position.add(s.binormal.scale(halfWidth * side));
        const pos2 = s2.position.add(s2.binormal.scale(halfWidth * side));

        // Simple barrier: small box at each sample point
        // For performance, we skip every N samples
        if (i % 4 !== 0) continue;

        const barrier = MeshBuilder.CreateBox(
          `rainbow-barrier-${side}-${i}`,
          { width: 0.3, height: barrierHeight, depth: 2 },
          this._scene
        );
        barrier.position = Vector3.Lerp(pos, pos2, 0.5);
        barrier.position.y = Math.max(s.position.y, s2.position.y) + barrierHeight / 2;

        // Orient barrier along track
        const dir = pos2.subtract(pos).normalize();
        const angle = Math.atan2(dir.x, dir.z);
        barrier.rotation.y = angle;

        // Rainbow gradient based on sample index
        const hue = (i / this._samples.length) * 360;
        const color = this._hslToRgb(hue, 0.8, 0.35);

        const mat = new StandardMaterial(`rainbow-barrier-mat-${side}-${i}`, this._scene);
        mat.diffuseColor = new Color3(color.r * 0.5, color.g * 0.5, color.b * 0.5);
        mat.emissiveColor = new Color3(color.r, color.g, color.b);
        barrier.material = mat;

        this._boundaries.push(barrier);
      }
    }
  }

  private _hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    const k = (n: number) => (n + 360) % 360;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n / 30) - 2, Math.min(2 - k(n / 30), 1)));
    return { r: f(h + 120), g: f(h), b: f(h - 120) };
  }

  // ─── Public API ──────────────────────────────────────────────

  get samples(): TrackSample[] { return this._samples; }
  get roadMesh(): Mesh | null { return this._roadMesh; }
  get boundaries(): Mesh[] { return this._boundaries; }

  /** Get track width */
  get width(): number { return RAINBOW_TRACK_WIDTH; }

  /** Get the total number of track samples */
  get numSamples(): number { return this._samples.length; }

  /**
   * Find the closest point on track to a world position.
   * Returns { sampleIndex, distance, sample }
   */
  closestPoint(pos: Vector3): { sampleIndex: number; distance: number; sample: TrackSample } {
    let minDist = Infinity;
    let minIdx = 0;
    for (let i = 0; i < this._samples.length; i++) {
      const d = Vector3.Distance(pos, this._samples[i].position);
      if (d < minDist) { minDist = d; minIdx = i; }
    }
    return { sampleIndex: minIdx, distance: minDist, sample: this._samples[minIdx] };
  }

  /**
   * Check if a position is on the track (within road boundaries).
   */
  isOnTrack(pos: Vector3): boolean {
    const { distance } = this.closestPoint(pos);
    return distance <= RAINBOW_TRACK_WIDTH / 2 + 1; // 1m tolerance
  }

  dispose(): void {
    this._roadMesh?.dispose();
    this._boundaries.forEach(b => b.dispose());
  }
}
