// ─── Aerodynamics — Drag and Downforce ───────────────────────────
// KR-009: Drag (∝ v²), downforce (∝ v²), center of pressure effect.
// No Babylon.js dependency — pure math.

export interface AeroConfig {
  // Drag coefficient (Cd × frontal area, m²)
  dragCoefficient: number; // typical sports car: 0.30–0.45
  frontalArea: number;     // m²
  // Downforce coefficient (Cl × wing area)
  downforceCoefficient: number; // positive = downforce
  wingArea: number;        // m²
  // Center of pressure as fraction from front (0 = front axle, 1 = rear axle)
  centerOfPressure: number; // 0.5 = 50/50 front/rear
  // Air density (kg/m³) — ~1.225 at sea level, 20°C
  airDensity: number;
  // Wheelbase (m) — for front/rear load distribution
  wheelbase: number;
}

export const PHANTOM_AERO: AeroConfig = {
  dragCoefficient: 0.34,
  frontalArea: 2.1,
  downforceCoefficient: 0.45,
  wingArea: 1.8,
  centerOfPressure: 0.45, // slightly front-biased
  airDensity: 1.225,
  wheelbase: 2.6,
};

// ─── Drag Force ──────────────────────────────────────────────────

/**
 * Aerodynamic drag force (N).
 * Fd = 0.5 × ρ × v² × Cd × A
 * Always opposes motion (positive value — direction applied by caller).
 *
 * @param speed - Vehicle speed (m/s)
 * @param config - Aero config
 * @returns Drag force magnitude (N)
 */
export function dragForce(speed: number, config: AeroConfig = PHANTOM_AERO): number {
  if (speed <= 0) return 0;
  return 0.5 * config.airDensity * speed * speed * config.dragCoefficient * config.frontalArea;
}

// ─── Downforce ───────────────────────────────────────────────────

/**
 * Total aerodynamic downforce (N).
 * Fl = 0.5 × ρ × v² × Cl × A
 * Positive = pushing car into the ground.
 *
 * @param speed - Vehicle speed (m/s)
 * @param config - Aero config
 * @returns Downforce (N)
 */
export function downforce(speed: number, config: AeroConfig = PHANTOM_AERO): number {
  if (speed <= 0) return 0;
  return 0.5 * config.airDensity * speed * speed * config.downforceCoefficient * config.wingArea;
}

// ─── Front / Rear Downforce Distribution ─────────────────────────

/**
 * Distribute downforce between front and rear axles based on center of pressure.
 * @param totalDownforce - Total downforce (N)
 * @param config - Aero config
 * @returns { front, rear } in N
 */
export function downforceDistribution(
  totalDownforce: number,
  config: AeroConfig = PHANTOM_AERO
): { front: number; rear: number } {
  // centerOfPressure = fraction FROM FRONT (0 = all front, 1 = all rear)
  const front = totalDownforce * (1 - config.centerOfPressure);
  const rear = totalDownforce * config.centerOfPressure;
  return { front, rear };
}

// ─── Grip Increase from Downforce ────────────────────────────────

/**
 * Calculate additional normal load at each axle from downforce.
 * Used to increase tire grip at speed.
 *
 * @param speed - Vehicle speed (m/s)
 * @param config - Aero config
 * @returns { frontLoad, rearLoad } additional normal force (N) at each axle
 */
export function aeroLoad(
  speed: number,
  config: AeroConfig = PHANTOM_AERO
): { frontLoad: number; rearLoad: number; totalDrag: number; totalDownforce: number } {
  const drag = dragForce(speed, config);
  const df = downforce(speed, config);
  const { front, rear } = downforceDistribution(df, config);

  return {
    frontLoad: front,
    rearLoad: rear,
    totalDrag: drag,
    totalDownforce: df,
  };
}

// ─── Lift-to-Drag Ratio ───────────────────────────────────────────

/**
 * Lift-to-drag ratio (downforce / drag).
 * Higher = more efficient aero package.
 */
export function liftToDragRatio(config: AeroConfig = PHANTOM_AERO): number {
  // L/D = (Cl × A_wing) / (Cd × A_frontal)
  return (config.downforceCoefficient * config.wingArea) /
    (config.dragCoefficient * config.frontalArea);
}

// ─── Speed-to-Drag/Downforce Scaling ─────────────────────────────

/**
 * Both drag and downforce scale with v².
 * At twice the speed, forces are 4× greater.
 */
export function aeroForcesAtSpeed(
  speed: number,
  config: AeroConfig = PHANTOM_AERO
): { drag: number; df: number; ratio: number } {
  const drag = dragForce(speed, config);
  const df = downforce(speed, config);
  return { drag, df, ratio: df / (drag || 1) };
}
