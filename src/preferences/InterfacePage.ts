import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { handleErrorRow, setEntryRowText } from '@/preferences/EntryRow';
import { CLICK_ACTIONS_NAMES, SETTINGS_KEYS } from '@/shared/constants';
import { writeLog } from '@/shared/log';
import { clickAction } from '@/shared/settings';

export class InterfacePage extends Adw.PreferencesPage {
  static {
    GObject.registerClass(
      {
        GTypeName: 'InterfacePage',
        Template: 'resource:///org/gnome/Shell/Extensions/quick-lofi/preferences/InterfacePage.ui',
        InternalChildren: [
          'setPopupMaxHeightRow',
          'popupMaxHeightRow',
          'setPopupMaxWidthRow',
          'popupMaxWidthRow',
          'setPopupWidthRow',
          'popupWidthRow',
          'setPopupHeightRow',
          'popupHeightRow',
          'leftClickRow',
          'middleClickRow',
          'rightClickRow',
          'radioLeftClickRow',
          'radioMiddleClickRow',
          'radioRightClickRow',
          'miniPrevLeftRow',
          'miniPrevMiddleRow',
          'miniPrevRightRow',
          'miniPlayLeftRow',
          'miniPlayMiddleRow',
          'miniPlayRightRow',
          'miniNextLeftRow',
          'miniNextMiddleRow',
          'miniNextRightRow',
          'enableDebug',
        ],
      },
      this,
    );
  }

  private declare _setPopupMaxHeightRow: Adw.SwitchRow;
  private declare _popupMaxHeightRow: Adw.EntryRow;
  private declare _setPopupMaxWidthRow: Adw.SwitchRow;
  private declare _popupMaxWidthRow: Adw.EntryRow;
  private declare _setPopupWidthRow: Adw.SwitchRow;
  private declare _popupWidthRow: Adw.EntryRow;
  private declare _setPopupHeightRow: Adw.SwitchRow;
  private declare _popupHeightRow: Adw.EntryRow;
  private declare _leftClickRow: Adw.ComboRow;
  private declare _middleClickRow: Adw.ComboRow;
  private declare _rightClickRow: Adw.ComboRow;
  private declare _radioLeftClickRow: Adw.ComboRow;
  private declare _radioMiddleClickRow: Adw.ComboRow;
  private declare _radioRightClickRow: Adw.ComboRow;
  private declare _miniPrevLeftRow: Adw.ComboRow;
  private declare _miniPrevMiddleRow: Adw.ComboRow;
  private declare _miniPrevRightRow: Adw.ComboRow;
  private declare _miniPlayLeftRow: Adw.ComboRow;
  private declare _miniPlayMiddleRow: Adw.ComboRow;
  private declare _miniPlayRightRow: Adw.ComboRow;
  private declare _miniNextLeftRow: Adw.ComboRow;
  private declare _miniNextMiddleRow: Adw.ComboRow;
  private declare _miniNextRightRow: Adw.ComboRow;
  private declare _enableDebug: Adw.SwitchRow;

  _handleApplyPopup(w: Adw.EntryRow): void {
    // row id maps to its settings key: popupMaxHeightRow -> popup-max-height
    const key = w
      .get_buildable_id()
      .replace(/Row$/, '')
      .replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    const VALID_CSS_TYPES: Array<string> = ['px', 'pt', 'em', 'ex', 'rem', 'pc', 'in', 'cm', 'mm'];
    const regex = new RegExp(`^\\d+(\\.\\d+)?(${VALID_CSS_TYPES.join('|')})$`);
    writeLog({ message: `[InterfacePage] Validating ${key}: ${w.text}`, type: 'INFO' });

    if (!regex.test(w.text) || Number.parseFloat(w.text) <= 0) {
      const defaultValue = this._settings.get_default_value(key).get_string()[0];
      writeLog({
        message: `[InterfacePage] Invalid CSS value "${w.text}", reverting to default: ${defaultValue}`,
        type: 'WARN',
      });
      handleErrorRow(w, 'Invalid CSS value');
      setEntryRowText(w, defaultValue);
      this._settings.set_string(key, defaultValue);
      return;
    }

    writeLog({ message: `[InterfacePage] Setting ${key} to: ${w.text}`, type: 'INFO' });
    this._settings.set_string(key, w.text);
  }

