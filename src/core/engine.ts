import { Engine, Scene, Vector3 } from '@babylonjs/core';

export interface KuroRacingEngine {
  engine: Engine;
  scene: Scene;
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

  engine.runRenderLoop(() => {
    scene.render();
  });

  window.addEventListener('resize', () => {
    engine.resize();
  });



  return { engine, scene };
}
