import Gio from 'gi://Gio';
import type GObject from 'gi://GObject';
import { Extension } from '@girs/gnome-shell/extensions/extension';
import * as Main from '@girs/gnome-shell/ui/main';
import Indicator from '@/modules/Indicator';
import Player from '@/modules/Player';
import ShortcutsHandler from '@/modules/ShortcutsHandler';
import { SETTINGS_KEYS } from '@/shared/constants';
import { debug } from '@/shared/log';
import { findRadioById, migrateRadios, parseRadios } from '@/shared/radios';
import { getExtSettings, resetExtSettings } from '@/shared/settings';
import type { SignalConnection } from '@/types';

export default class QuickLofi extends Extension {
  _indicator: Indicator | null = null;
  _settings: Gio.Settings | null = null;
  _shortcutsHandler: ShortcutsHandler | null = null;
  // enable() runs at login and again on every screen unlock, since the extension is disabled while locked
  private _hasEnabled: boolean = false;
  private _startupSignals: SignalConnection[] = [];

  private _migrateRadios(): void {
    const radios = this._settings.get_strv(SETTINGS_KEYS.RADIOS_LIST);
    const updatedRadios: string[] = migrateRadios(radios);
    if (JSON.stringify(radios) === JSON.stringify(updatedRadios)) return;
    this._settings.set_strv(SETTINGS_KEYS.RADIOS_LIST, updatedRadios);
  }
  enable() {
    debug('extension enabled');
    this._settings = this.getSettings();
    getExtSettings(this._settings);
    this._settings.set_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING, '');
    this._migrateRadios();
    this._indicator = new Indicator(this);
    this._shortcutsHandler = new ShortcutsHandler();
    Main.panel.addToStatusArea(this.uuid, this._indicator);
    const autoplayKey = this._hasEnabled
      ? SETTINGS_KEYS.PLAY_DEFAULT_RADIO_ON_UNLOCK
      : SETTINGS_KEYS.PLAY_DEFAULT_RADIO_ON_STARTUP;
    this._hasEnabled = true;
    if (this._settings.get_boolean(autoplayKey)) this._playDefaultRadioWhenReady();
  }

  // At login the shell may still be starting and the network may be down; mpv would fail and notify an error.
  private _playDefaultRadioWhenReady(): void {
    if (Main.layoutManager._startingUp) {
      this._waitFor(Main.layoutManager, 'startup-complete');
      return;
    }
    const url =
      findRadioById(
        parseRadios(this._settings.get_strv(SETTINGS_KEYS.RADIOS_LIST)),
        this._settings.get_string(SETTINGS_KEYS.DEFAULT_RADIO),
      )?.radioUrl ?? '';
    const isLocal = url.startsWith('/') || url.startsWith('~') || url.startsWith('file:');
    const monitor = Gio.NetworkMonitor.get_default();
    if (!isLocal && !monitor.network_available) {
      this._waitFor(monitor, 'notify::network-available');
      return;
    }
    Player.getInstance().playPauseDefaultRadio();
  }

  // Retries `_playDefaultRadioWhenReady` once `signal` fires; `disable()` drops pending waits.
  private _waitFor(emitter: GObject.Object, signal: string): void {
    const id = emitter.connect(signal, () => {
      emitter.disconnect(id);
      this._startupSignals = this._startupSignals.filter((s) => s.id !== id);
      this._playDefaultRadioWhenReady();
    });
    this._startupSignals.push({ emitter, id });
  }

  disable() {
    for (const { emitter, id } of this._startupSignals) emitter.disconnect(id);
    this._startupSignals = [];
    this._indicator.dispose();
    this._indicator = null;
    this._settings = null;
    this._shortcutsHandler.destroy();
    this._shortcutsHandler = null;
    resetExtSettings();
  }
}
