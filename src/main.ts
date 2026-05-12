import { init } from './core/engine';

async function bootstrap(): Promise<void> {
  try {
    const { engine, scene } = await init();
    console.log('[KuroRacing] Engine started', { engine, scene });
  } catch (error) {
    console.error('[KuroRacing] Failed to start:', error);
  }
}

bootstrap();
