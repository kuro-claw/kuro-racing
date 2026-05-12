// ─── Audio Manager — Central Audio System ─────────────────────────
// KR-016: Coordinates engine and tire audio.

import { EngineAudio } from './engine';
import { TireAudio } from './tires';

export interface AudioUpdateParams {
  rpm: number;
  throttle: number;
  slipMagnitude: number; // 0-1
  surfaceGrip: number;   // 0-1
  speed: number;         // m/s
}

export class AudioManager {
  private _engine: EngineAudio;
  private _tires: TireAudio;
  private _initialized: boolean = false;
  private _ctx: AudioContext | null = null;

  constructor() {
    this._engine = new EngineAudio();
    this._tires = new TireAudio();
  }

  /**
   * Initialize audio — must be called after a user gesture (click/keypress).
   */
  init(): boolean {
    const ok = this._engine.init();
    if (!ok) return false;

    // Share audio context with tire audio
    // @ts-ignore -- access internal ctx
    this._ctx = (this._engine as unknown as { _ctx: AudioContext })._ctx;
    if (this._ctx) {
      this._tires.init(this._ctx);
    }

    this._initialized = true;
    return true;
  }

  /**
   * Update all audio systems.
   */
  update(params: AudioUpdateParams): void {
    if (!this._initialized) return;

    this._engine.update(params.rpm, params.throttle);
    this._tires.update(params.slipMagnitude, params.surfaceGrip, params.speed);
  }

  start(): void {
    if (this._initialized) {
      this._engine.start();
    }
  }

  stop(): void {
    if (this._initialized) {
      this._engine.stop();
    }
  }

  dispose(): void {
    this._engine.dispose();
    this._tires.dispose();
  }

  get isInitialized(): boolean { return this._initialized; }
}
