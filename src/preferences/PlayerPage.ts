import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import { SETTINGS_KEYS, SHORTCUTS } from '@utils/constants';
import { Shortcut } from '@/types';
import { ShortcutButton } from '@/preferences/ShortcutButton';
import { writeLog } from '@utils/helpers';

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
    writeLog({ message: '[PlayerPage] Setting up keyboard shortcuts', type: 'INFO' });
    const shortcuts: Array<Shortcut> = [
      {
        settingsKey: SHORTCUTS.PLAY_PAUSE_SHORTCUT,
        title: 'Play or Pause',
        subtitle: 'Toggle playback of Quick Lofi.',
      },
      {
        settingsKey: SHORTCUTS.STOP_SHORTCUT,
        title: 'Stop Playback',
        subtitle: 'Stop Quick Lofi completely.',
      },
      {
        settingsKey: SHORTCUTS.INCREASE_VOLUME_SHORTCUT,
        title: 'Increase Volume',
        subtitle: 'Raise the volume by the system step.',
      },
      {
        settingsKey: SHORTCUTS.DECREASE_VOLUME_SHORTCUT,
        title: 'Decrease Volume',
        subtitle: 'Lower the volume by the system step.',
      },
    ];

    shortcuts.forEach((shortcut) => {
      writeLog({ message: `[PlayerPage] Creating shortcut button for: ${shortcut.title}`, type: 'INFO' });
      const shortcutButton = new ShortcutButton(this._settings, shortcut.settingsKey);
      const shortcutRow = shortcutButton.createRow(shortcut.title, shortcut.subtitle);
      this._playerGroup.add(shortcutRow);
    });

    writeLog({ message: `[PlayerPage] Created ${shortcuts.length} shortcut rows`, type: 'INFO' });
  }

  constructor(private _settings: Gio.Settings) {
    super();
    writeLog({ message: '[PlayerPage] Initializing player preferences page', type: 'INFO' });
    this._settings.bind(SETTINGS_KEYS.VOLUME, this._volumeLevel, 'value', Gio.SettingsBindFlags.DEFAULT);
    writeLog({ message: '[PlayerPage] Bound volume level to settings', type: 'INFO' });
    this._handleShortcuts();
    writeLog({ message: '[PlayerPage] Player preferences page initialized', type: 'INFO' });
  }
}
