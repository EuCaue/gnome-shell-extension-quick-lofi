import Gio from 'gi://Gio';
import { Extension, type ExtensionMetadata } from '@girs/gnome-shell/extensions/extension';
import * as Main from '@girs/gnome-shell/ui/main';
import { debug } from '@utils/debug';
import Indicator from '@/modules/Indicator';
import ShortcutsHandler from '@/modules/ShortcutsHandler';
import { generateNanoIdWithSymbols, getExtSettings } from '@utils/helpers';
import { SETTINGS_KEYS } from '@utils/constants';

export default class QuickLofi extends Extension {
  _indicator: Indicator | null = null;
  _settings: Gio.Settings | null = null;
  _shortcutsHandler: ShortcutsHandler | null = null;

  constructor(props: ExtensionMetadata) {
    super(props);
  }

  private _migrateRadios(): void {
    const radios = this._settings.get_strv(SETTINGS_KEYS.RADIOS_LIST);

    const updatedRadios = radios.map((radio) => {
      if (radio.split(' - ').length === 3) {
        return radio;
      }
      if (radio.includes(' - ')) {
        const [name, url] = radio.split(' - ');
        const id = generateNanoIdWithSymbols(10);
        return `${name} - ${url} - ${id}`;
      }
    });
    if (JSON.stringify(radios) === JSON.stringify(updatedRadios)) return;
    this._settings.set_strv(SETTINGS_KEYS.RADIOS_LIST, updatedRadios);
  }
  enable() {
    debug('extension enabled');
    this._settings = this.getSettings();
    getExtSettings(this);
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
  }
}
