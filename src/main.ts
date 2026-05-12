// ─── KuroRacing — Main Entry Point ───────────────────────────────
// Wires all game systems together into a running game.

import { Vector3 } from '@babylonjs/core';
import { init } from './core/engine';
import { InputManager } from './core/input';
import { Vehicle } from './physics/vehicle';
import { PHANTOM_CONFIG } from './cars/phantom';
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
    const vehicle = new Vehicle(scene, PHANTOM_CONFIG);

    // Position vehicle at track start — a few samples in so it's clear of barriers
    const startSample = trackSamples[3] ?? trackSamples[0];
    if (startSample) {
      vehicle.node.position.copyFrom(
        startSample.position.add(new Vector3(0, 0.5, 0))
      );
    }

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
      // Initialize audio on first user interaction
      if (!audioReady) {
        audioReady = audioManager.init();
        if (audioReady) audioManager.start();
      }

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

      // Replace idle loop with full game loop
      engine.stopRenderLoop();
      engine.runRenderLoop(() => {
        const deltaMs = engine.getDeltaTime();
        const dt = Math.min(deltaMs / 1000, 0.05); // seconds, capped at 50ms
        const now = performance.now();

        // Input
        const inputState = inputManager.update();

        // Vehicle
        vehicle.setInput(inputState);
        vehicle.update(dt);

        // Debug: log position & input every 60 frames
        if (Math.round(now / 16) % 60 === 0) {
          const p = vehicle.position;
          console.log(`[KR] pos=(${p.x.toFixed(1)},${p.z.toFixed(1)}) spd=${vehicle.speedKmh.toFixed(1)} rpm=${vehicle.rpm.toFixed(0)} throttle=${inputState.throttle} gear=${vehicle.gear}`);
        }

        // Time trial (uses ms timestamp)
        timeTrial.update(vehicle, now);

        // Camera
        const vehiclePos = vehicle.position;
        const vehicleQuat = vehicle.rotation;
        const vehicleRotEuler = vehicleQuat.toEulerAngles();
        cameraManager.setTarget(vehiclePos, vehicleRotEuler);
        cameraManager.update();

        // HUD
        const ttState = timeTrial.state;
        const closestSample = neonCircuit.closestPoint(vehiclePos);
        const hudData: HUDData = {
          speedKmh: vehicle.speedKmh,
          gear: vehicle.gear,
          rpm: vehicle.rpm,
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
            rpm: vehicle.rpm,
            throttle: inputState.throttle,
            slipMagnitude: 0,
            surfaceGrip,
            speed: vehicle.speed,
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
