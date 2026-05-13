// ─── Menu — Title Screen, Car Selection & Play Button ───────────
// KR-017: Synthwave menu with title and play button using Babylon GUI.
// KR-019: Added car selection between title and play button.

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
export type CarId = 'phantom' | 'viper';

export class Menu {
  private _adt: AdvancedDynamicTexture;
  private _container: Rectangle;
  private _state: MenuState = 'main';
  private _onPlay?: () => void;
  private _onResume?: () => void;
  private _selectedCar: CarId = 'phantom';

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
    spacer.height = '30px';
    spacer.thickness = 0;
    panel.addControl(spacer);

    // ── Car Selection ──────────────────────────────────────────
    const carLabel = new TextBlock('car-label');
    carLabel.text = 'SELECT CAR';
    carLabel.color = '#778899';
    carLabel.fontSize = 16;
    carLabel.fontFamily = 'monospace';
    carLabel.height = '25px';
    panel.addControl(carLabel);

    // Car selection container (two side-by-side car cards)
    const carRow = new StackPanel('car-row');
    carRow.isVertical = false;
    carRow.width = '100%';
    carRow.height = '90px';
    panel.addControl(carRow);

    // Phantom card
    const phantomCard = new Rectangle('phantom-card');
    phantomCard.width = '220px';
    phantomCard.height = '80px';
    phantomCard.cornerRadius = 4;
    phantomCard.thickness = 2;
    phantomCard.background = 'rgba(0, 60, 80, 0.6)';
    this._setCardStyle(phantomCard, true);
    phantomCard.onPointerClickObservable.add(() => {
      this._selectedCar = 'phantom';
      this._setCardStyle(phantomCard, true);
      this._setCardStyle(viperCard, false);
    });

    const phantomName = new TextBlock('phantom-name');
    phantomName.text = 'PHANTOM';
    phantomName.color = '#00f0ff';
    phantomName.fontSize = 20;
    phantomName.fontFamily = 'monospace';
    phantomName.height = '30px';
    phantomCard.addControl(phantomName);

    const phantomDesc = new TextBlock('phantom-desc');
    phantomDesc.text = 'RWD Sports Car';
    phantomDesc.color = '#88aacc';
    phantomDesc.fontSize = 14;
    phantomDesc.fontFamily = 'monospace';
    phantomDesc.height = '25px';
    phantomCard.addControl(phantomDesc);

    const phantomSpecs = new TextBlock('phantom-specs');
    phantomSpecs.text = '1400kg · 6AT · RWD';
    phantomSpecs.color = '#556677';
    phantomSpecs.fontSize = 11;
    phantomSpecs.fontFamily = 'monospace';
    phantomSpecs.height = '20px';
    phantomCard.addControl(phantomSpecs);

    carRow.addControl(phantomCard);

    // Viper card
    const viperCard = new Rectangle('viper-card');
    viperCard.width = '220px';
    viperCard.height = '80px';
    viperCard.cornerRadius = 4;
    viperCard.thickness = 2;
    this._setCardStyle(viperCard, false);

    const viperName = new TextBlock('viper-name');
    viperName.text = 'VIPER';
    viperName.color = '#ff44aa';
    viperName.fontSize = 20;
    viperName.fontFamily = 'monospace';
    viperName.height = '30px';
    viperCard.addControl(viperName);

    const viperDesc = new TextBlock('viper-desc');
    viperDesc.text = 'FWD Hot Hatch';
    viperDesc.color = '#cc88aa';
    viperDesc.fontSize = 14;
    viperDesc.fontFamily = 'monospace';
    viperDesc.height = '25px';
    viperCard.addControl(viperDesc);

    const viperSpecs = new TextBlock('viper-specs');
    viperSpecs.text = '1100kg · 6MT · FWD';
    viperSpecs.color = '#886688';
    viperSpecs.fontSize = 11;
    viperSpecs.fontFamily = 'monospace';
    viperSpecs.height = '20px';
    viperCard.addControl(viperSpecs);

    carRow.addControl(viperCard);

    // Spacer after car selection
    const spacer2 = new Rectangle('spacer2');
    spacer2.height = '30px';
    spacer2.thickness = 0;
    panel.addControl(spacer2);

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
    const spacer3 = new Rectangle('spacer3');
    spacer3.height = '40px';
    spacer3.thickness = 0;
    panel.addControl(spacer3);

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
  get selectedCar(): CarId { return this._selectedCar; }

  // ─── Helpers ──────────────────────────────────────────────────

  private _setCardStyle(card: Rectangle, selected: boolean): void {
    if (selected) {
      card.background = 'rgba(0, 80, 120, 0.8)';
      card.thickness = 2;
    } else {
      card.background = 'rgba(0, 40, 60, 0.5)';
      card.thickness = 1;
    }
  }

  dispose(): void {
    this._adt.dispose();
  }
}
