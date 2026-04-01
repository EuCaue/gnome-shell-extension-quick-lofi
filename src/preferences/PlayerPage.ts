import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import { SETTINGS_KEYS, SHORTCUTS } from '@utils/constants';
import { Shortcut } from '@/types';
import { ShortcutButton } from '@/preferences/ShortcutButton';
import { handleErrorRow, writeLog } from '@utils/helpers';
import { debug } from '@/utils/debug';
import Gtk from '@girs/gtk-4.0';

export class PlayerPage extends Adw.PreferencesPage {
  static {
    GObject.registerClass(
      {
        GTypeName: 'PlayerPage',
        Template: 'resource:///org/gnome/Shell/Extensions/quick-lofi/preferences/PlayerPage.ui',
        InternalChildren: ['volumeLevel', 'playerGroup', 'enableMpris', 'mpvArguments'],
      },
      this,
    );
  }
  declare private _playerGroup: Adw.PreferencesGroup;
  declare private _volumeLevel: Adw.SpinRow;
  declare private _enableMpris: Adw.SwitchRow;
  declare private _mpvArguments: Adw.EntryRow;

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

  private _handleMpvArguments(w: Adw.EntryRow) {
    let args = w.text;
    console.log('ARGS', args);
    if (args.length === 0) {
      handleErrorRow(w, 'No recommeded making this empty.');
    }
    if (args.lastIndexOf(',') === args.length - 1) {
      args = args.substring(0, args.length - 1);
      console.log('parsed args', args);
    }
    const regex = /^(--[\w-]+(=\S+)?,?\s*)*$/;
    debug(regex.test(args));
    if (regex.test(args)) {
      //  TODO: should set on the ui correcltly
      const finalArgs: Array<string> = args.split(/,\s*/);
      console.log('FINALARGS', finalArgs);
      //  TODO: when this change, restart player with the new options
      this._settings.set_strv(SETTINGS_KEYS.MPV_ARGUMENTS, finalArgs);
      w.text = finalArgs.join(', ');
    } else {
      handleErrorRow(w, 'Wrong format (--option=value)');
      return;
    }
  }

  constructor(private _settings: Gio.Settings) {
    super();
    writeLog({ message: '[PlayerPage] Initializing player preferences page', type: 'INFO' });
    this._settings.bind(SETTINGS_KEYS.VOLUME, this._volumeLevel, 'value', Gio.SettingsBindFlags.DEFAULT);
    this._settings.bind(SETTINGS_KEYS.ENABLE_MPRIS, this._enableMpris, 'active', Gio.SettingsBindFlags.DEFAULT);
    this._mpvArguments.set_text(this._settings.get_strv(SETTINGS_KEYS.MPV_ARGUMENTS).join(', '));
    //  TODO: make reset button
    //  TODO: make popver button
    writeLog({ message: '[PlayerPage] Bound volume level to settings', type: 'INFO' });
    this._handleShortcuts();
    writeLog({ message: '[PlayerPage] Player preferences page initialized', type: 'INFO' });
  }
}
