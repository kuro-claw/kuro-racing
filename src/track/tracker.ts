// ─── Track Tracker — Position & Progress ─────────────────────────
// KR-011: Tracks car position along the circuit, sector progress.

import { Vector3 } from '@babylonjs/core';
import type { TrackSample } from '../tracks/neon-circuit';

export interface TrackPosition {
  sampleIndex: number;    // closest track sample
  t: number;              // normalized progress [0, 1]
  distanceFromCenter: number; // m
  isOnTrack: boolean;
}

export class TrackTracker {
  private _samples: TrackSample[];
  private _lastSampleIndex: number = 0;

  constructor(samples: TrackSample[]) {
    this._samples = samples;
  }

  /**
   * Update tracker with current world position.
   * Searches near last known position for efficiency.
   */
  update(worldPos: Vector3): TrackPosition {
    const searchRadius = 10; // samples to search around last known
    const n = this._samples.length;

    let minDist = Infinity;
    let minIdx = this._lastSampleIndex;

    const start = Math.max(0, this._lastSampleIndex - searchRadius);
    const end = Math.min(n - 1, this._lastSampleIndex + searchRadius);

    for (let i = start; i <= end; i++) {
      const d = Vector3.Distance(worldPos, this._samples[i].position);
      if (d < minDist) {
        minDist = d;
        minIdx = i;
      }
    }

    // If we're near the end/start boundary, also check wrap-around
    if (this._lastSampleIndex < searchRadius || this._lastSampleIndex > n - searchRadius) {
      for (let i = 0; i < n; i++) {
        const d = Vector3.Distance(worldPos, this._samples[i].position);
        if (d < minDist) {
          minDist = d;
          minIdx = i;
        }
      }
    }

    this._lastSampleIndex = minIdx;

    const sample = this._samples[minIdx];
    const distanceFromCenter = minDist;
    const trackWidth = 10; // m

    return {
      sampleIndex: minIdx,
      t: sample.t,
      distanceFromCenter,
      isOnTrack: distanceFromCenter <= trackWidth / 2 + 1,
    };
  }

  get lastSampleIndex(): number { return this._lastSampleIndex; }
  reset(): void { this._lastSampleIndex = 0; }
}
