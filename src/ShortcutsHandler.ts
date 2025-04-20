import * as Main from '@girs/gnome-shell/ui/main';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import Utils from './Utils';
import Player from './Player';

export default class ShortcutsHandler {
  constructor(
    private _settings: Gio.Settings,
    private _player: Player,
  ) {
    this.handleShortcuts();
  }

  public handleShortcuts() {
    Main.wm.addKeybinding(
      Utils.SHORTCUTS.PLAY_PAUSE_SHORTCUT,
      this._settings,
      Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
      Shell.ActionMode.NORMAL,
      () => {
        this._player.playPause();
      },
    );
    Main.wm.addKeybinding(
      Utils.SHORTCUTS.STOP_SHORTCUT,
      this._settings,
      Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
      Shell.ActionMode.NORMAL,
      () => {
        this._player.stopPlayer();
      },
    );
  }

  private _removeShortcuts() {
    Object.values(Utils.SHORTCUTS).forEach((key) => {
      Main.wm.removeKeybinding(key);
    });
  }

  public destroy() {
    this._removeShortcuts();
  }
}
