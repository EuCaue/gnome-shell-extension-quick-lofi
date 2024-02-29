import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GnomeRectanglePreferences extends ExtensionPreferences {
  _settings?: Gio.Settings;

  fillPreferencesWindow(window: Adw.PreferencesWindow) {
    this._settings = this.getSettings();

    const page = new Adw.PreferencesPage({
      title: _('General'),
      icon_name: 'dialog-information-symbolic',
    });

    const paddingGroup = new Adw.PreferencesGroup({
      title: _('Player Settings'),
      description: _('Configure the player settings'),
    });
    page.add(paddingGroup);

    const paddingInner = new Adw.SpinRow({
      title: _('Volume'),
      subtitle: _('Volume to set when playing lofi'),
      adjustment: new Gtk.Adjustment({
        lower: 0,
        upper: 100,
        step_increment: 1,
      }),
    });
    paddingGroup.add(paddingInner);

    window.add(page);
    this._settings!.bind('volume', paddingInner, 'value', Gio.SettingsBindFlags.DEFAULT);
  }
}
