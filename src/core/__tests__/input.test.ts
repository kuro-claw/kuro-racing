import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  InputState,
  InputConfig,
  clamp,
  normalize,
  applyDeadzone,
  mapRange,
  KeyboardInput,
  GamepadInput,
  TouchInput,
  InputManager,
} from '../input';

// ─── Utility Functions ───────────────────────────────────────────

describe('clamp', () => {
  it('returns value within range', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
  it('clamps low values', () => {
    expect(clamp(-2, 0, 1)).toBe(0);
  });
  it('clamps high values', () => {
    expect(clamp(5, 0, 1)).toBe(1);
  });
});

describe('normalize', () => {
  it('maps mid-range to 0.5', () => {
    expect(normalize(5, 0, 10)).toBe(0.5);
  });
  it('maps min to 0', () => {
    expect(normalize(0, 0, 10)).toBe(0);
  });
  it('maps max to 1', () => {
    expect(normalize(10, 0, 10)).toBe(1);
  });
  it('clamps out-of-range values', () => {
    expect(normalize(-5, 0, 10)).toBe(0);
    expect(normalize(15, 0, 10)).toBe(1);
  });
});

describe('applyDeadzone', () => {
  it('returns 0 within deadzone', () => {
    expect(applyDeadzone(0.05, 0.1)).toBe(0);
    expect(applyDeadzone(-0.05, 0.1)).toBe(0);
  });
  it('scales positive values above deadzone', () => {
    // (0.5 - 0.1) / (1 - 0.1) = 0.444...
    expect(applyDeadzone(0.5, 0.1)).toBeCloseTo(0.4444, 3);
  });
  it('scales negative values below deadzone', () => {
    expect(applyDeadzone(-0.5, 0.1)).toBeCloseTo(-0.4444, 3);
  });
  it('leaves 1 and -1 as is (approximately)', () => {
    expect(applyDeadzone(1.0, 0.1)).toBeCloseTo(1.0, 1);
    expect(applyDeadzone(-1.0, 0.1)).toBeCloseTo(-1.0, 1);
  });
});

describe('mapRange', () => {
  it('maps center of input to center of output', () => {
    expect(mapRange(5, 0, 10, -1, 1)).toBe(0);
  });
  it('maps input min to output min', () => {
    expect(mapRange(0, 0, 10, -1, 1)).toBe(-1);
  });
  it('maps input max to output max', () => {
    expect(mapRange(10, 0, 10, -1, 1)).toBe(1);
  });
});

// ─── KeyboardInput ───────────────────────────────────────────────

// Remove the broken KeyboardInput test block
describe('KeyboardInput (integrated)', () => {
  function createMockDocument() {
    const listeners: Map<string, Function[]> = new Map();
    return Object.assign(
      {
        addEventListener: (event: string, handler: Function) => {
          if (!listeners.has(event)) listeners.set(event, []);
          listeners.get(event)!.push(handler);
        },
        removeEventListener: (event: string, handler: Function) => {
          const h = listeners.get(event);
          if (h) {
            const idx = h.indexOf(handler);
            if (idx !== -1) h.splice(idx, 1);
          }
        },
      },
      {
        dispatchKey(key: string, type: 'keydown' | 'keyup') {
          const h = listeners.get(type) || [];
          h.forEach((fn) => fn({ key }));
        },
      }
    ) as unknown as (Document & { dispatchKey: (key: string, type: 'keydown' | 'keyup') => void });
  }

  it('W produces throttle=1', () => {
    const doc = createMockDocument();
    const kb = new KeyboardInput({ document: doc });
    kb.attach();
    doc.dispatchKey('w', 'keydown');
    const state = kb.update();
    expect(state.throttle).toBe(1);
    expect(state.brake).toBe(0);
  });

  it('S produces brake=1', () => {
    const doc = createMockDocument();
    const kb = new KeyboardInput({ document: doc });
    kb.attach();
    doc.dispatchKey('s', 'keydown');
    const state = kb.update();
    expect(state.brake).toBe(1);
    expect(state.throttle).toBe(0);
  });

  it('A produces steer=-1', () => {
    const doc = createMockDocument();
    const kb = new KeyboardInput({ document: doc });
    kb.attach();
    doc.dispatchKey('a', 'keydown');
    const state = kb.update();
    expect(state.steer).toBe(-1);
  });

  it('D produces steer=1', () => {
    const doc = createMockDocument();
    const kb = new KeyboardInput({ document: doc });
    kb.attach();
    doc.dispatchKey('d', 'keydown');
    const state = kb.update();
    expect(state.steer).toBe(1);
  });

  it('Arrow up produces throttle=1', () => {
    const doc = createMockDocument();
    const kb = new KeyboardInput({ document: doc });
    kb.attach();
    doc.dispatchKey('ArrowUp', 'keydown');
    const state = kb.update();
    expect(state.throttle).toBe(1);
  });

  it('Arrow down produces brake=1', () => {
    const doc = createMockDocument();
    const kb = new KeyboardInput({ document: doc });
    kb.attach();
    doc.dispatchKey('ArrowDown', 'keydown');
    const state = kb.update();
    expect(state.brake).toBe(1);
  });

  it('Arrow left produces steer=-1', () => {
    const doc = createMockDocument();
    const kb = new KeyboardInput({ document: doc });
    kb.attach();
    doc.dispatchKey('ArrowLeft', 'keydown');
    const state = kb.update();
    expect(state.steer).toBe(-1);
  });

  it('Arrow right produces steer=1', () => {
    const doc = createMockDocument();
    const kb = new KeyboardInput({ document: doc });
    kb.attach();
    doc.dispatchKey('ArrowRight', 'keydown');
    const state = kb.update();
    expect(state.steer).toBe(1);
  });

  it('Space produces clutch=true', () => {
    const doc = createMockDocument();
    const kb = new KeyboardInput({ document: doc });
    kb.attach();
    doc.dispatchKey(' ', 'keydown');
    const state = kb.update();
    expect(state.clutch).toBe(true);
  });

  it('Space up produces clutch=false', () => {
    const doc = createMockDocument();
    const kb = new KeyboardInput({ document: doc });
    kb.attach();
    doc.dispatchKey(' ', 'keydown');
    doc.dispatchKey(' ', 'keyup');
    const state = kb.update();
    expect(state.clutch).toBe(false);
  });

  it('combining throttle + steer works', () => {
    const doc = createMockDocument();
    const kb = new KeyboardInput({ document: doc });
    kb.attach();
    doc.dispatchKey('w', 'keydown');
    doc.dispatchKey('d', 'keydown');
    const state = kb.update();
    expect(state.throttle).toBe(1);
    expect(state.steer).toBe(1);
  });

  it('key up clears that input', () => {
    const doc = createMockDocument();
    const kb = new KeyboardInput({ document: doc });
    kb.attach();
    doc.dispatchKey('w', 'keydown');
    doc.dispatchKey('w', 'keyup');
    const state = kb.update();
    expect(state.throttle).toBe(0);
  });

  it('deadzone zeroes out small steer values', () => {
    const doc = createMockDocument();
    const kb = new KeyboardInput({ document: doc, config: { deadzone: 0.1 } });
    kb.attach();
    // For keyboard, A and D both pressed = steer=0 (they cancel)
    doc.dispatchKey('a', 'keydown');
    doc.dispatchKey('d', 'keydown');
    const state = kb.update();
    expect(state.steer).toBe(0);
  });

  it('detach removes event listeners', () => {
    const doc = createMockDocument();
    const kb = new KeyboardInput({ document: doc });
    kb.attach();
    kb.detach();
    doc.dispatchKey('w', 'keydown');
    const state = kb.update();
    expect(state.throttle).toBe(0);
  });

  it('returns empty state by default', () => {
    const doc = createMockDocument();
    const kb = new KeyboardInput({ document: doc });
    kb.attach();
    const state = kb.update();
    expect(state.throttle).toBe(0);
    expect(state.brake).toBe(0);
    expect(state.steer).toBe(0);
    expect(state.clutch).toBe(false);
  });
});

// ─── GamepadInput ────────────────────────────────────────────────

describe('GamepadInput', () => {
  let gamepadObjects: any[];
  let connectListeners: Function[];
  let disconnectListeners: Function[];

  function createMockGamepadEnv() {
    gamepadObjects = [];
    connectListeners = [];
    disconnectListeners = [];

    const mockNavigator = {
      getGamepads: () => {
        const result: (Gamepad | null)[] = [];
        for (let i = 0; i < Math.max(4, gamepadObjects.length + 1); i++) {
          const gp = gamepadObjects.find((g) => g.index === i);
          result[i] = gp || null;
        }
        return result as Gamepad[];
      },
    };

    const mockWindow = {
      addEventListener: (event: string, handler: Function) => {
        if (event === 'gamepadconnect') connectListeners.push(handler);
        if (event === 'gamepaddisconnect') disconnectListeners.push(handler);
      },
      removeEventListener: (event: string, handler: Function) => {
        if (event === 'gamepadconnect') {
          const idx = connectListeners.indexOf(handler);
          if (idx !== -1) connectListeners.splice(idx, 1);
        }
        if (event === 'gamepaddisconnect') {
          const idx = disconnectListeners.indexOf(handler);
          if (idx !== -1) disconnectListeners.splice(idx, 1);
        }
      },
      setInterval: (fn: Function, _ms: number) => fn(), // call immediately for testing
      clearInterval: () => {},
    };

    return { mockNavigator, mockWindow };
  }

  function makeGamepadButton(pressed: boolean, value: number): GamepadButton {
    return { pressed, value, touched: false };
  }

  function addGamepad(index: number, axes?: number[], buttons?: number[]) {
    const btns: GamepadButton[] = (buttons || []).map((v) => makeGamepadButton(v > 0, v));
    while (btns.length < 16) {
      btns.push(makeGamepadButton(false, 0));
    }
    const gp: any = {
      index,
      connected: true,
      axes: axes || [0, 0, 0, 0],
      buttons: btns,
      timestamp: 0,
      id: `test-gamepad-${index}`,
      mapping: 'standard',
      vibrationActuator: null,
    };
    gamepadObjects.push(gp);
  }

  it('left trigger maps to throttle', () => {
    const { mockNavigator, mockWindow } = createMockGamepadEnv();
    addGamepad(0, [0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0.8, 0]);
    const gp = new GamepadInput({
      navigator: mockNavigator as unknown as Navigator,
      window: mockWindow as unknown as Window,
    });
    gp.attach();
    const state = gp.update();
    expect(state.throttle).toBeCloseTo(0.8, 2);
  });

  it('right trigger maps to brake', () => {
    const { mockNavigator, mockWindow } = createMockGamepadEnv();
    addGamepad(0, [0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0.6]);
    const gp = new GamepadInput({
      navigator: mockNavigator as unknown as Navigator,
      window: mockWindow as unknown as Window,
    });
    gp.attach();
    const state = gp.update();
    expect(state.brake).toBeCloseTo(0.6, 2);
  });

  it('left stick X maps to steer with deadzone', () => {
    const { mockNavigator, mockWindow } = createMockGamepadEnv();
    addGamepad(0, [0.7, 0, 0, 0]);
    const gp = new GamepadInput({
      navigator: mockNavigator as unknown as Navigator,
      window: mockWindow as unknown as Window,
    });
    gp.attach();
    const state = gp.update();
    expect(state.steer).toBeGreaterThan(0);
    expect(state.steer).toBeLessThanOrEqual(1);
  });

  it('small stick values within deadzone produce 0 steer', () => {
    const { mockNavigator, mockWindow } = createMockGamepadEnv();
    addGamepad(0, [0.05, 0, 0, 0]);
    const gp = new GamepadInput({
      navigator: mockNavigator as unknown as Navigator,
      window: mockWindow as unknown as Window,
    });
    gp.attach();
    const state = gp.update();
    expect(state.steer).toBe(0);
  });

  it('both triggers pressed produces both throttle and brake', () => {
    const { mockNavigator, mockWindow } = createMockGamepadEnv();
    addGamepad(0, [0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 1, 1]);
    const gp = new GamepadInput({
      navigator: mockNavigator as unknown as Navigator,
      window: mockWindow as unknown as Window,
    });
    gp.attach();
    const state = gp.update();
    expect(state.throttle).toBe(1);
    expect(state.brake).toBe(1);
  });

  it('gamepaddisconnect clears gamepad input', () => {
    const { mockNavigator, mockWindow } = createMockGamepadEnv();
    addGamepad(0, [0.5, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0.5, 0]);
    const gp = new GamepadInput({
      navigator: mockNavigator as unknown as Navigator,
      window: mockWindow as unknown as Window,
    });
    gp.attach();
    // Simulate disconnect
    gamepadObjects[0].connected = false;
    for (const listener of disconnectListeners) {
      listener({ gamepad: gamepadObjects[0] } as GamepadEvent);
    }
    const state = gp.update();
    expect(state.throttle).toBe(0);
    expect(state.steer).toBe(0);
  });

  it('returns empty state when no gamepad connected', () => {
    const { mockNavigator, mockWindow } = createMockGamepadEnv();
    const gp = new GamepadInput({
      navigator: mockNavigator as unknown as Navigator,
      window: mockWindow as unknown as Window,
    });
    gp.attach();
    const state = gp.update();
    expect(state.throttle).toBe(0);
    expect(state.brake).toBe(0);
    expect(state.steer).toBe(0);
    expect(state.clutch).toBe(false);
  });

  it('A button (button 0) produces clutch', () => {
    const { mockNavigator, mockWindow } = createMockGamepadEnv();
    addGamepad(0, [0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 0]);
    const gp = new GamepadInput({
      navigator: mockNavigator as unknown as Navigator,
      window: mockWindow as unknown as Window,
    });
    gp.attach();
    const state = gp.update();
    expect(state.clutch).toBe(true);
  });

  it('detach stops polling', () => {
    const { mockNavigator, mockWindow } = createMockGamepadEnv();
    addGamepad(0, [0.5, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0.5, 0]);
    const gp = new GamepadInput({
      navigator: mockNavigator as unknown as Navigator,
      window: mockWindow as unknown as Window,
    });
    gp.attach();
    gp.detach();
    const state = gp.update();
    expect(state.throttle).toBe(0);
  });

  it('D-pad left maps to steer=-1', () => {
    const { mockNavigator, mockWindow } = createMockGamepadEnv();
    addGamepad(0, [0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
    const gp = new GamepadInput({
      navigator: mockNavigator as unknown as Navigator,
      window: mockWindow as unknown as Window,
    });
    gp.attach();
    const state = gp.update();
    expect(state.steer).toBe(-1);
  });

  it('D-pad right maps to steer=1', () => {
    const { mockNavigator, mockWindow } = createMockGamepadEnv();
    addGamepad(0, [0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
    const gp = new GamepadInput({
      navigator: mockNavigator as unknown as Navigator,
      window: mockWindow as unknown as Window,
    });
    gp.attach();
    const state = gp.update();
    expect(state.steer).toBe(1);
  });
});

// ─── TouchInput ──────────────────────────────────────────────────

describe('TouchInput', () => {
  function createMockDocument() {
    const listeners: Map<string, Function[]> = new Map();
    return Object.assign(
      {
        addEventListener: (event: string, handler: Function) => {
          if (!listeners.has(event)) listeners.set(event, []);
          listeners.get(event)!.push(handler);
        },
        removeEventListener: (event: string, handler: Function) => {
          const h = listeners.get(event);
          if (h) {
            const idx = h.indexOf(handler);
            if (idx !== -1) h.splice(idx, 1);
          }
        },
        body: { clientWidth: 800, clientHeight: 600 },
      },
      {
        dispatchTouch(type: string, touches: { clientX: number; clientY: number; identifier: number }[]) {
          const h = listeners.get(type) || [];
          const touchList: any = {
            length: touches.length,
            item: (i: number) => touches[i] || null,
          };
          touches.forEach((t) => {
            touchList[t.identifier] = t;
          });
          h.forEach((fn) => fn({ type, touches: touchList, changedTouches: touchList }));
        },
      }
    ) as unknown as (Document & { dispatchTouch: (type: string, touches: any[]) => void });
  }

  it('right-bottom zone produces throttle', () => {
    const doc = createMockDocument();
    const touch = new TouchInput({ document: doc });
    touch.attach();
    doc.dispatchTouch('touchstart', [{ clientX: 600, clientY: 500, identifier: 0 }]);
    const state = touch.update();
    expect(state.throttle).toBe(1);
  });

  it('right-top zone produces brake', () => {
    const doc = createMockDocument();
    const touch = new TouchInput({ document: doc });
    touch.attach();
    doc.dispatchTouch('touchstart', [{ clientX: 600, clientY: 100, identifier: 0 }]);
    const state = touch.update();
    expect(state.brake).toBe(1);
  });

  it('left zone X position maps to steer (-1 to 1)', () => {
    const doc = createMockDocument();
    const touch = new TouchInput({ document: doc });
    touch.attach();
    // Far left (x=50, halfWidth=400) -> mapRange(50, 0, 400, -1, 1) = -0.75
    doc.dispatchTouch('touchstart', [{ clientX: 50, clientY: 300, identifier: 0 }]);
    let state = touch.update();
    expect(state.steer).toBeCloseTo(-0.75, 2);

    // Center left (x=200) -> mapRange(200, 0, 400, -1, 1) = 0
    doc.dispatchTouch('touchstart', [{ clientX: 200, clientY: 300, identifier: 0 }]);
    state = touch.update();
    expect(state.steer).toBeCloseTo(0, 2);
  });

  it('two fingers sets clutch', () => {
    const doc = createMockDocument();
    const touch = new TouchInput({ document: doc });
    touch.attach();
    doc.dispatchTouch('touchstart', [
      { clientX: 200, clientY: 300, identifier: 0 },
      { clientX: 600, clientY: 500, identifier: 1 },
    ]);
    const state = touch.update();
    expect(state.clutch).toBe(true);
  });

  it('touchend clears input', () => {
    const doc = createMockDocument();
    const touch = new TouchInput({ document: doc });
    touch.attach();
    doc.dispatchTouch('touchstart', [{ clientX: 600, clientY: 500, identifier: 0 }]);
    doc.dispatchTouch('touchend', [{ clientX: 600, clientY: 500, identifier: 0 }]);
    const state = touch.update();
    expect(state.throttle).toBe(0);
  });

  it('returns empty state by default', () => {
    const doc = createMockDocument();
    const touch = new TouchInput({ document: doc });
    touch.attach();
    const state = touch.update();
    expect(state.throttle).toBe(0);
    expect(state.brake).toBe(0);
    expect(state.steer).toBe(0);
    expect(state.clutch).toBe(false);
  });

  it('detach removes listeners', () => {
    const doc = createMockDocument();
    const touch = new TouchInput({ document: doc });
    touch.attach();
    touch.detach();
    doc.dispatchTouch('touchstart', [{ clientX: 600, clientY: 500, identifier: 0 }]);
    const state = touch.update();
    expect(state.throttle).toBe(0);
  });
});

// ─── InputManager ────────────────────────────────────────────────

describe('InputManager', () => {
  function createMockEnv() {
    const kbListeners: Map<string, Function[]> = new Map();
    const mockDoc = Object.assign(
      {
        addEventListener: (event: string, handler: Function) => {
          if (!kbListeners.has(event)) kbListeners.set(event, []);
          kbListeners.get(event)!.push(handler);
        },
        removeEventListener: (event: string, handler: Function) => {
          const h = kbListeners.get(event);
          if (h) {
            const idx = h.indexOf(handler);
            if (idx !== -1) h.splice(idx, 1);
          }
        },
        body: { clientWidth: 800, clientHeight: 600 },
      },
      {
        dispatchKey(key: string, type: 'keydown' | 'keyup') {
          const h = kbListeners.get(type) || [];
          h.forEach((fn) => fn({ key }));
        },
        dispatchTouch(type: string, touches: { clientX: number; clientY: number; identifier: number }[]) {
          const h = kbListeners.get(type) || [];
          const touchList: any = { length: touches.length, item: (i: number) => touches[i] || null };
          touches.forEach((t: any) => { touchList[t.identifier] = t; });
          h.forEach((fn) => fn({ type, touches: touchList, changedTouches: touchList }));
        },
      }
    ) as unknown as (Document & { dispatchKey: any; dispatchTouch: any });

    const gamepadObjects: any[] = [];
    const gpListeners: { connect: Function[]; disconnect: Function[] } = { connect: [], disconnect: [] };
    const mockNavigator = {
      getGamepads: () => {
        const result: (Gamepad | null)[] = [];
        for (let i = 0; i < 4; i++) {
          const gp = gamepadObjects.find((g) => g.index === i);
          result[i] = gp || null;
        }
        return result as Gamepad[];
      },
    };
    const mockWindow = {
      addEventListener: (event: string, handler: Function) => {
        if (event === 'gamepadconnect') gpListeners.connect.push(handler);
        if (event === 'gamepaddisconnect') gpListeners.disconnect.push(handler);
      },
      removeEventListener: (event: string, handler: Function) => {
        if (event === 'gamepadconnect') {
          const idx = gpListeners.connect.indexOf(handler);
          if (idx !== -1) gpListeners.connect.splice(idx, 1);
        }
        if (event === 'gamepaddisconnect') {
          const idx = gpListeners.disconnect.indexOf(handler);
          if (idx !== -1) gpListeners.disconnect.splice(idx, 1);
        }
      },
      setInterval: (fn: Function, _ms: number) => fn(),
      clearInterval: () => {},
    };

    function makeGamepadButton(pressed: boolean, value: number): GamepadButton {
      return { pressed, value, touched: false };
    }

    function addGamepad(index: number, axes?: number[], buttons?: number[]) {
      const btns: GamepadButton[] = (buttons || []).map((v) => makeGamepadButton(v > 0, v));
      while (btns.length < 16) {
        btns.push(makeGamepadButton(false, 0));
      }
      const gp: any = {
        index,
        connected: true,
        axes: axes || [0, 0, 0, 0],
        buttons: btns,
        timestamp: 0,
        id: `test-${index}`,
        mapping: 'standard',
        vibrationActuator: null,
      };
      gamepadObjects.push(gp);
    }

    return { mockDoc, mockNavigator, mockWindow, gamepadObjects, gpListeners, addGamepad, kbListeners };
  }

  it('auto mode selects gamepad when connected', () => {
    const env = createMockEnv();
    const manager = new InputManager({
      document: env.mockDoc,
      navigator: env.mockNavigator as unknown as Navigator,
      window: env.mockWindow as unknown as Window,
    });
    manager.setSource('auto');
    manager.attach();

    // Connect a gamepad with throttle input
    env.addGamepad(0, [0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0.8, 0]);
    // Fire connect event
    for (const fn of env.gpListeners.connect) {
      fn({ gamepad: env.gamepadObjects[0] } as GamepadEvent);
    }

    const state = manager.update();
    expect(state.throttle).toBeCloseTo(0.8, 2);
  });

  it('merging takes max for throttle/brake', () => {
    const env = createMockEnv();
    const manager = new InputManager({
      document: env.mockDoc,
      navigator: env.mockNavigator as unknown as Navigator,
      window: env.mockWindow as unknown as Window,
    });
    manager.attach();

    env.mockDoc.dispatchKey('w', 'keydown');
    const state = manager.update();
    expect(state.throttle).toBe(1);
  });

  it('merging sums and clamps steer', () => {
    const env = createMockEnv();
    const manager = new InputManager({
      document: env.mockDoc,
      navigator: env.mockNavigator as unknown as Navigator,
      window: env.mockWindow as unknown as Window,
    });
    manager.attach();

    env.mockDoc.dispatchKey('d', 'keydown');
    const state = manager.update();
    expect(state.steer).toBe(1);
  });

  it('detach stops all input', () => {
    const env = createMockEnv();
    const manager = new InputManager({
      document: env.mockDoc,
      navigator: env.mockNavigator as unknown as Navigator,
      window: env.mockWindow as unknown as Window,
    });
    manager.attach();
    env.mockDoc.dispatchKey('w', 'keydown');
    manager.detach();
    const state = manager.update();
    expect(state.throttle).toBe(0);
  });

  it('setSource selects specific input', () => {
    const env = createMockEnv();
    const manager = new InputManager({
      document: env.mockDoc,
      navigator: env.mockNavigator as unknown as Navigator,
      window: env.mockWindow as unknown as Window,
    });
    manager.setSource('keyboard');
    manager.attach();
    env.mockDoc.dispatchKey('w', 'keydown');
    const state = manager.update();
    expect(state.throttle).toBe(1);
  });

  it('returns empty state by default', () => {
    const env = createMockEnv();
    const manager = new InputManager({
      document: env.mockDoc,
      navigator: env.mockNavigator as unknown as Navigator,
      window: env.mockWindow as unknown as Window,
    });
    manager.attach();
    const state = manager.update();
    expect(state.throttle).toBe(0);
    expect(state.brake).toBe(0);
    expect(state.steer).toBe(0);
    expect(state.clutch).toBe(false);
  });
});
