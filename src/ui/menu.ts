// ─── Menu — Title Screen & Play Button ───────────────────────────
// KR-017: Synthwave menu with title and play button using Babylon GUI.

import {
  AdvancedDynamicTexture,
  TextBlock,
  Rectangle,
  Button,
  Control,
  StackPanel,
} from '@babylonjs/gui';
import { Scene } from '@babylonjs/core';

export type MenuState = 'main' | 'paused' | 'hidden';

export class Menu {
  private _adt: AdvancedDynamicTexture;
  private _container: Rectangle;
  private _state: MenuState = 'main';
  private _onPlay?: () => void;
  private _onResume?: () => void;

  constructor(scene: Scene) {
    this._adt = AdvancedDynamicTexture.CreateFullscreenUI('menu', true, scene);
    this._container = this._buildMain();
  }

  private _buildMain(): Rectangle {
    // Full-screen overlay
    const overlay = new Rectangle('menu-overlay');
    overlay.width = '100%';
    overlay.height = '100%';
    overlay.thickness = 0;
    overlay.background = 'rgba(5, 0, 15, 0.90)';
    this._adt.addControl(overlay);

    const panel = new StackPanel('menu-panel');
    panel.isVertical = true;
    panel.width = '500px';
    overlay.addControl(panel);

    // Title
    const title = new TextBlock('title');
    title.text = 'KURO RACING';
    title.color = '#00f0ff';
    title.fontSize = 72;
    title.fontFamily = 'monospace';
    title.height = '100px';
    title.shadowColor = '#ff0077';
    title.shadowOffsetX = 3;
    title.shadowOffsetY = 3;
    panel.addControl(title);

    // Subtitle
    const subtitle = new TextBlock('subtitle');
    subtitle.text = '— SYNTHWAVE DRIFT —';
    subtitle.color = '#cc44ff';
    subtitle.fontSize = 22;
    subtitle.fontFamily = 'monospace';
    subtitle.height = '40px';
    panel.addControl(subtitle);

    // Spacer
    const spacer = new Rectangle('spacer');
    spacer.height = '60px';
    spacer.thickness = 0;
    panel.addControl(spacer);

    // Play button
    const playBtn = Button.CreateSimpleButton('play-btn', 'RACE');
    playBtn.width = '200px';
    playBtn.height = '60px';
    playBtn.color = '#00f0ff';
    playBtn.cornerRadius = 4;
    playBtn.background = 'rgba(0, 40, 60, 0.8)';
    playBtn.fontSize = 28;
    playBtn.fontFamily = 'monospace';
    playBtn.thickness = 2;
    panel.addControl(playBtn);

    playBtn.onPointerClickObservable.add(() => {
      this.hide();
      this._onPlay?.();
    });

    // Controls hint
    const spacer2 = new Rectangle('spacer2');
    spacer2.height = '40px';
    spacer2.thickness = 0;
    panel.addControl(spacer2);

    const controls = new TextBlock('controls');
    controls.text = 'WASD / Arrow Keys — Drive\nSpace — Handbrake\nClick to enable audio';
    controls.color = '#445566';
    controls.fontSize = 14;
    controls.fontFamily = 'monospace';
    controls.height = '70px';
    controls.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.addControl(controls);

    return overlay;
  }

  // ─── Navigation ───────────────────────────────────────────────

  show(state: MenuState = 'main'): void {
    this._state = state;
    this._container.isVisible = true;
  }

  hide(): void {
    this._state = 'hidden';
    this._container.isVisible = false;
  }

  onPlay(cb: () => void): void { this._onPlay = cb; }
  onResume(cb: () => void): void { this._onResume = cb; }

  get state(): MenuState { return this._state; }
  get isVisible(): boolean { return this._container.isVisible; }

  dispose(): void {
    this._adt.dispose();
  }
}
