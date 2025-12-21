import * as Main from '@girs/gnome-shell/ui/main';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import Player from './Player';
import { SETTINGS_KEYS, SHORTCUTS } from '@utils/constants';

export default class ShortcutsHandler {
  private _player: Player;
  constructor(private _settings: Gio.Settings) {
    this._player = Player.getInstance();
    this.handleShortcuts();
  }

  public handleShortcuts() {
    Main.wm.addKeybinding(
      SHORTCUTS.PLAY_PAUSE_SHORTCUT,
      this._settings,
      Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
      Shell.ActionMode.NORMAL,
      () => {
        this._player.playPause();
      },
    );
    Main.wm.addKeybinding(
      SHORTCUTS.STOP_SHORTCUT,
      this._settings,
      Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
      Shell.ActionMode.NORMAL,
      () => {
        this._player.stopPlayer();
      },
    );
    Main.wm.addKeybinding(
      SHORTCUTS.INCREASE_VOLUME_SHORTCUT,
      this._settings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      () => {
        const currentVolume: number = this._settings.get_int(SETTINGS_KEYS.VOLUME);
        if (currentVolume >= 100) {
          this._settings.set_int(SETTINGS_KEYS.VOLUME, 100);
          return;
        }
        const volumeStep: number = new Gio.Settings({ schema: 'org.gnome.settings-daemon.plugins.media-keys' }).get_int(
          'volume-step',
        );
        const newVolume: number = Math.floor(currentVolume + volumeStep);
        this._settings.set_int(SETTINGS_KEYS.VOLUME, newVolume);
      },
    );
    Main.wm.addKeybinding(
      SHORTCUTS.DECREASE_VOLUME_SHORTCUT,
      this._settings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      () => {
        const currentVolume: number = this._settings.get_int(SETTINGS_KEYS.VOLUME);
        if (currentVolume <= 0) {
          this._settings.set_int(SETTINGS_KEYS.VOLUME, 0);
          return;
        }
        const volumeStep: number = new Gio.Settings({ schema: 'org.gnome.settings-daemon.plugins.media-keys' }).get_int(
          'volume-step',
        );
        const newVolume: number = Math.floor(currentVolume - volumeStep);
        this._settings.set_int(SETTINGS_KEYS.VOLUME, newVolume);
      },
    );
  }

  private _removeShortcuts() {
    Object.values(SHORTCUTS).forEach((key) => {
      Main.wm.removeKeybinding(key);
    });
  }

  public destroy() {
    this._removeShortcuts();
  }
}
