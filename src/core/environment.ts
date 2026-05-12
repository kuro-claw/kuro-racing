import {
  Color3,
  Mesh,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';

export class EnvironmentManager {
  private ground!: Mesh;
  private fogDensity = 0.008;

  constructor(private scene: Scene) {}

  init(): void {
    // Ground plane — large flat surface, very dark with slight blue tint
    this.ground = Mesh.CreateGround('ground', 200, 200, 1, this.scene);
    this.ground.position.y = 0;
    this.ground.receiveShadows = true;

    const groundMat = new StandardMaterial('groundMat', this.scene);
    groundMat.diffuseColor = new Color3(0.031, 0.031, 0.071); // #080812
    groundMat.specularColor = new Color3(0.05, 0.05, 0.08);
    groundMat.disableLighting = false;
    this.ground.material = groundMat;

    // Exponential fog — dark night sky color
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogColor = new Color3(0.039, 0.02, 0.125); // #0a0520
    this.scene.fogDensity = this.fogDensity;
  }

  setFogDensity(density: number): void {
    this.fogDensity = density;
    this.scene.fogDensity = density;
  }

  getGroundPlane(): Mesh {
    return this.ground;
  }

  update(): void {
    // No-op for now — reserved for dynamic weather/time effects
  }
}
