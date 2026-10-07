// No runtime imports: tests load this file directly with Node.
import type { ClickActionKey } from '@/shared/constants';

// 'start' (re)starts the clicked radio; anything else runs as a click action.
export type RadioItemStep = Exclude<ClickActionKey, 'restart'> | 'start';

// `action` is undefined for keyboard activation and extra mouse buttons.
export function radioItemStep({ action, isActive }: { action: string | undefined; isActive: boolean }): RadioItemStep {
  if (action === undefined || action === 'restart') return 'start';
  // playback actions start a radio that isn't playing
  if (!isActive && (action === 'playPause' || action === 'stopPlayer')) return 'start';
  return action as RadioItemStep;
}
