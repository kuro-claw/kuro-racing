// ─── Lap Detection — Timing & Checkpoint Logic ───────────────────
// KR-013: Lap counting, sector times, start/finish detection.

import { Vector3 } from '@babylonjs/core';
import type { Zone } from './zones';
import type { TrackZones } from './zones';

export interface LapTime {
  lapNumber: number;
  totalTime: number;     // ms
  sectorTimes: number[]; // ms per sector
  personal: boolean;     // was this a new PB?
}

export interface LapState {
  currentLap: number;
  lapStartTime: number;  // ms (Date.now() based)
  sectorStartTime: number;
  nextCheckpointIdx: number; // which checkpoint to hit next (in zones array)
  checkpointsHit: Set<string>;
  isActive: boolean;
  sectorTimes: number[];
}

export class LapDetection {
  private _zones: TrackZones;
  private _state: LapState;
  private _completedLaps: LapTime[] = [];
  private _personalBest: number = Infinity;

  constructor(zones: TrackZones) {
    this._zones = zones;
    this._state = {
      currentLap: 0,
      lapStartTime: 0,
      sectorStartTime: 0,
      nextCheckpointIdx: 0,
      checkpointsHit: new Set(),
      isActive: false,
      sectorTimes: [],
    };
  }

  // ─── Update ──────────────────────────────────────────────────

  /**
   * Call each frame with the car's world position and current time (ms).
   * Returns completed lap info if a lap was just finished, otherwise null.
   */
  update(pos: Vector3, now: number): LapTime | null {
    const zones = this._zones.zones;

    // Check all zones in order
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i];
      if (!this._zones.isInZone(pos, zone)) continue;
      if (this._state.checkpointsHit.has(zone.id)) continue; // already hit

      if (zone.type === 'start-finish') {
        return this._handleStartFinish(now);
      } else {
        this._handleCheckpoint(zone, now);
      }
    }

    return null;
  }

  private _handleStartFinish(now: number): LapTime | null {
    const state = this._state;

    if (!state.isActive) {
      // First crossing — start the lap
      state.isActive = true;
      state.lapStartTime = now;
      state.sectorStartTime = now;
      state.currentLap = 1;
      state.checkpointsHit = new Set(['start-finish']);
      state.sectorTimes = [];
      state.nextCheckpointIdx = 1; // first sector checkpoint
      return null;
    }

    // Check all checkpoints were hit before finishing
    const allHit = this._zones.zones
      .filter(z => z.type === 'checkpoint')
      .every(z => state.checkpointsHit.has(z.id));

    if (!allHit) return null; // must hit all checkpoints

    // Complete the lap
    const lapTime = now - state.lapStartTime;
    const lastSectorTime = now - state.sectorStartTime;
    const sectorTimes = [...state.sectorTimes, lastSectorTime];

    const isPB = lapTime < this._personalBest;
    if (isPB) this._personalBest = lapTime;

    const lap: LapTime = {
      lapNumber: state.currentLap,
      totalTime: lapTime,
      sectorTimes,
      personal: isPB,
    };
    this._completedLaps.push(lap);

    // Reset for next lap
    state.currentLap++;
    state.lapStartTime = now;
    state.sectorStartTime = now;
    state.checkpointsHit = new Set(['start-finish']);
    state.sectorTimes = [];

    return lap;
  }

  private _handleCheckpoint(zone: Zone, now: number): void {
    const state = this._state;
    if (!state.isActive) return;

    // Only count in-order checkpoints
    const checkpointZones = this._zones.zones.filter(z => z.type === 'checkpoint');
    const checkpointIdx = checkpointZones.indexOf(zone);
    if (checkpointIdx < 0) return;
    if (checkpointIdx !== this._state.nextCheckpointIdx - 1) return; // out of order

    const sectorTime = now - state.sectorStartTime;
    state.sectorTimes.push(sectorTime);
    state.sectorStartTime = now;
    state.checkpointsHit.add(zone.id);
    state.nextCheckpointIdx++;
  }

  // ─── Accessors ───────────────────────────────────────────────

  get currentLap(): number { return this._state.currentLap; }
  get isActive(): boolean { return this._state.isActive; }
  get completedLaps(): LapTime[] { return this._completedLaps; }
  get personalBest(): number { return this._personalBest; }

  currentLapTime(now: number): number {
    if (!this._state.isActive) return 0;
    return now - this._state.lapStartTime;
  }

  currentSectorTime(now: number): number {
    if (!this._state.isActive) return 0;
    return now - this._state.sectorStartTime;
  }

  reset(): void {
    this._state = {
      currentLap: 0,
      lapStartTime: 0,
      sectorStartTime: 0,
      nextCheckpointIdx: 0,
      checkpointsHit: new Set(),
      isActive: false,
      sectorTimes: [],
    };
  }
}
