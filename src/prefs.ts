import type Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from '@girs/gnome-shell/extensions/prefs';
import { getExtSettings } from './utils/helpers';

export default class GnomeRectanglePreferences extends ExtensionPreferences {
  private _settings?: Gio.Settings;

  async fillPreferencesWindow(window: Adw.PreferencesWindow) {
    const filepath = GLib.build_filenamev([this.path, 'resources', 'quick-lofi.gresource']);
    const resource = Gio.Resource.load(filepath);
    Gio.resources_register(resource);
    this._settings = this.getSettings();
    getExtSettings(this._settings);

    const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
    iconTheme.add_resource_path('/org/gnome/Shell/Extensions/quick-lofi/icons');

    const { RadiosPage } = await import('@/preferences/RadiosPage');
    const { PlayerPage } = await import('@/preferences/PlayerPage');
    const { InterfacePage } = await import('@/preferences/InterfacePage');

    window.connect('close-request', () => {
      this._settings = null;
    });

    window.add(new RadiosPage(this._settings, window));
    window.add(new PlayerPage(this._settings, window));
    window.add(new InterfacePage(this._settings));
  }
}
