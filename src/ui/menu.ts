// ─── Menu — Title Screen, Car Selection, Track Selection & Play Button ──
// KR-017: Synthwave menu with title and play button using Babylon GUI.
// KR-019: Added car selection between title and play button.
// KR-020: Added track selection below car selection.

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
export type TrackId = 'neon-circuit' | 'rainbow-boulevard';

export class Menu {
  private _adt: AdvancedDynamicTexture;
  private _container: Rectangle;
  private _state: MenuState = 'main';
  private _onPlay?: () => void;
  private _onResume?: () => void;
  private _selectedCar: CarId = 'phantom';
  private _selectedTrack: TrackId = 'neon-circuit';

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
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
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
    spacer.height = '20px';
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
    spacer2.height = '20px';
    spacer2.thickness = 0;
    panel.addControl(spacer2);

    // ── Track Selection ────────────────────────────────────────
    const trackLabel = new TextBlock('track-label');
    trackLabel.text = 'SELECT TRACK';
    trackLabel.color = '#778899';
    trackLabel.fontSize = 16;
    trackLabel.fontFamily = 'monospace';
    trackLabel.height = '25px';
    panel.addControl(trackLabel);

    // Track selection container (two side-by-side track cards)
    const trackRow = new StackPanel('track-row');
    trackRow.isVertical = false;
    trackRow.width = '100%';
    trackRow.height = '90px';
    panel.addControl(trackRow);

    // Neon Circuit card
    const neonCard = new Rectangle('neon-card');
    neonCard.width = '220px';
    neonCard.height = '80px';
    neonCard.cornerRadius = 4;
    neonCard.thickness = 2;
    neonCard.background = 'rgba(0, 40, 50, 0.6)';
    this._setTrackCardStyle(neonCard, true);
    neonCard.onPointerClickObservable.add(() => {
      this._selectedTrack = 'neon-circuit';
      this._setTrackCardStyle(neonCard, true);
      this._setTrackCardStyle(rainbowCard, false);
    });

    const neonName = new TextBlock('neon-name');
    neonName.text = 'NEON CIRCUIT';
    neonName.color = '#00ccdd';
    neonName.fontSize = 20;
    neonName.fontFamily = 'monospace';
    neonName.height = '30px';
    neonCard.addControl(neonName);

    const neonDesc = new TextBlock('neon-desc');
    neonDesc.text = 'Oval circuit · 10m wide';
    neonDesc.color = '#669999';
    neonDesc.fontSize = 13;
    neonDesc.fontFamily = 'monospace';
    neonDesc.height = '25px';
    neonCard.addControl(neonDesc);

    const neonSectors = new TextBlock('neon-sectors');
    neonSectors.text = '200 samples · 3 sectors';
    neonSectors.color = '#445566';
    neonSectors.fontSize = 11;
    neonSectors.fontFamily = 'monospace';
    neonSectors.height = '20px';
    neonCard.addControl(neonSectors);

    trackRow.addControl(neonCard);

    // Rainbow Boulevard card
    const rainbowCard = new Rectangle('rainbow-card');
    rainbowCard.width = '220px';
    rainbowCard.height = '80px';
    rainbowCard.cornerRadius = 4;
    rainbowCard.thickness = 2;
    this._setTrackCardStyle(rainbowCard, false);

    const rainbowName = new TextBlock('rainbow-name');
    rainbowName.text = 'RAINBOW BOULEVARD';
    rainbowName.color = '#bb44ff';
    rainbowName.fontSize = 20;
    rainbowName.fontFamily = 'monospace';
    rainbowName.height = '30px';
    rainbowCard.addControl(rainbowName);

    const rainbowDesc = new TextBlock('rainbow-desc');
    rainbowDesc.text = 'Elevated figure-8 · 12m wide';
    rainbowDesc.color = '#9966bb';
    rainbowDesc.fontSize = 13;
    rainbowDesc.fontFamily = 'monospace';
    rainbowDesc.height = '25px';
    rainbowCard.addControl(rainbowDesc);

    const rainbowSectors = new TextBlock('rainbow-sectors');
    rainbowSectors.text = '240 samples · 3 sectors';
    rainbowSectors.color = '#665588';
    rainbowSectors.fontSize = 11;
    rainbowSectors.fontFamily = 'monospace';
    rainbowSectors.height = '20px';
    rainbowCard.addControl(rainbowSectors);

    trackRow.addControl(rainbowCard);

    // Spacer after track selection
    const spacer3 = new Rectangle('spacer3');
    spacer3.height = '20px';
    spacer3.thickness = 0;
    panel.addControl(spacer3);

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
    const spacer4 = new Rectangle('spacer4');
    spacer4.height = '30px';
    spacer4.thickness = 0;
    panel.addControl(spacer4);

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
  get selectedTrack(): TrackId { return this._selectedTrack; }

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

  private _setTrackCardStyle(card: Rectangle, selected: boolean): void {
    if (selected) {
      card.background = 'rgba(30, 20, 60, 0.8)';
      card.thickness = 2;
      card.color = '#aa44ff';
    } else {
      card.background = 'rgba(15, 10, 35, 0.5)';
      card.thickness = 1;
      card.color = '#330066';
    }
  }

  dispose(): void {
    this._adt.dispose();
  }
}
