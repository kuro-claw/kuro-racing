// ─── Post-Processing — Neon Visual Effects ────────────────────────
// KR-017: Bloom, depth of field, chromatic aberration, image processing.
// Uses Babylon.js DefaultRenderingPipeline.

import {
  Scene,
  Camera,
  GlowLayer,
  DefaultRenderingPipeline,
} from '@babylonjs/core';

export interface PostProcessConfig {
  bloomEnabled: boolean;
  bloomThreshold: number;
  bloomWeight: number;
  depthOfFieldEnabled: boolean;
  dofFocalLength: number;
  chromaticAberrationEnabled: boolean;
  chromaticAberrationAmount: number;
}

export const DEFAULT_POST_CONFIG: PostProcessConfig = {
  bloomEnabled: true,
  bloomThreshold: 0.3,
  bloomWeight: 0.6,
  depthOfFieldEnabled: true,
  dofFocalLength: 50,
  chromaticAberrationEnabled: true,
  chromaticAberrationAmount: 0.3,
};

// ─── Post-Processing Manager ─────────────────────────────────────

export class PostProcessingManager {
  private _scene: Scene;
  private _pipeline: DefaultRenderingPipeline | null = null;
  private _glowLayer: GlowLayer | null = null;
  private _config: PostProcessConfig;
  private _initialized: boolean = false;

  constructor(scene: Scene, config: PostProcessConfig = DEFAULT_POST_CONFIG) {
    this._scene = scene;
    this._config = { ...config };
  }

  /**
   * Initialize post-processing pipeline.
   * @param camera - Active camera to attach effects to.
   */
  init(camera: Camera): void {
    const pipeline = new DefaultRenderingPipeline(
      'kuro-racing-pipeline',
      true, // HDR
      this._scene,
      [camera]
    );

    // ── Bloom ──────────────────────────────────────────────────
    pipeline.bloomEnabled = this._config.bloomEnabled;
    pipeline.bloomThreshold = this._config.bloomThreshold;
    pipeline.bloomWeight = this._config.bloomWeight;
    pipeline.bloomKernel = 64;
    pipeline.bloomScale = 0.5;

    // ── Depth of Field ─────────────────────────────────────────
    pipeline.depthOfFieldEnabled = this._config.depthOfFieldEnabled;
    pipeline.depthOfField.focalLength = this._config.dofFocalLength;
    pipeline.depthOfField.fStop = 1.4;
    pipeline.depthOfField.focusDistance = 2000; // far focus

    // ── Chromatic Aberration ───────────────────────────────────
    pipeline.chromaticAberrationEnabled = this._config.chromaticAberrationEnabled;
    pipeline.chromaticAberration.aberrationAmount = this._config.chromaticAberrationAmount;
    pipeline.chromaticAberration.radialIntensity = 0.5;

    // ── Image Processing ───────────────────────────────────────
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.contrast = 1.2;
    pipeline.imageProcessing.exposure = 1.1;
    // Synthwave vignette
    pipeline.imageProcessing.vignetteEnabled = true;
    pipeline.imageProcessing.vignetteWeight = 3;
    pipeline.imageProcessing.vignetteCameraFov = 0.5;

    // ── FXAA ──────────────────────────────────────────────────
    pipeline.fxaaEnabled = true;

    this._pipeline = pipeline;

    // ── Glow Layer (neon bloom on emissive meshes) ─────────────
    const glow = new GlowLayer('post-glow', this._scene, {
      mainTextureFixedSize: 512,
    });
    glow.intensity = 1.5;
    this._glowLayer = glow;

    this._initialized = true;
  }

  // ─── Runtime controls ─────────────────────────────────────────

  setBloomStrength(weight: number): void {
    if (this._pipeline) {
      this._pipeline.bloomWeight = Math.max(0, Math.min(2, weight));
    }
  }

  setGlowIntensity(intensity: number): void {
    if (this._glowLayer) {
      this._glowLayer.intensity = Math.max(0, Math.min(5, intensity));
    }
  }

  /** Pulse glow for dramatic effects (lap complete, etc.) */
  pulseGlow(targetIntensity: number, durationMs: number): void {
    if (!this._glowLayer) return;
    const start = performance.now();
    const baseIntensity = this._glowLayer.intensity;

    const obs = this._scene.onBeforeRenderObservable.add(() => {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / durationMs, 1);
      const pulse = t < 0.5 ? t * 2 : (1 - t) * 2;
      if (this._glowLayer) {
        this._glowLayer.intensity = baseIntensity + (targetIntensity - baseIntensity) * pulse;
      }
      if (t >= 1) {
        this._scene.onBeforeRenderObservable.remove(obs);
        if (this._glowLayer) this._glowLayer.intensity = baseIntensity;
      }
    });
  }

  get isInitialized(): boolean { return this._initialized; }
  get pipeline(): DefaultRenderingPipeline | null { return this._pipeline; }
  get glowLayer(): GlowLayer | null { return this._glowLayer; }

  dispose(): void {
    this._pipeline?.dispose();
    this._glowLayer?.dispose();
  }
}
