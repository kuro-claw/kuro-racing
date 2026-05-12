import {
  DirectionalLight,
  HemisphericLight,
  PointLight,
  Scene,
  Vector3,
} from '@babylonjs/core';

export class LightingManager {
  private ambient!: PointLight;
  private hemi!: HemisphericLight;
  private moon!: DirectionalLight;
  private intensityMultiplier = 1.0;

  constructor(private scene: Scene) {}

  init(): void {
    // Dim ambient fill — PointLight as ambient substitute (Babylon.js 6 has no AmbientLight)
    this.ambient = new PointLight('ambient', new Vector3(0, 5, 0), this.scene);
    this.ambient.intensity = 0.15;
    this.ambient.diffuse.set(0.05, 0.03, 0.08);
    this.ambient.range = 100;

    // Hemisphere — diffuse (dark purple) → ground (very dark)
    this.hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), this.scene);
    this.hemi.diffuse.set(0.102, 0.039, 0.18);     // #1a0a2e
    this.hemi.groundColor.set(0.02, 0.02, 0.063); // #050510
    this.hemi.intensity = 0.4;

    // Moonlight — cool blue from above-back
    this.moon = new DirectionalLight('moon', new Vector3(-0.5, 1, -0.8), this.scene);
    this.moon.intensity = 0.3;
    this.moon.diffuse.set(0.6, 0.7, 0.9);
  }

  setIntensity(multiplier: number): void {
    this.intensityMultiplier = multiplier;
  }

  update(): void {
    // No-op for now — reserved for dynamic day/night or track-specific lighting
  }
}
