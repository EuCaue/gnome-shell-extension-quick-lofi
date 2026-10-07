// No runtime imports: tests load this file directly with Node.
import type { RadioItemActionKey } from '@/shared/constants';

// 'start' (re)starts the clicked radio; the others act on the radio already playing.
export type RadioItemStep = Exclude<RadioItemActionKey, 'restart'> | 'start';

// `button` is 1-3 for mouse clicks and 0 for keyboard activation.
export function radioItemStep({
  actions,
  button,
  isActive,
}: {
  actions: string[];
  button: number;
  isActive: boolean;
}): RadioItemStep {
  const action = actions[button - 1];
  if (action === 'copyUrl') return 'copyUrl';
  if (isActive && (action === 'playPause' || action === 'stopPlayer' || action === 'none')) return action;
  // 'restart', keyboard and extra buttons on the playing radio start it again
  return 'start';
}
