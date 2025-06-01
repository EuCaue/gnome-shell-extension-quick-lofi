import Gio from 'gi://Gio';
import { type Extension } from '@girs/gnome-shell/extensions/extension';

export interface QuickLofiExtension extends Extension {
  path: string;
  _settings: Gio.Settings;
}
export type Radio = { radioName: string; radioUrl: string; id: string };

export type Shortcut = { settingsKey: string; title: string; subtitle?: string };
