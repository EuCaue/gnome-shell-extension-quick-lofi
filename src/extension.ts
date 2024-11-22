import Gio from 'gi://Gio';
import { Extension, ExtensionMetadata } from '@girs/gnome-shell/extensions/extension';
import * as Main from '@girs/gnome-shell/ui/main';
import Utils from './Utils';
import Indicator from './Indicator';

export default class QuickLofi extends Extension {
  _indicator: Indicator | null = null;
  _settings: Gio.Settings | null = null;

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
        const id = Utils.generateNanoIdWithSymbols(10);
        return `${name} - ${url} - ${id}`;
      }
    });
    if (JSON.stringify(radios) === JSON.stringify(updatedRadios)) return;
    this._settings.set_strv('radios', updatedRadios);
  }
  enable() {
    Utils.debug('extension enabled');
    this._settings = this.getSettings();
    this._settings.set_string('current-radio-playing', '');
    this._migrateRadios();
    this._indicator = new Indicator(this);
    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  disable() {
    this._indicator.dispose();
    this._indicator = null;
    this._settings = null;
  }
}
