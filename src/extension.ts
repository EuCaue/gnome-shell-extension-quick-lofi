import type Gio from 'gi://Gio';
import { Extension } from '@girs/gnome-shell/extensions/extension';
import * as Main from '@girs/gnome-shell/ui/main';
import Indicator from '@/modules/Indicator';
import ShortcutsHandler from '@/modules/ShortcutsHandler';
import { SETTINGS_KEYS } from '@/shared/constants';
import { debug } from '@/shared/log';
import { migrateRadios } from '@/shared/radios';
import { getExtSettings, resetExtSettings } from '@/shared/settings';

export default class QuickLofi extends Extension {
  _indicator: Indicator | null = null;
  _settings: Gio.Settings | null = null;
  _shortcutsHandler: ShortcutsHandler | null = null;

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
  }

  disable() {
    this._indicator.dispose();
    this._indicator = null;
    this._settings = null;
    this._shortcutsHandler.destroy();
    this._shortcutsHandler = null;
    resetExtSettings();
  }
}
