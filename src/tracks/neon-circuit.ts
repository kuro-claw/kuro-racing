// ─── Neon Circuit — Track Definition ─────────────────────────────
// KR-011: Spline-based track with road surface, banking, collision boundaries.
// Synthwave aesthetic track layout.

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

// ─── Track Control Points ────────────────────────────────────────
// Oval-inspired circuit with chicanes — a proper racing layout

export const NEON_CIRCUIT_POINTS: Vector3[] = [
  new Vector3(0, 0, 0),       // Start/Finish
  new Vector3(30, 0, 20),     // Turn 1 entry
  new Vector3(60, 0, 40),     // Turn 1
  new Vector3(90, 0, 30),     // Back straight start
  new Vector3(120, 0, 40),    // T2 entry
  new Vector3(140, 0, 70),    // T2
  new Vector3(130, 0, 100),   // Back straight
  new Vector3(100, 0, 120),   // T3 entry
  new Vector3(60, 0, 130),    // T3
  new Vector3(20, 0, 120),    // T4 entry
  new Vector3(-10, 0, 90),    // T4 — hairpin
  new Vector3(0, 0, 60),      // Infield
  new Vector3(-20, 0, 30),    // T5 entry
  new Vector3(-10, 0, 10),    // T5
  new Vector3(0, 0, 0),       // Close the loop
];

export const TRACK_WIDTH = 10; // m
export const TRACK_POINTS = 200; // interpolated points along spline

export const NEON_CIRCUIT_CONFIG: TrackConfig = {
  id: 'neon-circuit',
  name: 'Neon Circuit',
  width: TRACK_WIDTH,
  numSamples: TRACK_POINTS,
  numSectors: 3,
  description: 'Oval circuit · 10m wide',
};

// ─── Track Sampler ───────────────────────────────────────────────

export interface TrackSample {
  position: Vector3;
  tangent: Vector3;
  normal: Vector3;    // up-direction (surface normal)
  binormal: Vector3;  // track-right direction
  bankAngle: number;  // radians
  t: number;          // 0-1 position along track
}

/**
 * Sample track spline at evenly-spaced points.
 */
export function sampleTrack(
  points: Vector3[],
  numSamples: number,
): TrackSample[] {
  const path = new Path3D(points);
  const curve = path.getCurve();
  const tangents = path.getTangents();
  const normals = path.getNormals();
  const binormals = path.getBinormals();

  const samples: TrackSample[] = [];
  const len = curve.length;

  for (let i = 0; i < numSamples; i++) {
    const t = i / numSamples;
    const idx = Math.min(Math.floor(t * (len - 1)), len - 2);
    const frac = t * (len - 1) - idx;

    // Interpolate position
    const pos = Vector3.Lerp(curve[idx], curve[idx + 1], frac);

    // Tangent (forward direction along track)
    const tang = Vector3.Lerp(tangents[idx] ?? Vector3.Forward(), tangents[idx + 1] ?? Vector3.Forward(), frac).normalize();

    // Normal (surface up) — keep upward
    const norm = new Vector3(0, 1, 0);

    // Binormal (track right)
    const binorm = Vector3.Cross(tang, norm).normalize();

    // Simple banking: angle based on curvature (turns bank inward)
    const curvature = tangents[idx + 1] && tangents[idx]
      ? Vector3.Distance(tangents[idx + 1], tangents[idx]) * 2
      : 0;
    const bankAngle = Math.min(curvature * 0.3, 0.15); // max 8.6° bank

    samples.push({
      position: pos,
      tangent: tang,
      normal: norm,
      binormal: binorm,
      bankAngle,
      t,
    });
  }

  return samples;
}

// ─── Road Mesh Generation ─────────────────────────────────────────

/**
 * Generate a flat road mesh from track samples.
 * Returns {positions, indices, normals, uvs}
 */
export function buildRoadMesh(
  samples: TrackSample[],
  width: number = TRACK_WIDTH,
): { positions: number[]; indices: number[]; normals: number[]; uvs: number[] } {
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const halfWidth = width / 2;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    // Left edge
    const left = s.position.subtract(s.binormal.scale(halfWidth));
    // Right edge
    const right = s.position.add(s.binormal.scale(halfWidth));

    positions.push(left.x, left.y, left.z);
    positions.push(right.x, right.y, right.z);

    normals.push(0, 1, 0, 0, 1, 0);

    const u = i / samples.length;
    uvs.push(0, u, 1, u);

    if (i < samples.length - 1) {
      const base = i * 2;
      // Quad: two triangles
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }

  return { positions, indices, normals, uvs };
}

// ─── Neon Circuit Builder ────────────────────────────────────────

export class NeonCircuit {
  private _scene: Scene;
  private _roadMesh: Mesh | null = null;
  private _boundaries: Mesh[] = [];
  private _samples: TrackSample[] = [];

  constructor(scene: Scene) {
    this._scene = scene;
  }

  build(): void {
    this._samples = sampleTrack(NEON_CIRCUIT_POINTS, TRACK_POINTS);
    this._buildRoad();
    this._buildBoundaries();
  }

  private _buildRoad(): void {
    const { positions, indices, normals, uvs } = buildRoadMesh(this._samples, TRACK_WIDTH);

    const mesh = new Mesh('neon-circuit-road', this._scene);
    const vd = new VertexData();
    vd.positions = positions;
    vd.indices = indices;
    vd.normals = normals;
    vd.uvs = uvs;
    vd.applyToMesh(mesh);

    const mat = new StandardMaterial('road-mat', this._scene);
    mat.diffuseColor = new Color3(0.05, 0.05, 0.08);
    mat.specularColor = new Color3(0.3, 0.3, 0.5);
    mat.specularPower = 64;
    mesh.material = mat;
    mesh.receiveShadows = true;

    this._roadMesh = mesh;
  }

  private _buildBoundaries(): void {
    const halfWidth = TRACK_WIDTH / 2 + 0.5; // just outside road edge
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
          `barrier-${side}-${i}`,
          { width: 0.3, height: barrierHeight, depth: 2 },
          this._scene
        );
        barrier.position = Vector3.Lerp(pos, pos2, 0.5);
        barrier.position.y = barrierHeight / 2;

        // Orient barrier along track
        const dir = pos2.subtract(pos).normalize();
        const angle = Math.atan2(dir.x, dir.z);
        barrier.rotation.y = angle;

        const mat = new StandardMaterial(`barrier-mat-${side}`, this._scene);
        mat.diffuseColor = side === -1
          ? new Color3(0.1, 0.0, 0.3)   // left: dark purple
          : new Color3(0.3, 0.0, 0.1);  // right: dark red
        mat.emissiveColor = side === -1
          ? new Color3(0.2, 0.0, 0.5)
          : new Color3(0.5, 0.0, 0.15);
        barrier.material = mat;

        this._boundaries.push(barrier);
      }
    }
  }

  // ─── Public API ──────────────────────────────────────────────

  get samples(): TrackSample[] { return this._samples; }
  get roadMesh(): Mesh | null { return this._roadMesh; }
  get boundaries(): Mesh[] { return this._boundaries; }

  /** Get track width */
  get width(): number { return TRACK_WIDTH; }

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
    return distance <= TRACK_WIDTH / 2 + 1; // 1m tolerance
  }

  dispose(): void {
    this._roadMesh?.dispose();
    this._boundaries.forEach(b => b.dispose());
  }
}
