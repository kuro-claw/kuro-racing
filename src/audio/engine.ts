// ─── Engine Audio — RPM-Mapped Engine Sound ────────────────────
// KR-016: Web Audio API oscillators for engine sound.
// Pitch maps to RPM, harmonics simulate engine character.

export class EngineAudio {
  private _ctx: AudioContext | null = null;
  private _oscillators: OscillatorNode[] = [];
  private _gainNode: GainNode | null = null;
  private _filterNode: BiquadFilterNode | null = null;
  private _started: boolean = false;

  /** Initialize audio context (must be called after user gesture) */
  init(): boolean {
    try {
      this._ctx = new AudioContext();
      this._gainNode = this._ctx.createGain();
      this._gainNode.gain.value = 0;

      this._filterNode = this._ctx.createBiquadFilter();
      this._filterNode.type = 'lowpass';
      this._filterNode.frequency.value = 800;

      // Primary oscillator (fundamental)
      const osc1 = this._ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = 80;
      osc1.connect(this._filterNode);

      // 2nd harmonic
      const osc2 = this._ctx.createOscillator();
      osc2.type = 'square';
      osc2.frequency.value = 160;
      const gain2 = this._ctx.createGain();
      gain2.gain.value = 0.3;
      osc2.connect(gain2);
      gain2.connect(this._filterNode);

      // 3rd harmonic (growl)
      const osc3 = this._ctx.createOscillator();
      osc3.type = 'sawtooth';
      osc3.frequency.value = 240;
      const gain3 = this._ctx.createGain();
      gain3.gain.value = 0.15;
      osc3.connect(gain3);
      gain3.connect(this._filterNode);

      this._filterNode.connect(this._gainNode);
      this._gainNode.connect(this._ctx.destination);

      osc1.start();
      osc2.start();
      osc3.start();

      this._oscillators = [osc1, osc2, osc3];
      this._started = true;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update engine sound based on RPM and throttle.
   * @param rpm - Current engine RPM (800-7500)
   * @param throttle - Throttle input (0-1)
   */
  update(rpm: number, throttle: number): void {
    if (!this._ctx || !this._gainNode || !this._filterNode || !this._started) return;
    if (this._ctx.state === 'suspended') return;

    const now = this._ctx.currentTime;
    const clampedRpm = Math.max(800, Math.min(7500, rpm));

    // Map RPM to base frequency (800 RPM = 40Hz, 7500 RPM = 375Hz)
    const baseFreq = (clampedRpm / 60) * 0.8; // RPM to Hz (roughly)

    // Update oscillator frequencies
    if (this._oscillators[0]) this._oscillators[0].frequency.setTargetAtTime(baseFreq, now, 0.05);
    if (this._oscillators[1]) this._oscillators[1].frequency.setTargetAtTime(baseFreq * 2, now, 0.05);
    if (this._oscillators[2]) this._oscillators[2].frequency.setTargetAtTime(baseFreq * 3, now, 0.05);

    // Volume based on throttle + idle minimum
    const volume = 0.05 + throttle * 0.2;
    this._gainNode.gain.setTargetAtTime(volume, now, 0.02);

    // Filter cutoff rises with RPM (higher RPM = more high-frequency content)
    const filterFreq = 400 + (clampedRpm / 7500) * 2000;
    this._filterNode.frequency.setTargetAtTime(filterFreq, now, 0.05);
  }

  start(): void {
    if (this._ctx?.state === 'suspended') {
      this._ctx.resume();
    }
    if (this._gainNode) {
      this._gainNode.gain.setTargetAtTime(0.05, this._ctx!.currentTime, 0.1);
    }
  }

  stop(): void {
    if (this._gainNode && this._ctx) {
      this._gainNode.gain.setTargetAtTime(0, this._ctx.currentTime, 0.3);
    }
  }

  dispose(): void {
    this._oscillators.forEach(o => { try { o.stop(); o.disconnect(); } catch {} });
    this._gainNode?.disconnect();
    this._filterNode?.disconnect();
    this._ctx?.close();
  }

  get isStarted(): boolean { return this._started; }
}
