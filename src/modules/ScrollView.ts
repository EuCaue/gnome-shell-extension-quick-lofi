import type Clutter from 'gi://Clutter';
import type St from 'gi://St';
import { shellMajor } from './ShellVersion';

// GNOME 45's St.ScrollView only scrolls a child added with add_actor; add_child leaves it 0x0.
// GNOME 46 removed add_actor.
export function setScrollChild(view: St.ScrollView, child: Clutter.Actor): void {
  if (shellMajor < 46) (view as any).add_actor(child);
  else view.add_child(child);
}
