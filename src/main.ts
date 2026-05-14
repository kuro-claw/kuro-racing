// ─── KuroRacing — Main Entry Point ───────────────────────────────
// Wires all game systems together into a running game.

import { Quaternion, Vector3 } from '@babylonjs/core';
import { init } from './core/engine';
import { InputManager } from './core/input';
import { Vehicle } from './physics/vehicle';
import { PHANTOM_CONFIG } from './cars/phantom';
import { VIPER_CONFIG } from './cars/viper';
import { NeonCircuit, NEON_CIRCUIT_CONFIG } from './tracks/neon-circuit';
import { RainbowBoulevard, RAINBOW_BOULEVARD_CONFIG } from './tracks/rainbow-boulevard';
import type { TrackConfig } from './track/track-config';
import type { TrackSample } from './tracks/neon-circuit';
import { TrackVisuals } from './track/visuals';
import { TrackZones } from './track/zones';
import { LapDetection } from './track/lap-detection';
import { HUD } from './ui/hud';
import type { HUDData } from './ui/hud';
import { Menu } from './ui/menu';
import { TimeTrial } from './game/timetrial';
import { AudioManager } from './audio/manager';
import { PostProcessingManager } from './rendering/post-processing';

// ─── Track Registry ───────────────────────────────────────────────

const TRACKS: Record<string, TrackConfig> = {
  'neon-circuit': NEON_CIRCUIT_CONFIG,
  'rainbow-boulevard': RAINBOW_BOULEVARD_CONFIG,
};

async function bootstrap(): Promise<void> {
  try {
    // ── 1. Engine ─────────────────────────────────────────────
    const { engine, scene, cameraManager, lighting, environment } = await init();

    // ── 2. Input ──────────────────────────────────────────────
    const inputManager = new InputManager();
    inputManager.attach();

    // ── 3. UI ─────────────────────────────────────────────────
    const hud = new HUD(scene);

    const menu = new Menu(scene);

    // ── 4. Audio ──────────────────────────────────────────────
    const audioManager = new AudioManager();

    // Audio must be initialized after a user gesture — init on first play
    let audioReady = false;

    // ── 5. Post-Processing ────────────────────────────────────
    const postFX = new PostProcessingManager(scene);
    postFX.init(cameraManager.getActiveCamera());

    // ── 6. Menu / Game Start ──────────────────────────────────
    menu.show('main');
    menu.onPlay(() => {
      // Select track
      const selectedTrack = menu.selectedTrack; // 'neon-circuit' or 'rainbow-boulevard'
      const trackConfig = TRACKS[selectedTrack];

      // Instantiate track based on selection
      let track: NeonCircuit | RainbowBoulevard;
      if (selectedTrack === 'rainbow-boulevard') {
        track = new RainbowBoulevard(scene);
      } else {
        track = new NeonCircuit(scene);
      }
      track.build();
      const trackSamples = track.samples;

      const trackVisuals = new TrackVisuals(scene);
      trackVisuals.build(trackSamples, trackConfig.width);

      const trackZones = new TrackZones(trackSamples, trackConfig.numSectors, trackConfig.width);
      const lapDetection = new LapDetection(trackZones);

      // Create vehicle from selected car
      const selectedCar = menu.selectedCar; // 'phantom' or 'viper'
      const vehicle = new Vehicle(scene, selectedCar === 'viper' ? VIPER_CONFIG : PHANTOM_CONFIG);

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

      // HUD setup
      hud.setTrackSamples(trackSamples);
      hud.setTrackName(trackConfig.name);

      // Create time trial with track-specific PB storage
      const timeTrial = new TimeTrial(scene, lapDetection, selectedTrack);

      const now = performance.now();
      timeTrial.start(now);
      startGameLoop(vehicle, trackZones, track, trackConfig, timeTrial);
    });

    // ── 7. Render Loop ────────────────────────────────────────
    // Idle loop — just renders menu + scene background before game starts
    engine.runRenderLoop(() => {
      scene.render();
    });

    let gameLoopStarted = false;

    function startGameLoop(
      vehicle: Vehicle,
      trackZones: TrackZones,
      track: NeonCircuit | RainbowBoulevard,
      trackConfig: TrackConfig,
      timeTrial: TimeTrial,
    ): void {
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
        const closestSample = track.closestPoint(vehiclePos);
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
          trackName: trackConfig.name,
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
