import Gio from 'gi://Gio';
import { Extension, ExtensionMetadata } from '@girs/gnome-shell/extensions/extension';
import * as Main from '@girs/gnome-shell/ui/main';
import { debug } from './utils/debug';
import Indicator from './Indicator';
import ShortcutsHandler from './ShortcutsHandler';
import { generateNanoIdWithSymbols } from './utils/helpers';

export default class QuickLofi extends Extension {
  _indicator: Indicator | null = null;
  _settings: Gio.Settings | null = null;
  _shortcutsHandler: ShortcutsHandler | null = null;

  constructor(props: ExtensionMetadata) {
    super(props);
  }

  private _migrateRadios(): void {
    const radios = this._settings.get_strv('radios');

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
    this._settings.set_strv('radios', updatedRadios);
  }
  enable() {
    debug('extension enabled');
    this._settings = this.getSettings();
    this._settings.set_string('current-radio-playing', '');
    this._migrateRadios();
    this._indicator = new Indicator(this);
    this._shortcutsHandler = new ShortcutsHandler(this._settings, this._indicator.mpvPlayer);
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
