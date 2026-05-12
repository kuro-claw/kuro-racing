// Input system for KuroRacing — fully standalone, no Babylon.js dependency.
// Handles keyboard, gamepad, and touch inputs, normalized to 0-1 ranges.

// ─── Utility Functions ───────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalize(value: number, min: number, max: number): number {
  return clamp((value - min) / (max - min), 0, 1);
}

export function applyDeadzone(value: number, deadzone: number): number {
  if (Math.abs(value) < deadzone) return 0;
  if (value > 0) {
    return clamp((value - deadzone) / (1 - deadzone), 0, 1);
  }
  return clamp((value + deadzone) / (1 - deadzone), -1, 0);
}

export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return outMin + (value - inMin) * ((outMax - outMin) / (inMax - inMin));
}

// ─── Core Types ──────────────────────────────────────────────────

export interface InputState {
  throttle: number; // 0-1
  brake: number;    // 0-1
  steer: number;    // -1 (left) to 1 (right)
  clutch: boolean;
}

const EMPTY_STATE: InputState = Object.freeze({
  throttle: 0,
  brake: 0,
  steer: 0,
  clutch: false,
});

export interface InputConfig {
  deadzone: number;         // 0.1 default
  keyboardEnabled: boolean; // true default
  gamepadEnabled: boolean;  // true default
  touchEnabled: boolean;    // true default
  steerScale: number;       // 1.0 default
}

const DEFAULT_CONFIG: InputConfig = {
  deadzone: 0.1,
  keyboardEnabled: true,
  gamepadEnabled: true,
  touchEnabled: true,
  steerScale: 1.0,
};

// ─── Input Source Interface ──────────────────────────────────────

interface InputSource {
  attach(): void;
  detach(): void;
  update(): InputState;
}

// ─── KeyboardInput ───────────────────────────────────────────────

interface KeyboardImplOptions {
  document?: Document;
  config?: Partial<InputConfig>;
}

export class KeyboardInput implements InputSource {
  private keys = new Set<string>();
  private doc: Document;
  private deadzone: number;
  private attached = false;

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.key);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key);
  };

  constructor(opts?: KeyboardImplOptions) {
    this.doc = opts?.document ?? document;
    this.deadzone = opts?.config?.deadzone ?? DEFAULT_CONFIG.deadzone;
  }

  attach(): void {
    if (this.attached) return;
    this.doc.addEventListener('keydown', this.onKeyDown);
    this.doc.addEventListener('keyup', this.onKeyUp);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) return;
    this.doc.removeEventListener('keydown', this.onKeyDown);
    this.doc.removeEventListener('keyup', this.onKeyUp);
    this.keys.clear();
    this.attached = false;
  }

  update(): InputState {
    const throttleKeys = ['w', 'W', 'ArrowUp'];
    const brakeKeys = ['s', 'S', 'ArrowDown'];
    const steerLeftKeys = ['a', 'A', 'ArrowLeft'];
    const steerRightKeys = ['d', 'D', 'ArrowRight'];
    const clutchKeys = [' ', 'Spacebar'];

    let throttle = 0;
    let brake = 0;
    let steer = 0;
    let clutch = false;

    for (const key of throttleKeys) {
      if (this.keys.has(key)) { throttle = 1; break; }
    }
    for (const key of brakeKeys) {
      if (this.keys.has(key)) { brake = 1; break; }
    }

    let steerLeft = false;
    let steerRight = false;
    for (const key of steerLeftKeys) {
      if (this.keys.has(key)) { steerLeft = true; break; }
    }
    for (const key of steerRightKeys) {
      if (this.keys.has(key)) { steerRight = true; break; }
    }

    if (steerLeft && !steerRight) steer = -1;
    else if (steerRight && !steerLeft) steer = 1;
    // else both pressed or neither: steer = 0

    for (const key of clutchKeys) {
      if (this.keys.has(key)) { clutch = true; break; }
    }

    steer = applyDeadzone(steer, this.deadzone);

    return { throttle, brake, steer, clutch };
  }
}

// ─── GamepadInput ────────────────────────────────────────────────

interface GamepadInputOptions {
  navigator?: Navigator;
  window?: Window;
  config?: Partial<InputConfig>;
}

export class GamepadInput implements InputSource {
  private nav: Navigator;
  private win: Window;
  private deadzone: number;
  private gamepadIndex: number | null = null;
  private pollTimer: number | null = null;
  private attached = false;

  // Cached state (updated via polling)
  private throttle = 0;
  private brake = 0;
  private steer = 0;
  private clutch = false;

  private onGamepadConnect = (e: Event) => {
    const gamepad = (e as GamepadEvent).gamepad;
    if (gamepad.mapping === 'standard') {
      this.gamepadIndex = gamepad.index;
    }
  };

