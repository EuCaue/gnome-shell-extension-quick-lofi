import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import { ExtensionPreferences, gettext as _ } from '@girs/gnome-shell/extensions/prefs';

export default class GnomeRectanglePreferences extends ExtensionPreferences {
  private _settings?: Gio.Settings;

  async fillPreferencesWindow(window: Adw.PreferencesWindow) {
    const filepath = GLib.build_filenamev([this.path, 'resources', 'quick-lofi.gresource']);
    const resource = Gio.Resource.load(filepath);
    Gio.resources_register(resource);

    const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
    iconTheme.add_resource_path('/org/gnome/Shell/Extensions/quick-lofi/icons');

    const { RadiosPage } = await import('@/preferences/RadiosPage');
    const { PlayerPage } = await import('@/preferences/PlayerPage');
    const { InterfacePage } = await import('@/preferences/InterfacePage');

    this._settings = this.getSettings();
    window.connect('close-request', () => {
      this._settings = null;
    });

    window.add(new RadiosPage(this._settings, window));
    window.add(new PlayerPage(this._settings));
    window.add(new InterfacePage(this._settings));
  }
}
