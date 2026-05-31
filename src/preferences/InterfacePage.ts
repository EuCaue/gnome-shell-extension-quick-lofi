import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import type Gtk from 'gi://Gtk';
import {
  INDICATOR_ACTIONS_NAMES,
  type IndicatorActionKey,
  type IndicatorActionValue,
  SETTINGS_KEYS,
} from '@utils/constants';
import { handleErrorRow, writeLog } from '@utils/helpers';

export class InterfacePage extends Adw.PreferencesPage {
  static {
    GObject.registerClass(
      {
        GTypeName: 'InterfacePage',
        Template: 'resource:///org/gnome/Shell/Extensions/quick-lofi/preferences/InterfacePage.ui',
        InternalChildren: [
          'setPopupMaxHeightRow',
          'popupMaxHeightRow',
          'leftClickActionList',
          'middleClickActionList',
          'rightClickActionList',
          'leftClickRow',
          'middleClickRow',
          'rightClickRow',
          'enableDebug',
        ],
      },
      this,
    );
  }

  private declare _setPopupMaxHeightRow: Adw.SwitchRow;
  private declare _popupMaxHeightRow: Adw.EntryRow;
  private declare _leftClickActionList: Gtk.StringList;
  private declare _middleClickActionList: Gtk.StringList;
  private declare _rightClickActionList: Gtk.StringList;
  private declare _leftClickRow: Adw.ComboRow;
  private declare _middleClickRow: Adw.ComboRow;
  private declare _rightClickRow: Adw.ComboRow;
  private declare _enableDebug: Adw.SwitchRow;
  private _indicatorActionsNames: Map<IndicatorActionKey, IndicatorActionValue>;
  private _indicatorActionsSettings: IndicatorActionKey[];

  _handleApplyPopup(w: Adw.EntryRow): void {
    const VALID_CSS_TYPES: Array<string> = ['px', 'pt', 'em', 'ex', 'rem', 'pc', 'in', 'cm', 'mm'];
    const regex = new RegExp(`^\\d+(\\.\\d+)?(${VALID_CSS_TYPES.join('|')})$`);
    writeLog({ message: `[InterfacePage] Validating popup height: ${w.text}`, type: 'INFO' });

    if (!regex.test(w.text)) {
      const defaultValue = this._settings.get_default_value(SETTINGS_KEYS.POPUP_MAX_HEIGHT).get_string()[0];
      writeLog({
        message: `[InterfacePage] Invalid CSS value "${w.text}", reverting to default: ${defaultValue}`,
        type: 'WARN',
      });
      handleErrorRow(w, 'Invalid CSS value');
      w.set_text(defaultValue);
      this._settings.set_string(SETTINGS_KEYS.POPUP_MAX_HEIGHT, defaultValue);
      return;
    }

    writeLog({ message: `[InterfacePage] Setting popup max height to: ${w.text}`, type: 'INFO' });
    this._settings.set_string(SETTINGS_KEYS.POPUP_MAX_HEIGHT, w.text);
  }

  private _handleIndicatorActions() {
    writeLog({ message: '[InterfacePage] Setting up indicator actions handlers', type: 'INFO' });

    const updateAction = ({ mouseBtn, actionIndex }: { mouseBtn: number; actionIndex: number }): void => {
      const actions = Array.from(this._indicatorActionsNames.keys());
      const newAction = actions[actionIndex];
      const buttonNames = ['left', 'middle', 'right'];
      writeLog({
        message: `[InterfacePage] Updating ${buttonNames[mouseBtn]} click action to: ${newAction}`,
        type: 'INFO',
      });

      this._indicatorActionsSettings[mouseBtn] = actions[actionIndex];
      this._settings.set_strv(SETTINGS_KEYS.INDICATOR_ACTIONS, this._indicatorActionsSettings);
    };

    const setRowAction = ({ list, row, mouseBtn }: { list: Gtk.StringList; row: Adw.ComboRow; mouseBtn: number }) => {
      const actions = Array.from(this._indicatorActionsNames.values());
      const buttonNames = ['left', 'middle', 'right'];
      writeLog({ message: `[InterfacePage] Setting up ${buttonNames[mouseBtn]} click action row`, type: 'INFO' });

      for (const action of actions) {
        list.append(action);
      }
      const savedActionKey = this._indicatorActionsSettings[mouseBtn];
      const savedActionValue = this._indicatorActionsNames.get(savedActionKey);
      const rowPosition = actions.indexOf(savedActionValue);
      row.set_selected(rowPosition);
      row.connect('notify::selected', () => {
        const newActionIndex: number = row.get_selected();
        updateAction({ mouseBtn, actionIndex: newActionIndex });
      });
    };

    setRowAction({ list: this._leftClickActionList, row: this._leftClickRow, mouseBtn: 0 });
    setRowAction({ list: this._middleClickActionList, row: this._middleClickRow, mouseBtn: 1 });
    setRowAction({ list: this._rightClickActionList, row: this._rightClickRow, mouseBtn: 2 });
    writeLog({ message: '[InterfacePage] Indicator actions handlers setup complete', type: 'INFO' });
  }

  constructor(private _settings: Gio.Settings) {
    super();
    writeLog({ message: '[InterfacePage] Initializing interface preferences page', type: 'INFO' });
    this._indicatorActionsNames = INDICATOR_ACTIONS_NAMES;
    this._indicatorActionsSettings = this._settings.get_strv(SETTINGS_KEYS.INDICATOR_ACTIONS) as IndicatorActionKey[];
    writeLog({
      message: `[InterfacePage] Current indicator actions: ${this._indicatorActionsSettings.join(', ')}`,
      type: 'INFO',
    });

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
    this._settings.bind(SETTINGS_KEYS.ENABLE_DEBUG, this._enableDebug, 'active', Gio.SettingsBindFlags.DEFAULT);
    this._enableDebug.set_subtitle(
      `When enabled, app activity is logged to /tmp/quick-lofi-${GLib.get_user_name()}.log.`,
    );
    this._handleIndicatorActions();
    writeLog({ message: '[InterfacePage] Interface preferences page initialized', type: 'INFO' });
  }
}
