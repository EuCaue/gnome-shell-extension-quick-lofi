import type Gio from 'gi://Gio';

// Fallback fade length in seconds when the setting is unreadable.
export const DEFAULT_FADE_DURATION_S = 1.0;

// In-place update leaves the shell with the old schema clone. Reading a missing key aborts the process.
export function fadeDurationSeconds(settings: Gio.Settings, key: string): number {
  if (!settings.settings_schema.has_key(key)) return DEFAULT_FADE_DURATION_S;
  return settings.get_double(key);
}

export function volumeRamp(start: number, steps: number): number[] {
  const safeSteps = Math.max(1, Math.floor(steps));
  return Array.from({ length: safeSteps }, (_, i) => Math.max(0, Math.round(start * (1 - (i + 1) / safeSteps))));
}

// Ramp steps for a duration. 0 means no fade.
export function fadeSteps(durationMs: number, stepMs: number): number {
  if (durationMs <= 0) return 0;
  return Math.ceil(durationMs / stepMs);
}