  // Each row picks the action for one mouse button (left, middle, right) of an `as` click actions key.
  private _bindClickActions(key: string, rows: Adw.ComboRow[]): void {
    const actions: string[] = Array.from(CLICK_ACTIONS_NAMES.keys());
    const defaults = this._settings.get_default_value(key).deepUnpack() as string[];

    rows.forEach((row, button) => {
      row.set_model(Gtk.StringList.new(Array.from(CLICK_ACTIONS_NAMES.values())));
      // an unknown stored value runs nothing, so the row keeps showing 'Nothing' (the first option)
      const position = actions.indexOf(clickAction(this._settings, key, button + 1));
      if (position >= 0) row.set_selected(position);

      row.connect('notify::selected', () => {
        // pad from the defaults so a short stored list never gets holes
        const current = this._settings.get_strv(key);
        const updated = defaults.map((action, i) => current[i] ?? action);
        updated[button] = actions[row.get_selected()];
        writeLog({ message: `[InterfacePage] Setting ${key} to: ${updated.join(', ')}`, type: 'INFO' });
        this._settings.set_strv(key, updated);
      });
    });
  }

  constructor(private _settings: Gio.Settings) {
    super();
    writeLog({ message: '[InterfacePage] Initializing interface preferences page', type: 'INFO' });

    this._settings.bind(SETTINGS_KEYS.POPUP_MAX_HEIGHT, this._popupMaxHeightRow, 'text', Gio.SettingsBindFlags.GET);
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

    this._settings.bind(SETTINGS_KEYS.POPUP_MAX_WIDTH, this._popupMaxWidthRow, 'text', Gio.SettingsBindFlags.GET);
    this._settings.bind(
      SETTINGS_KEYS.SET_POPUP_MAX_WIDTH,
      this._popupMaxWidthRow,
      'visible',
      Gio.SettingsBindFlags.DEFAULT,
    );
    this._settings.bind(
      SETTINGS_KEYS.SET_POPUP_MAX_WIDTH,
      this._setPopupMaxWidthRow,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    );

    this._settings.bind(SETTINGS_KEYS.POPUP_WIDTH, this._popupWidthRow, 'text', Gio.SettingsBindFlags.GET);
    this._settings.bind(SETTINGS_KEYS.SET_POPUP_WIDTH, this._popupWidthRow, 'visible', Gio.SettingsBindFlags.DEFAULT);
    this._settings.bind(SETTINGS_KEYS.SET_POPUP_WIDTH, this._setPopupWidthRow, 'active', Gio.SettingsBindFlags.DEFAULT);

    this._settings.bind(SETTINGS_KEYS.POPUP_HEIGHT, this._popupHeightRow, 'text', Gio.SettingsBindFlags.GET);
    this._settings.bind(SETTINGS_KEYS.SET_POPUP_HEIGHT, this._popupHeightRow, 'visible', Gio.SettingsBindFlags.DEFAULT);
    this._settings.bind(
      SETTINGS_KEYS.SET_POPUP_HEIGHT,
      this._setPopupHeightRow,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    );

    this._settings.bind(SETTINGS_KEYS.ENABLE_DEBUG, this._enableDebug, 'active', Gio.SettingsBindFlags.DEFAULT);
    this._enableDebug.set_subtitle(
      `When enabled, app activity is logged to /tmp/quick-lofi-${GLib.get_user_name()}.log.`,
    );
    this._bindClickActions(SETTINGS_KEYS.INDICATOR_ACTIONS, [
      this._leftClickRow,
      this._middleClickRow,
      this._rightClickRow,
    ]);
    this._bindClickActions(SETTINGS_KEYS.RADIO_ITEM_ACTIONS, [
      this._radioLeftClickRow,
      this._radioMiddleClickRow,
      this._radioRightClickRow,
    ]);
    this._bindClickActions(SETTINGS_KEYS.MINI_PLAYER_PREV_ACTIONS, [
      this._miniPrevLeftRow,
      this._miniPrevMiddleRow,
      this._miniPrevRightRow,
    ]);
    this._bindClickActions(SETTINGS_KEYS.MINI_PLAYER_PLAY_ACTIONS, [
      this._miniPlayLeftRow,
      this._miniPlayMiddleRow,
      this._miniPlayRightRow,
    ]);
    this._bindClickActions(SETTINGS_KEYS.MINI_PLAYER_NEXT_ACTIONS, [
      this._miniNextLeftRow,
      this._miniNextMiddleRow,
      this._miniNextRightRow,
    ]);
    writeLog({ message: '[InterfacePage] Interface preferences page initialized', type: 'INFO' });
  }
}
