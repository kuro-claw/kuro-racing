// ─── Time Trial Mode — Game Mode Logic ───────────────────────────
// KR-015: Countdown, race, lap times, personal best (localStorage), ghost replay.
// KR-020: Per-track personal best storage.

import type { Vehicle } from '../physics/vehicle';
import type { LapDetection, LapTime } from '../track/lap-detection';
import { GhostRecorder, GhostPlayer } from './ghost';
import type { Scene } from '@babylonjs/core';

// ─── Local Storage ────────────────────────────────────────────────

const PB_STORAGE_PREFIX = 'kuro-racing:time-trial:pb:';

function getStorageKey(trackId: string): string {
  return `${PB_STORAGE_PREFIX}${trackId}`;
}

export function loadPersonalBest(trackId: string): number {
  try {
    const stored = localStorage.getItem(getStorageKey(trackId));
    if (stored) {
      const val = parseFloat(stored);
      if (isFinite(val) && val > 0) return val;
    }
  } catch {
    // localStorage unavailable (SSR, private mode, etc.)
  }
  return Infinity;
}

export function savePersonalBest(trackId: string, ms: number): void {
  try {
    localStorage.setItem(getStorageKey(trackId), ms.toString());
  } catch {
    // ignore
  }
}

// ─── Time Trial State ─────────────────────────────────────────────

export type TimeTrialPhase = 'idle' | 'countdown' | 'racing' | 'finished';

export interface TimeTrialState {
  phase: TimeTrialPhase;
  countdown: number;     // seconds remaining (3, 2, 1, GO)
  currentLap: number;
  lapTimes: LapTime[];
  personalBest: number;  // ms
  lastLapTime: number;   // ms (0 if no lap completed)
}

// ─── Time Trial Class ─────────────────────────────────────────────

export class TimeTrial {
  private _state: TimeTrialState;
  private _lapDetection: LapDetection;
  private _ghostRecorder: GhostRecorder;
  private _ghostPlayer: GhostPlayer;
  private _trackId: string;
  private _countdownStartTime: number = 0;
  private _bestGhostFrames: ReturnType<GhostRecorder['stop']> = [];

  constructor(scene: Scene, lapDetection: LapDetection, trackId: string = 'neon-circuit') {
    this._trackId = trackId;
    this._lapDetection = lapDetection;
    this._ghostRecorder = new GhostRecorder();
    this._ghostPlayer = new GhostPlayer(scene);

    this._state = {
      phase: 'idle',
      countdown: 3,
      currentLap: 0,
      lapTimes: [],
      personalBest: loadPersonalBest(trackId),
      lastLapTime: 0,
    };
  }

  // ─── Lifecycle ────────────────────────────────────────────────

  start(now: number): void {
    this._state.phase = 'countdown';
    this._state.countdown = 3;
    this._countdownStartTime = now;
  }

  // ─── Update ───────────────────────────────────────────────────

  update(vehicle: Vehicle, now: number): void {
    const state = this._state;

    if (state.phase === 'countdown') {
      const elapsed = (now - this._countdownStartTime) / 1000;
      const remaining = Math.max(0, 3 - Math.floor(elapsed));
      state.countdown = remaining;

      if (elapsed >= 3) {
        state.phase = 'racing';
        this._lapDetection.reset();
      }
      return;
    }

    if (state.phase !== 'racing') return;

    // Ghost recording
    const rot = vehicle.rotation;
    this._ghostRecorder.record(vehicle.position, rot, vehicle.speed, now);

    // Lap detection update
    const completedLap = this._lapDetection.update(vehicle.position, now);
    if (completedLap) {
      this._onLapComplete(completedLap, vehicle, now);
    }

    // Ghost playback
    if (this._ghostPlayer.isPlaying) {
      this._ghostPlayer.update(now);
    }
  }

  private _onLapComplete(lap: LapTime, vehicle: Vehicle, now: number): void {
    const state = this._state;
    state.lapTimes.push(lap);
    state.currentLap = lap.lapNumber;
    state.lastLapTime = lap.totalTime;

    // Check personal best
    if (lap.totalTime < state.personalBest) {
      state.personalBest = lap.totalTime;
      savePersonalBest(this._trackId, lap.totalTime);
      // Save ghost frames from this lap
      this._bestGhostFrames = this._ghostRecorder.stop();
    } else {
      this._ghostRecorder.stop();
    }

    // Start new lap recording
    this._ghostRecorder.start(now);

    // Play ghost from best lap on next lap
    if (this._bestGhostFrames.length > 0) {
      this._ghostPlayer.load(this._bestGhostFrames);
      this._ghostPlayer.start(now);
    }
  }

  // ─── Accessors ───────────────────────────────────────────────

  get state(): Readonly<TimeTrialState> { return this._state; }
  get phase(): TimeTrialPhase { return this._state.phase; }
  get countdown(): number { return this._state.countdown; }
  get ghostPlayer(): GhostPlayer { return this._ghostPlayer; }
  get ghostRecorder(): GhostRecorder { return this._ghostRecorder; }

  currentLapTime(now: number): number {
    return this._lapDetection.currentLapTime(now);
  }

  dispose(): void {
    this._ghostPlayer.dispose();
  }
}
