// ─── Track Visuals — Synthwave Neon Aesthetic ─────────────────────
// KR-012: Neon barriers, glowing markers, rumble strips, reflective surface.

import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  GlowLayer,
} from '@babylonjs/core';
import type { TrackSample } from '../tracks/neon-circuit';

// ─── Neon Colors ─────────────────────────────────────────────────

export const NEON_PINK = new Color3(1.0, 0.1, 0.6);
export const NEON_CYAN = new Color3(0.0, 0.9, 1.0);
export const NEON_PURPLE = new Color3(0.6, 0.0, 1.0);
export const NEON_YELLOW = new Color3(1.0, 0.9, 0.0);

// ─── Track Visuals Class ─────────────────────────────────────────

export class TrackVisuals {
  private _scene: Scene;
  private _glow: GlowLayer | null = null;
  private _neonMeshes: Mesh[] = [];

  constructor(scene: Scene) {
    this._scene = scene;
  }

  /**
   * Build all visual elements for the track.
   * Call after track.build().
   */
  build(samples: TrackSample[], trackWidth: number = 10): void {
    this._setupGlow();
    this._buildNeonBarriers(samples, trackWidth);
    this._buildLaneMarkers(samples);
    this._buildRumbleStrips(samples, trackWidth);
    this._buildCityscape();
  }

  // ─── Glow Layer ───────────────────────────────────────────────

  private _setupGlow(): void {
    const glow = new GlowLayer('neon-glow', this._scene);
    glow.intensity = 1.2;
    this._glow = glow;
  }

  // ─── Neon Barriers ───────────────────────────────────────────

  private _buildNeonBarriers(samples: TrackSample[], trackWidth: number): void {
    const halfWidth = trackWidth / 2 + 0.3;
    const barrierH = 0.6;

    for (const side of [-1, 1]) {
      const color = side === -1 ? NEON_CYAN : NEON_PINK;
      const matName = `neon-barrier-mat-${side}`;

      for (let i = 0; i < samples.length - 1; i += 6) {
        const s = samples[i];
        const pos = s.position.add(s.binormal.scale(halfWidth * side));

        const bar = MeshBuilder.CreateBox(
          `neon-bar-${side}-${i}`,
          { width: 0.15, height: barrierH, depth: 3.5 },
          this._scene
        );
        bar.position = pos.clone();
        bar.position.y = barrierH / 2;

        const angle = Math.atan2(s.tangent.x, s.tangent.z);
        bar.rotation.y = angle;

        const mat = new StandardMaterial(matName + i, this._scene);
        mat.diffuseColor = color.scale(0.3);
        mat.emissiveColor = color;
        bar.material = mat;

        this._neonMeshes.push(bar);
      }
    }
  }

  // ─── Lane Markers ─────────────────────────────────────────────

  private _buildLaneMarkers(samples: TrackSample[]): void {
    // Dashed center line — neon yellow
    for (let i = 0; i < samples.length - 1; i += 10) {
      const s = samples[i];

      const marker = MeshBuilder.CreateBox(
        `lane-marker-${i}`,
        { width: 0.15, height: 0.02, depth: 1.8 },
        this._scene
      );
      marker.position = s.position.clone();
      marker.position.y = 0.01;

      const angle = Math.atan2(s.tangent.x, s.tangent.z);
      marker.rotation.y = angle;

      const mat = new StandardMaterial(`lane-mat-${i}`, this._scene);
      mat.diffuseColor = NEON_YELLOW.scale(0.2);
      mat.emissiveColor = NEON_YELLOW.scale(0.6);
      marker.material = mat;
      this._neonMeshes.push(marker);
    }
  }

  // ─── Rumble Strips ───────────────────────────────────────────

  private _buildRumbleStrips(samples: TrackSample[], trackWidth: number): void {
    const halfWidth = trackWidth / 2;

    for (const side of [-1, 1]) {
      const color = side === -1 ? NEON_PURPLE : NEON_PINK;

      for (let i = 0; i < samples.length - 1; i += 4) {
        if (i % 8 < 4) continue; // Alternating pattern (every other strip)
        const s = samples[i];
        const pos = s.position.add(s.binormal.scale((halfWidth - 0.8) * side));

        const strip = MeshBuilder.CreateBox(
          `rumble-${side}-${i}`,
          { width: 1.2, height: 0.05, depth: 0.6 },
          this._scene
        );
        strip.position = pos.clone();
        strip.position.y = 0.025;

        const angle = Math.atan2(s.tangent.x, s.tangent.z);
        strip.rotation.y = angle;

        const mat = new StandardMaterial(`rumble-mat-${side}-${i}`, this._scene);
        mat.diffuseColor = color.scale(0.4);
        mat.emissiveColor = color.scale(0.5);
        strip.material = mat;
        this._neonMeshes.push(strip);
      }
    }
  }

  // ─── Distant Cityscape ───────────────────────────────────────

  private _buildCityscape(): void {
    // Silhouette of buildings in the distance
    const buildings = [
      { x: -200, z: -150, w: 15, h: 60, d: 20 },
      { x: -180, z: -160, w: 10, h: 45, d: 15 },
      { x: 200, z: -150, w: 20, h: 80, d: 25 },
      { x: 220, z: -170, w: 12, h: 55, d: 18 },
      { x: -200, z: 200, w: 18, h: 70, d: 22 },
      { x: 200, z: 200, w: 25, h: 90, d: 30 },
      { x: 0, z: -200, w: 30, h: 100, d: 40 },
    ];

    for (const b of buildings) {
      const bldg = MeshBuilder.CreateBox(
        `building-${b.x}-${b.z}`,
        { width: b.w, height: b.h, depth: b.d },
        this._scene
      );
      bldg.position = new Vector3(b.x, b.h / 2, b.z);

      const mat = new StandardMaterial(`bldg-mat-${b.x}`, this._scene);
      mat.diffuseColor = new Color3(0.03, 0.03, 0.08);
      mat.emissiveColor = new Color3(0.02, 0.01, 0.05);
      bldg.material = mat;
    }

    // Neon signs on some buildings
    const signs = [
      { x: -200, z: -150, y: 40, color: NEON_CYAN },
      { x: 200, z: -150, y: 50, color: NEON_PINK },
      { x: 0, z: -200, y: 70, color: NEON_PURPLE },
    ];

    for (let i = 0; i < signs.length; i++) {
      const sg = signs[i];
      const sign = MeshBuilder.CreateBox(
        `sign-${i}`,
        { width: 8, height: 1.5, depth: 0.2 },
        this._scene
      );
      sign.position = new Vector3(sg.x, sg.y, sg.z);

      const mat = new StandardMaterial(`sign-mat-${i}`, this._scene);
      mat.diffuseColor = sg.color.scale(0.2);
      mat.emissiveColor = sg.color;
      sign.material = mat;
      this._neonMeshes.push(sign);
    }
  }

  // ─── Accessors ───────────────────────────────────────────────

  get glowLayer(): GlowLayer | null { return this._glow; }
  get neonMeshes(): Mesh[] { return this._neonMeshes; }

  /** Update glow intensity (e.g., for pulsing effects) */
  setGlowIntensity(intensity: number): void {
    if (this._glow) this._glow.intensity = intensity;
  }

  dispose(): void {
    this._glow?.dispose();
    this._neonMeshes.forEach(m => m.dispose());
  }
}
