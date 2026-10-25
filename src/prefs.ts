import type Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import type Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from '@girs/gnome-shell/extensions/prefs';
import '@/preferences/Resources';
import { InterfacePage } from '@/preferences/InterfacePage';
import { PlayerPage } from '@/preferences/PlayerPage';
import { RadiosPage } from '@/preferences/RadiosPage';
import { getExtSettings } from '@/shared/settings';

export default class GnomeRectanglePreferences extends ExtensionPreferences {
  private _settings?: Gio.Settings;

  // GNOME 45 and 46 don't await this method: pages added after an await never show up.
  fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
    this._settings = this.getSettings();
    getExtSettings(this._settings);

    const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
    iconTheme.add_resource_path('/org/gnome/Shell/Extensions/quick-lofi/icons');

    window.connect('close-request', () => {
      this._settings = null;
    });

    window.add(new RadiosPage(this._settings, window));
    window.add(new PlayerPage(this._settings, window));
    window.add(new InterfacePage(this._settings));
    return Promise.resolve();
  }
}
