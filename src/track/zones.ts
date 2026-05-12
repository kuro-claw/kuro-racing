// ─── Track Zones — Checkpoints & Off-Track Detection ─────────────
// KR-013: Sector zones, start/finish, off-track penalty.

import { Vector3 } from '@babylonjs/core';
import type { TrackSample } from '../tracks/neon-circuit';
import { TRACK_WIDTH } from '../tracks/neon-circuit';

export interface Zone {
  id: string;
  centerSampleIndex: number;
  center: Vector3;
  type: 'checkpoint' | 'start-finish';
  sectorIndex: number; // which sector (0-based)
}

// ─── Zone Builder ────────────────────────────────────────────────

/**
 * Build checkpoint zones from track samples.
 * Creates 3 sectors + start/finish.
 */
export function buildZones(samples: TrackSample[], numSectors: number = 3): Zone[] {
  const zones: Zone[] = [];
  const n = samples.length;

  // Start/Finish at t=0 (sample 0)
  zones.push({
    id: 'start-finish',
    centerSampleIndex: 0,
    center: samples[0].position.clone(),
    type: 'start-finish',
    sectorIndex: 0,
  });

  // Sector checkpoints evenly distributed
  for (let s = 1; s <= numSectors - 1; s++) {
    const idx = Math.floor((s / numSectors) * n);
    zones.push({
      id: `checkpoint-${s}`,
      centerSampleIndex: idx,
      center: samples[idx].position.clone(),
      type: 'checkpoint',
      sectorIndex: s,
    });
  }

  return zones;
}

// ─── Zones State ─────────────────────────────────────────────────

export class TrackZones {
  private _zones: Zone[];
  private _samples: TrackSample[];
  private readonly _checkRadius = TRACK_WIDTH + 2; // m — trigger zone radius

  constructor(samples: TrackSample[], numSectors: number = 3) {
    this._samples = samples;
    this._zones = buildZones(samples, numSectors);
  }

  get zones(): Zone[] { return this._zones; }
  get numZones(): number { return this._zones.length; }

  /**
   * Check if a position is inside a zone's trigger radius.
   */
  isInZone(pos: Vector3, zone: Zone): boolean {
    return Vector3.Distance(pos, zone.center) <= this._checkRadius;
  }

  /**
   * Check if position is on a drivable surface (grass/runoff penalty).
   * Returns off-track grip multiplier: 1.0 = full grip, 0.6 = grass
   */
  getSurfaceGrip(pos: Vector3): number {
    // Find nearest track sample
    let minDist = Infinity;
    for (const s of this._samples) {
      const d = Vector3.Distance(pos, s.position);
      if (d < minDist) minDist = d;
    }

    const halfWidth = TRACK_WIDTH / 2;
    if (minDist <= halfWidth) return 1.0;               // on track
    if (minDist <= halfWidth + 2) return 0.8;           // rumble strip
    if (minDist <= halfWidth + 6) return 0.6;           // grass/runoff
    return 0.4;                                          // gravel/barrier
  }
}
