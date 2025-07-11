import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import { SETTINGS_KEYS, SHORTCUTS } from '@utils/constants';
import { Shortcut } from '@/types';
import { ShortcutButton } from '@/modules/ShortcutButton';

export class PlayerPage extends Adw.PreferencesPage {
  static {
    GObject.registerClass(
      {
        GTypeName: 'PlayerPage',
        Template: 'resource:///org/gnome/Shell/Extensions/quick-lofi/preferences/PlayerPage.ui',
        InternalChildren: ['volumeLevel', 'playerGroup'],
      },
      this,
    );
  }
  declare private _playerGroup: Adw.PreferencesGroup;
  declare private _volumeLevel: Adw.SpinRow;

  private _handleShortcuts() {
    const shortcuts: Array<Shortcut> = [
      {
        settingsKey: SHORTCUTS.PLAY_PAUSE_SHORTCUT,
        title: 'Play/Pause Quick Lofi',
        subtitle: 'Toggle between playing and pausing Quick Lofi.',
      },
      {
        settingsKey: SHORTCUTS.STOP_SHORTCUT,
        title: 'Stop Quick Lofi',
        subtitle: 'Stop Quick Lofi playback entirely.',
      },
    ];
    shortcuts.forEach((shortcut) => {
      const shortcutButton = new ShortcutButton(this._settings, shortcut.settingsKey);
      const shortcutRow = shortcutButton.createRow(shortcut.title, shortcut.subtitle);
      this._playerGroup.add(shortcutRow);
    });
  }

  constructor(private _settings: Gio.Settings) {
    super();
    this._settings.bind(SETTINGS_KEYS.VOLUME, this._volumeLevel, 'value', Gio.SettingsBindFlags.DEFAULT);
    this._handleShortcuts();
  }
}