  private onGamepadDisconnect = (e: Event) => {
    const gamepad = (e as GamepadEvent).gamepad;
    if (this.gamepadIndex !== null && gamepad.index === this.gamepadIndex) {
      this.gamepadIndex = null;
      this.throttle = 0;
      this.brake = 0;
      this.steer = 0;
      this.clutch = false;
    }
  };

  private pollGamepad = () => {
    const gamepads = this.nav.getGamepads();
    // If no index set yet, scan for any connected standard gamepad
    if (this.gamepadIndex === null) {
      for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (gp && gp.connected && gp.mapping === 'standard') {
          this.gamepadIndex = gp.index;
          break;
        }
      }
      // If still no gamepad, reset state
      if (this.gamepadIndex === null) {
        this.throttle = 0;
        this.brake = 0;
        this.steer = 0;
        this.clutch = false;
        return;
      }
    }
    const gp = gamepads[this.gamepadIndex];
    if (!gp || !gp.connected) {
      this.gamepadIndex = null;
      this.throttle = 0;
      this.brake = 0;
      this.steer = 0;
      this.clutch = false;
      return;
    }

    // Left trigger (button 6) = throttle, right trigger (button 7) = brake
    this.throttle = gp.buttons[6]?.value ?? 0;
    this.brake = gp.buttons[7]?.value ?? 0;

    // Left stick X (axis 0) or D-pad = steer
    let steerVal = 0;
    // D-pad (buttons 14=left, 15=right) takes priority if pressed
    if (gp.buttons[14]?.pressed) {
      steerVal = -1;
    } else if (gp.buttons[15]?.pressed) {
      steerVal = 1;
    } else {
      steerVal = applyDeadzone(gp.axes[0] ?? 0, this.deadzone);
    }
    this.steer = steerVal;

    // A button (button 0) = clutch
    this.clutch = gp.buttons[0]?.pressed ?? false;
  };

  constructor(opts?: GamepadInputOptions) {
    this.nav = opts?.navigator ?? navigator;
    this.win = opts?.window ?? window;
    this.deadzone = opts?.config?.deadzone ?? DEFAULT_CONFIG.deadzone;
  }

  attach(): void {
    if (this.attached) return;
    this.win.addEventListener('gamepadconnect', this.onGamepadConnect as EventListener);
    this.win.addEventListener('gamepaddisconnect', this.onGamepadDisconnect as EventListener);

    // Start polling at 60Hz
    this.pollTimer = this.win.setInterval(this.pollGamepad, 16);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) return;
    this.win.removeEventListener('gamepadconnect', this.onGamepadConnect as EventListener);
    this.win.removeEventListener('gamepaddisconnect', this.onGamepadDisconnect as EventListener);
    if (this.pollTimer !== null) {
      this.win.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.throttle = 0;
    this.brake = 0;
    this.steer = 0;
    this.clutch = false;
    this.attached = false;
  }

  update(): InputState {
    if (!this.attached) {
      return { throttle: 0, brake: 0, steer: 0, clutch: false };
    }
    // Always re-poll on update for responsiveness
    this.pollGamepad();
    return {
      throttle: this.throttle,
      brake: this.brake,
      steer: this.steer,
      clutch: this.clutch,
    };
  }

  isConnected(): boolean {
    return this.gamepadIndex !== null;
  }
}

// ─── TouchInput ──────────────────────────────────────────────────

interface TouchInputOptions {
  document?: Document;
  config?: Partial<InputConfig>;
}

export class TouchInput implements InputSource {
  private doc: Document;
  private activeTouches = new Map<number, { x: number; y: number }>();
  private attached = false;

  private onTouchStart = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      this.activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (this.activeTouches.has(t.identifier)) {
        this.activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      this.activeTouches.delete(e.changedTouches[i].identifier);
    }
  };

  constructor(opts?: TouchInputOptions) {
    this.doc = opts?.document ?? document;
  }

  attach(): void {
    if (this.attached) return;
    this.doc.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.doc.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.doc.addEventListener('touchend', this.onTouchEnd, { passive: false });
    this.doc.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) return;
    this.doc.removeEventListener('touchstart', this.onTouchStart);
    this.doc.removeEventListener('touchmove', this.onTouchMove);
    this.doc.removeEventListener('touchend', this.onTouchEnd);
    this.doc.removeEventListener('touchcancel', this.onTouchEnd);
    this.activeTouches.clear();
    this.attached = false;
  }

  update(): InputState {
    let throttle = 0;
    let brake = 0;
    let steer = 0;
    let clutch = false;

    const touchCount = this.activeTouches.size;

    // Two fingers = clutch
    if (touchCount >= 2) {
      clutch = true;
    }

    let leftTouch: { x: number; y: number } | null = null;
    let rightBottomTouch: { x: number; y: number } | null = null;
    let rightTopTouch: { x: number; y: number } | null = null;

    const halfWidth = (this.doc.body?.clientWidth ?? 800) / 2;

    for (const touch of this.activeTouches.values()) {
      if (touch.x < halfWidth) {
        // Left side: steer
        if (!leftTouch || Math.abs(touch.x - halfWidth) > Math.abs(leftTouch.x - halfWidth)) {
          leftTouch = touch;
        }
      } else {
        // Right side: throttle/brake zones
        const height = this.doc.body?.clientHeight ?? 600;
        const third = height / 3;
        if (touch.y > third * 2) {
          // Bottom third = throttle
          if (!rightBottomTouch || touch.y > rightBottomTouch.y) {
            rightBottomTouch = touch;
          }
        } else if (touch.y < third) {
          // Top third = brake
          if (!rightTopTouch || touch.y < rightTopTouch.y) {
            rightTopTouch = touch;
          }
        }
      }
    }

    if (leftTouch) {
      steer = mapRange(leftTouch.x, 0, halfWidth, -1, 1);
      steer = clamp(steer, -1, 1);
    }

    if (rightBottomTouch) {
      throttle = 1;
    }

    if (rightTopTouch) {
      brake = 1;
    }

    return { throttle, brake, steer, clutch };
  }
}

