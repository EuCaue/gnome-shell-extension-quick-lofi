import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import { gettext as _ } from '@girs/gnome-shell/extensions/prefs';
import { handleErrorRow } from '../utils/helpers';
import { SETTINGS_KEYS } from '../utils/constants';

export class InterfacePage extends Adw.PreferencesPage {
  static {
    GObject.registerClass(
      {
        GTypeName: 'InterfacePage',
        Template: 'resource:///org/gnome/Shell/Extensions/quick-lofi/preferences/InterfacePage.ui',
        InternalChildren: ['setPopupMaxHeightRow', 'popupMaxHeightRow'],
      },
      this,
    );
  }

  declare private _setPopupMaxHeightRow: Adw.SwitchRow;
  declare private _popupMaxHeightRow: Adw.EntryRow;

  private _handleApplyPopup(w: Adw.EntryRow): void {
    const VALID_CSS_TYPES: Array<string> = ['px', 'pt', 'em', 'ex', 'rem', 'pc', 'in', 'cm', 'mm'];
    const regex = new RegExp(`^\\d+(\\.\\d+)?(${VALID_CSS_TYPES.join('|')})$`);
    if (!regex.test(w.text)) {
      const defaultValue = this._settings.get_default_value(SETTINGS_KEYS.POPUP_MAX_HEIGHT).get_string()[0];
      handleErrorRow(w, 'Invalid CSS value');
      w.set_text(defaultValue);
      this._settings.set_string(SETTINGS_KEYS.POPUP_MAX_HEIGHT, defaultValue);
      return;
    }
    this._settings.set_string(SETTINGS_KEYS.POPUP_MAX_HEIGHT, w.text);
  }

  constructor(private _settings: Gio.Settings) {
    super();
    this._settings.bind(SETTINGS_KEYS.POPUP_MAX_HEIGHT, this._popupMaxHeightRow, 'text', Gio.SettingsBindFlags.DEFAULT);
    this._settings.bind(
      SETTINGS_KEYS.SET_POPUP_MAX_HEIGHT,
      this._popupMaxHeightRow,
      'visible',
      Gio.SettingsBindFlags.DEFAULT,
    );
    this._settings.bind(
      SETTINGS_KEYS.SET_POPUP_MAX_HEIGHT,
      this._setPopupMaxHeightRow,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    );
  }
}
