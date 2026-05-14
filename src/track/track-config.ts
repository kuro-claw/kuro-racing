// ─── Track Configuration ──────────────────────────────────────────
// KR-020: Shared interface for all tracks.

export interface TrackConfig {
  id: string;          // e.g., 'neon-circuit'
  name: string;        // display name, e.g., 'Neon Circuit'
  width: number;       // track width in meters
  numSamples: number;  // number of interpolated samples
  numSectors: number;  // number of sectors for lap detection
  description: string; // short description for menu
}