// ─── InputManager ────────────────────────────────────────────────

export type InputSourceName = 'keyboard' | 'gamepad' | 'touch' | 'auto';

interface InputManagerOptions {
  document?: Document;
  navigator?: Navigator;
  window?: Window;
  config?: Partial<InputConfig>;
}

export class InputManager {
  private config: InputConfig;
  private keyboard: KeyboardInput;
  private gamepad: GamepadInput;
  private touch: TouchInput;
  private source: InputSourceName = 'auto';
  private attached = false;

  constructor(opts?: InputManagerOptions) {
    this.config = { ...DEFAULT_CONFIG, ...opts?.config };

    this.keyboard = new KeyboardInput({
      document: opts?.document,
      config: { deadzone: this.config.deadzone },
    });
    this.gamepad = new GamepadInput({
      navigator: opts?.navigator,
      window: opts?.window,
      config: { deadzone: this.config.deadzone },
    });
    this.touch = new TouchInput({
      document: opts?.document,
      config: { deadzone: this.config.deadzone },
    });
  }

  attach(): void {
    if (this.attached) return;
    if (this.config.keyboardEnabled) this.keyboard.attach();
    if (this.config.gamepadEnabled) this.gamepad.attach();
    if (this.config.touchEnabled) this.touch.attach();
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) return;
    this.keyboard.detach();
    this.gamepad.detach();
    this.touch.detach();
    this.attached = false;
  }

  setSource(source: InputSourceName): void {
    this.source = source;
  }

  update(): InputState {
    if (this.source === 'keyboard') {
      return this.applySteerScale(this.keyboard.update());
    }
    if (this.source === 'gamepad') {
      return this.applySteerScale(this.gamepad.update());
    }
    if (this.source === 'touch') {
      return this.applySteerScale(this.touch.update());
    }

    // Auto mode: merge inputs with priority
    const kbState = this.keyboard.update();
    const gpState = this.gamepad.update();
    const tcState = this.touch.update();

    let throttle = 0;
    let brake = 0;
    let steer = 0;
    let clutch = false;

    // Keyboard always contributes
    throttle = Math.max(throttle, kbState.throttle);
    brake = Math.max(brake, kbState.brake);
    steer += kbState.steer;
    clutch = clutch || kbState.clutch;

    // Gamepad overrides if connected
    if (this.gamepad.isConnected()) {
      throttle = Math.max(throttle, gpState.throttle);
      brake = Math.max(brake, gpState.brake);
      steer += gpState.steer;
      clutch = clutch || gpState.clutch;
    }

    // Touch overrides if active
    if (this.hasActiveTouches()) {
      throttle = Math.max(throttle, tcState.throttle);
      brake = Math.max(brake, tcState.brake);
      steer += tcState.steer;
      clutch = clutch || tcState.clutch;
    }

    // Clamp steer
    steer = clamp(steer, -1, 1);

    return this.applySteerScale({ throttle, brake, steer, clutch });
  }

  private applySteerScale(state: InputState): InputState {
    if (this.config.steerScale === 1.0) return state;
    return {
      ...state,
      steer: clamp(state.steer * this.config.steerScale, -1, 1),
    };
  }

  private hasActiveTouches(): boolean {
    // Poll touch input to see if there are active touches
    // We check by seeing if touch.update() returns non-zero values
    const state = this.touch.update();
    return state.throttle > 0 || state.brake > 0 || state.steer !== 0 || state.clutch;
  }

  getKeyboardInput(): KeyboardInput {
    return this.keyboard;
  }

  getGamepadInput(): GamepadInput {
    return this.gamepad;
  }

  getTouchInput(): TouchInput {
    return this.touch;
  }
}
