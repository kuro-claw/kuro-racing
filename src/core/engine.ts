import { Engine, Scene, Vector3 } from '@babylonjs/core';
import { CameraManager } from './camera';
import { LightingManager } from './lighting';
import { EnvironmentManager } from './environment';

export interface KuroRacingEngine {
  engine: Engine;
  scene: Scene;
  cameraManager: CameraManager;
  lighting: LightingManager;
  environment: EnvironmentManager;
}

export async function init(): Promise<KuroRacingEngine> {
  const canvas = document.getElementById('render-canvas');
  if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Canvas element #render-canvas not found or is not a canvas');
  }

  const engine = new Engine(canvas, true, {
    stencil: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });

  const scene = new Scene(engine);
  scene.gravity = new Vector3(0, -9.81, 0);

  const cameraManager = new CameraManager(scene);
  cameraManager.attach();

  const lighting = new LightingManager(scene);
  lighting.init();

  const environment = new EnvironmentManager(scene);
  environment.init();

  window.addEventListener('resize', () => {
    engine.resize();
  });

  return { engine, scene, cameraManager, lighting, environment };
}
