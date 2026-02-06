import * as Main from '@girs/gnome-shell/ui/main';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import Player from './Player';
import { SETTINGS_KEYS, SHORTCUTS } from '@utils/constants';
import { getExtSettings, writeLog } from '@/utils/helpers';

export default class ShortcutsHandler {
  private _player: Player;
  private _settings: Gio.Settings;

  constructor() {
    writeLog({ message: 'Initializing ShortcutsHandler', type: 'INFO' });
    this._player = Player.getInstance();
    this._settings = getExtSettings();
    this.handleShortcuts();
  }

  public handleShortcuts() {
    writeLog({ message: 'Setting up keyboard shortcuts', type: 'INFO' });
    Main.wm.addKeybinding(
      SHORTCUTS.PLAY_PAUSE_SHORTCUT,
      this._settings,
      Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
      Shell.ActionMode.NORMAL,
      () => {
        writeLog({ message: 'Play/Pause shortcut triggered', type: 'INFO' });
        this._player.playPause();
      },
    );
    Main.wm.addKeybinding(
      SHORTCUTS.STOP_SHORTCUT,
      this._settings,
      Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
      Shell.ActionMode.NORMAL,
      () => {
        writeLog({ message: 'Stop shortcut triggered', type: 'INFO' });
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
        writeLog({ message: `Increase volume shortcut triggered. Current volume: ${currentVolume}`, type: 'INFO' });
        if (currentVolume >= 100) {
          writeLog({ message: 'Volume already at maximum (100)', type: 'WARN' });
          this._settings.set_int(SETTINGS_KEYS.VOLUME, 100);
          return;
        }
        const volumeStep: number = new Gio.Settings({ schema: 'org.gnome.settings-daemon.plugins.media-keys' }).get_int(
          'volume-step',
        );
        const newVolume: number = Math.floor(currentVolume + volumeStep);
        writeLog({
          message: `Increasing volume from ${currentVolume} to ${newVolume} (step: ${volumeStep})`,
          type: 'INFO',
        });
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
        writeLog({ message: `Decrease volume shortcut triggered. Current volume: ${currentVolume}`, type: 'INFO' });
        if (currentVolume <= 0) {
          writeLog({ message: 'Volume already at minimum (0)', type: 'WARN' });
          this._settings.set_int(SETTINGS_KEYS.VOLUME, 0);
          return;
        }
        const volumeStep: number = new Gio.Settings({ schema: 'org.gnome.settings-daemon.plugins.media-keys' }).get_int(
          'volume-step',
        );
        const newVolume: number = Math.floor(currentVolume - volumeStep);
        writeLog({
          message: `Decreasing volume from ${currentVolume} to ${newVolume} (step: ${volumeStep})`,
          type: 'INFO',
        });
        this._settings.set_int(SETTINGS_KEYS.VOLUME, newVolume);
      },
    );
  }

  private _removeShortcuts() {
    writeLog({ message: 'Removing keyboard shortcuts', type: 'INFO' });
    Object.values(SHORTCUTS).forEach((key) => {
      Main.wm.removeKeybinding(key);
    });
  }

  public destroy() {
    writeLog({ message: 'ShortcutsHandler destroyed', type: 'INFO' });
    this._removeShortcuts();
  }
}
