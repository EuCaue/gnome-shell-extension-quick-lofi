import Clutter from 'gi://Clutter';
import type St from 'gi://St';
import { shellMajor } from './ShellVersion';

// GNOME 48 added `orientation` to St.BoxLayout and GNOME 51 removed `vertical`.
const hasOrientation = shellMajor >= 48;

// St.BoxLayout constructor props that lay children out vertically or horizontally on every supported version.
export function boxOrientation({ vertical }: { vertical: boolean }): Partial<St.BoxLayout.ConstructorProps> {
  if (hasOrientation) {
    return { orientation: vertical ? Clutter.Orientation.VERTICAL : Clutter.Orientation.HORIZONTAL };
  }
  return { vertical } as Partial<St.BoxLayout.ConstructorProps>;
}
