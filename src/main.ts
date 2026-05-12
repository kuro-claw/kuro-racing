import { init } from './core/engine';
import { Mesh, Vector3 } from '@babylonjs/core';

async function bootstrap(): Promise<void> {
  try {
    const { engine, scene, cameraManager, lighting, environment } = await init();

    const testSphere = Mesh.CreateSphere('testSphere', 16, 1, scene);
    testSphere.position = new Vector3(0, 1, 0);

    let angle = 0;
    const radius = 15;
    const speed = 0.01;

    engine.runRenderLoop(() => {
      angle += speed;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = 1 + Math.sin(angle * 2) * 2;

      testSphere.position = new Vector3(x, y, z);

      const targetRotation = new Vector3(0, -angle + Math.PI, 0);
      cameraManager.setTarget(testSphere.position, targetRotation);
      cameraManager.update();
      lighting.update();
      environment.update();
      scene.render();
    });

    console.log('[KuroRacing] Engine started', { engine, scene, cameraManager });
  } catch (error) {
    console.error('[KuroRacing] Failed to start:', error);
  }
}

bootstrap();
