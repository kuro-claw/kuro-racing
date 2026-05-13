// ─── KuroRacing — Main Entry Point ───────────────────────────────
// Wires all game systems together into a running game.

import { Quaternion, Vector3 } from '@babylonjs/core';
import { init } from './core/engine';
import { InputManager } from './core/input';
import { Vehicle } from './physics/vehicle';
import { PHANTOM_CONFIG } from './cars/phantom';
import { VIPER_CONFIG } from './cars/viper';
import { NeonCircuit } from './tracks/neon-circuit';
import { TrackVisuals } from './track/visuals';
import { TrackZones } from './track/zones';
import { LapDetection } from './track/lap-detection';
import { HUD } from './ui/hud';
import type { HUDData } from './ui/hud';
import { Menu } from './ui/menu';
import { TimeTrial } from './game/timetrial';
import { AudioManager } from './audio/manager';
import { PostProcessingManager } from './rendering/post-processing';

async function bootstrap(): Promise<void> {
  try {
    // ── 1. Engine ─────────────────────────────────────────────
    const { engine, scene, cameraManager, lighting, environment } = await init();

    // ── 2. Track ──────────────────────────────────────────────
    const neonCircuit = new NeonCircuit(scene);
    neonCircuit.build();
    const trackSamples = neonCircuit.samples;

    const trackVisuals = new TrackVisuals(scene);
    trackVisuals.build(trackSamples);

    const trackZones = new TrackZones(trackSamples, 3);
    const lapDetection = new LapDetection(trackZones);

    // ── 3. Vehicle ────────────────────────────────────────────
    // Vehicle is created later (after menu) when we know which car was selected.
    let vehicle: Vehicle | null = null;

    // ── 4. Input ──────────────────────────────────────────────
    const inputManager = new InputManager();
    inputManager.attach();

    // ── 5. UI ─────────────────────────────────────────────────
    const hud = new HUD(scene);
    hud.setTrackSamples(trackSamples);

    const menu = new Menu(scene);

    // ── 6. Game Mode ──────────────────────────────────────────
    const timeTrial = new TimeTrial(scene, lapDetection);

    // ── 7. Audio ──────────────────────────────────────────────
    const audioManager = new AudioManager();

    // Audio must be initialized after a user gesture — init on first play
    let audioReady = false;

    // ── 8. Post-Processing ────────────────────────────────────
    const postFX = new PostProcessingManager(scene);
    postFX.init(cameraManager.getActiveCamera());

    // ── 9. Menu / Game Start ──────────────────────────────────
    menu.show('main');
    menu.onPlay(() => {
      // Create vehicle from selected car
      const selectedCar = menu.selectedCar; // 'phantom' or 'viper'
      vehicle = new Vehicle(scene, selectedCar === 'viper' ? VIPER_CONFIG : PHANTOM_CONFIG);

      // Position and orient vehicle at track start
      const startSample = trackSamples[3] ?? trackSamples[0];
      if (startSample) {
        vehicle.node.position.copyFrom(
          startSample.position.add(new Vector3(0, 0.5, 0))
        );
        // Orient car along track tangent
        const fwd = startSample.tangent.clone();
        fwd.y = 0;
        fwd.normalize();
        const angle = Math.atan2(fwd.x, fwd.z);
        vehicle.node.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), angle);
      }

      // Initialize audio on first user interaction
      if (!audioReady) {
        audioReady = audioManager.init();
        if (audioReady) audioManager.start();
      }

      // Refocus canvas so keyboard events fire correctly after GUI button click
      const canvas = document.getElementById('render-canvas');
      if (canvas) canvas.focus();

      const now = performance.now();
      timeTrial.start(now);
      startGameLoop();
    });

    // ── 10. Render Loop ───────────────────────────────────────
    // Idle loop — just renders menu + scene background before game starts
    engine.runRenderLoop(() => {
      scene.render();
    });

    let gameLoopStarted = false;

    function startGameLoop(): void {
      if (gameLoopStarted) return;
      gameLoopStarted = true;

      // Safety check — vehicle must exist (created in onPlay)
      if (!vehicle) {
        console.error('[KuroRacing] Vehicle not initialized');
        return;
      }

      // Replace idle loop with full game loop
      engine.stopRenderLoop();
      engine.runRenderLoop(() => {
        const deltaMs = engine.getDeltaTime();
        const dt = Math.min(deltaMs / 1000, 0.05); // seconds, capped at 50ms
        const now = performance.now();

        // Input
        const inputState = inputManager.update();

        // Vehicle
        vehicle!.setInput(inputState);
        vehicle!.update(dt);

        // Time trial (uses ms timestamp)
        timeTrial.update(vehicle!, now);

        // Camera
        const vehiclePos = vehicle!.position;
        const vehicleQuat = vehicle!.rotation;
        const vehicleRotEuler = vehicleQuat.toEulerAngles();
        cameraManager.setTarget(vehiclePos, vehicleRotEuler);
        cameraManager.update();

        // HUD
        const ttState = timeTrial.state;
        const closestSample = neonCircuit.closestPoint(vehiclePos);
        const hudData: HUDData = {
          speedKmh: vehicle!.speedKmh,
          gear: vehicle!.gear,
          rpm: vehicle!.rpm,
          currentLapTime: timeTrial.currentLapTime(now),
          lastLapTime: ttState.lastLapTime,
          personalBest: ttState.personalBest,
          sectorTimes:
            ttState.lapTimes.length > 0
              ? (ttState.lapTimes[ttState.lapTimes.length - 1]?.sectorTimes ?? [])
              : [],
          carPosition: vehiclePos,
          trackProgress: closestSample.sample.t,
        };
        hud.update(hudData);

        // Audio
        if (audioReady) {
          const surfaceGrip = trackZones.getSurfaceGrip(vehiclePos);
          audioManager.update({
            rpm: vehicle!.rpm,
            throttle: inputState.throttle,
            slipMagnitude: 0,
            surfaceGrip,
            speed: vehicle!.speed,
          });
        }

        // Lighting & environment
        lighting.update();
        environment.update();

        // Render
        scene.render();
      });
    }

    console.log('[KuroRacing] Initialized — waiting for player to start');
  } catch (error) {
    console.error('[KuroRacing] Failed to start:', error);
  }
}

bootstrap();
