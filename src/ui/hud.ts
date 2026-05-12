// ─── HUD — Synthwave In-Game Display ─────────────────────────────
// KR-014: Speed, gear, lap time, sector times, mini-map.
// Uses Babylon.js GUI.

import {
  AdvancedDynamicTexture,
  TextBlock,
  Rectangle,
  Control,
  StackPanel,
  Ellipse,
  Image,
} from '@babylonjs/gui';
import { Scene, Vector3 } from '@babylonjs/core';
import type { Vehicle } from '../physics/vehicle';
import type { TrackSample } from '../tracks/neon-circuit';
import type { LapDetection } from '../track/lap-detection';

// ─── HUD Data ─────────────────────────────────────────────────────

export interface HUDData {
  speedKmh: number;
  gear: number;
  rpm: number;
  currentLapTime: number; // ms
  lastLapTime: number;    // ms (0 = no previous lap)
  personalBest: number;   // ms (Infinity = no PB)
  sectorTimes: number[];  // ms
  carPosition: Vector3;
  trackProgress: number;  // 0-1
}

// ─── Time Formatter ───────────────────────────────────────────────

export function formatTime(ms: number): string {
  if (!isFinite(ms) || ms === 0) return '--:--.---';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

// ─── HUD Class ────────────────────────────────────────────────────

export class HUD {
  private _adt: AdvancedDynamicTexture;
  private _speedText!: TextBlock;
  private _gearText!: TextBlock;
  private _lapTimeText!: TextBlock;
  private _lastLapText!: TextBlock;
  private _pbText!: TextBlock;
  private _miniMap!: Rectangle;
  private _miniMapDot!: Ellipse;
  private _trackSamples: TrackSample[] = [];
  private _rpmBar!: Rectangle;
  private _rpmFill!: Rectangle;

  constructor(scene: Scene) {
    this._adt = AdvancedDynamicTexture.CreateFullscreenUI('hud', true, scene);
    this._build();
  }

  private _build(): void {
    // ── Speed display ───────────────────────────────────────────
    const speedPanel = new Rectangle('speed-panel');
    speedPanel.width = '200px';
    speedPanel.height = '100px';
    speedPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    speedPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    speedPanel.left = '-20px';
    speedPanel.top = '-100px';
    speedPanel.thickness = 0;
    speedPanel.background = 'rgba(0,0,0,0)';
    this._adt.addControl(speedPanel);

    this._speedText = new TextBlock('speed');
    this._speedText.text = '0';
    this._speedText.color = '#00f0ff';
    this._speedText.fontSize = 72;
    this._speedText.fontFamily = 'monospace';
    this._speedText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    speedPanel.addControl(this._speedText);

    const speedLabel = new TextBlock('speed-label');
    speedLabel.text = 'km/h';
    speedLabel.color = '#0080a0';
    speedLabel.fontSize = 16;
    speedLabel.fontFamily = 'monospace';
    speedLabel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    speedLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    speedPanel.addControl(speedLabel);

    // ── Gear indicator ──────────────────────────────────────────
    const gearPanel = new Rectangle('gear-panel');
    gearPanel.width = '80px';
    gearPanel.height = '80px';
    gearPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    gearPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    gearPanel.left = '-230px';
    gearPanel.top = '-110px';
    gearPanel.thickness = 2;
    gearPanel.color = '#ff0077';
    gearPanel.background = 'rgba(40,0,20,0.7)';
    this._adt.addControl(gearPanel);

    this._gearText = new TextBlock('gear');
    this._gearText.text = '1';
    this._gearText.color = '#ff66aa';
    this._gearText.fontSize = 48;
    this._gearText.fontFamily = 'monospace';
    gearPanel.addControl(this._gearText);

    // ── RPM bar ─────────────────────────────────────────────────
    this._rpmBar = new Rectangle('rpm-bar');
    this._rpmBar.width = '300px';
    this._rpmBar.height = '8px';
    this._rpmBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this._rpmBar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._rpmBar.left = '-20px';
    this._rpmBar.top = '-195px';
    this._rpmBar.thickness = 1;
    this._rpmBar.color = '#440033';
    this._rpmBar.background = 'rgba(20,0,10,0.5)';
    this._adt.addControl(this._rpmBar);

    this._rpmFill = new Rectangle('rpm-fill');
    this._rpmFill.width = '0px';
    this._rpmFill.height = '8px';
    this._rpmFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._rpmFill.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this._rpmFill.thickness = 0;
    this._rpmFill.background = '#ff0077';
    this._rpmBar.addControl(this._rpmFill);

    // ── Lap time ────────────────────────────────────────────────
    const timingPanel = new Rectangle('timing-panel');
    timingPanel.width = '220px';
    timingPanel.height = '90px';
    timingPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    timingPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    timingPanel.left = '20px';
    timingPanel.top = '20px';
    timingPanel.thickness = 1;
    timingPanel.color = '#440066';
    timingPanel.background = 'rgba(10,0,20,0.7)';
    this._adt.addControl(timingPanel);

    const timeStack = new StackPanel('time-stack');
    timeStack.isVertical = true;
    timingPanel.addControl(timeStack);

    this._lapTimeText = new TextBlock('lap-time');
    this._lapTimeText.text = '--:--.---';
    this._lapTimeText.color = '#cc66ff';
    this._lapTimeText.fontSize = 22;
    this._lapTimeText.fontFamily = 'monospace';
    this._lapTimeText.height = '30px';
    timeStack.addControl(this._lapTimeText);

    this._lastLapText = new TextBlock('last-lap');
    this._lastLapText.text = 'Last: --:--.---';
    this._lastLapText.color = '#8844aa';
    this._lastLapText.fontSize = 15;
    this._lastLapText.fontFamily = 'monospace';
    this._lastLapText.height = '22px';
    timeStack.addControl(this._lastLapText);

    this._pbText = new TextBlock('pb');
    this._pbText.text = 'PB: --:--.---';
    this._pbText.color = '#ffdd00';
    this._pbText.fontSize = 15;
    this._pbText.fontFamily = 'monospace';
    this._pbText.height = '22px';
    timeStack.addControl(this._pbText);

    // ── Mini-map ─────────────────────────────────────────────────
    this._miniMap = new Rectangle('mini-map');
    this._miniMap.width = '140px';
    this._miniMap.height = '140px';
    this._miniMap.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this._miniMap.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._miniMap.left = '-20px';
    this._miniMap.top = '20px';
    this._miniMap.thickness = 1;
    this._miniMap.color = '#330055';
    this._miniMap.background = 'rgba(5,0,15,0.75)';
    this._adt.addControl(this._miniMap);

    // Car dot on mini-map
    this._miniMapDot = new Ellipse('mini-dot');
    this._miniMapDot.width = '8px';
    this._miniMapDot.height = '8px';
    this._miniMapDot.background = '#00f0ff';
    this._miniMapDot.color = '#ffffff';
    this._miniMapDot.thickness = 0;
    this._miniMap.addControl(this._miniMapDot);
  }

  // ─── Update ───────────────────────────────────────────────────

  setTrackSamples(samples: TrackSample[]): void {
    this._trackSamples = samples;
  }

  update(data: HUDData): void {
    // Speed
    this._speedText.text = Math.round(data.speedKmh).toString();

    // Gear
    this._gearText.text = data.gear.toString();

    // RPM bar (0-7500 → 0-300px)
    const rpmPct = Math.min(data.rpm / 7500, 1);
    this._rpmFill.widthInPixels = rpmPct * 300;
    // Color shifts to red near redline
    if (rpmPct > 0.85) {
      this._rpmFill.background = '#ff2200';
    } else {
      this._rpmFill.background = '#ff0077';
    }

    // Lap time
    this._lapTimeText.text = formatTime(data.currentLapTime);
    this._lastLapText.text = `Last: ${formatTime(data.lastLapTime)}`;
    this._pbText.text = `PB: ${formatTime(data.personalBest)}`;

    // Mini-map car dot
    this._updateMiniMap(data.carPosition);
  }

  private _updateMiniMap(carPos: Vector3): void {
    if (this._trackSamples.length === 0) return;

    // Find track bounds for normalization
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const s of this._trackSamples) {
      minX = Math.min(minX, s.position.x);
      maxX = Math.max(maxX, s.position.x);
      minZ = Math.min(minZ, s.position.z);
      maxZ = Math.max(maxZ, s.position.z);
    }

    const rangeX = maxX - minX || 1;
    const rangeZ = maxZ - minZ || 1;
    const mapSize = 120; // px (inner area of 140px box)

    // Normalize car position to mini-map
    const nx = ((carPos.x - minX) / rangeX) - 0.5; // -0.5 to 0.5
    const nz = ((carPos.z - minZ) / rangeZ) - 0.5;

    this._miniMapDot.leftInPixels = nx * mapSize;
    this._miniMapDot.topInPixels = -nz * mapSize; // flip Z for screen coords
  }

  dispose(): void {
    this._adt.dispose();
  }
}
