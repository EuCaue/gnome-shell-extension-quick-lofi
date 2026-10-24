export function volumeRamp(start: number, steps: number): number[] {
  const safeSteps = Math.max(1, Math.floor(steps));
  return Array.from({ length: safeSteps }, (_, i) => Math.max(0, Math.round(start * (1 - (i + 1) / safeSteps))));
}
