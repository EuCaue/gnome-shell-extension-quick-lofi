export function stepVolume(current: number, step: number, direction: 1 | -1): number {
  const next = current + direction * step;
  return Math.min(100, Math.max(0, next));
}

export function shouldHandleScroll(nowMs: number, lastMs: number, throttleMs: number): boolean {
  return nowMs - lastMs >= throttleMs;
}

export function shouldConsumeScroll(
  action: string | undefined,
  allowed: readonly string[],
  throttleOk: boolean,
  ran: boolean,
): boolean {
  return Boolean(action && allowed.includes(action) && throttleOk && ran);
}
