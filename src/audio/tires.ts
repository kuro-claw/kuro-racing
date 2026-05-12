// ─── Tire Audio — Slip-Based Tire Noise ──────────────────────────
// KR-016: Noise oscillator + filter for tire squeal/rumble.

export class TireAudio {
  private _ctx: AudioContext | null = null;
  private _noise: AudioBufferSourceNode | null = null;
  private _gainNode: GainNode | null = null;
  private _filterNode: BiquadFilterNode | null = null;
  private _started: boolean = false;

  init(ctx: AudioContext): void {
    this._ctx = ctx;

    // Create noise buffer (white noise)
    const bufferSize = ctx.sampleRate * 2; // 2 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this._noise = ctx.createBufferSource();
    this._noise.buffer = buffer;
    this._noise.loop = true;

    this._filterNode = ctx.createBiquadFilter();
    this._filterNode.type = 'bandpass';
    this._filterNode.frequency.value = 1200;
    this._filterNode.Q.value = 2;

    this._gainNode = ctx.createGain();
    this._gainNode.gain.value = 0;

    this._noise.connect(this._filterNode);
    this._filterNode.connect(this._gainNode);
    this._gainNode.connect(ctx.destination);
    this._noise.start();

    this._started = true;
  }

  /**
   * Update tire noise based on slip and surface.
   * @param slipMagnitude - Combined slip magnitude (0 = no slip, 1 = full lock)
   * @param surfaceGrip - Surface grip multiplier (1.0 = tarmac, 0.6 = grass)
   * @param speed - Vehicle speed (m/s)
   */
  update(slipMagnitude: number, surfaceGrip: number, speed: number): void {
    if (!this._ctx || !this._gainNode || !this._filterNode || !this._started) return;

    const now = this._ctx.currentTime;

    // Squeal volume: high slip on tarmac = loud
    const squealVol = Math.min(slipMagnitude * 0.3, 0.25) * (surfaceGrip > 0.8 ? 1 : 0.3);

    // Off-track rumble: low grip surface at speed
    const rumbleVol = (1 - surfaceGrip) * Math.min(speed / 30, 1) * 0.2;

    const totalVol = Math.max(squealVol, rumbleVol);
    this._gainNode.gain.setTargetAtTime(totalVol, now, 0.05);

    // Filter frequency: squeal = high freq, rumble = low freq
    const filterFreq = surfaceGrip > 0.8 ? 1200 + slipMagnitude * 1000 : 300;
    this._filterNode.frequency.setTargetAtTime(filterFreq, now, 0.05);
  }

  dispose(): void {
    try { this._noise?.stop(); } catch {}
    this._noise?.disconnect();
    this._filterNode?.disconnect();
    this._gainNode?.disconnect();
  }

  get isStarted(): boolean { return this._started; }
}
