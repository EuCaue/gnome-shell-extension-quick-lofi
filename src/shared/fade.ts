// The fade length in seconds to fall back on when the setting cannot be read.
export const DEFAULT_FADE_DURATION_S = 1.0;

export function volumeRamp(start: number, steps: number): number[] {
  const safeSteps = Math.max(1, Math.floor(steps));
  return Array.from({ length: safeSteps }, (_, i) => Math.max(0, Math.round(start * (1 - (i + 1) / safeSteps))));
}

// The number of ramp steps for a duration. 0 means no fade at all.
export function fadeSteps(durationMs: number, stepMs: number): number {
  if (durationMs <= 0) return 0;
  return Math.ceil(durationMs / stepMs);
}
