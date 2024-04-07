import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { Player } from './Player';
import Utils from './Utils';
export type Radio = { radioName: string; radioUrl: string };

class Indicator extends PanelMenu.Button {
  static {
    GObject.registerClass(this);
  }
  public mpvPlayer = new Player();
  private _radios?: Array<Radio>;
  private _settings: Gio.Settings = Utils.getSettings();
  private _icon: St.Icon;
  private _activeRadioPopupItem: PopupMenu.PopupImageMenuItem | null = null;

  constructor() {
    super(0.0, 'Quick Lofi');
    this.mpvPlayer = new Player();
    this.mpvPlayer.init();
    this._radios = [];
    const gicon = Gio.icon_new_for_string(Utils.getExtension().path + Utils.ICONS.INDICATOR_DEFAULT);
    this._icon = new St.Icon({
      gicon: gicon,
      styleClass: 'system-status-icon',
      iconSize: 20,
    });
    this.add_child(this._icon);
    this._connectSettingsChangedEvent();
  }

  private _createRadios(): void {
    const radios: string[] = Utils.getSettings().get_strv('radios');
    radios.forEach((entry: string) => {
      const [radioName, radioUrl] = entry.split(' - ');
      this._radios.push({ radioName, radioUrl });
    });
  }

  private _connectSettingsChangedEvent(): void {
    // HACK: this only work with this._settings, anything else does not work.
    this._settings = Utils.getSettings();
    this._settings.connect('changed', (_, key) => {
      Utils.debug('VRUM');
      if (key === 'radios') {
        this._updateMenuItems();
      }
    });
    this._createRadios();
  }

  private _updateIcon(playing: boolean) {
    const extPath = Utils.getExtension().path;
    const iconPath = `${extPath}/${playing ? Utils.ICONS.INDICATOR_PLAYING : Utils.ICONS.INDICATOR_DEFAULT}`;
    const gicon = Gio.icon_new_for_string(iconPath);
    this._icon.set_gicon(gicon);
  }

  private _togglePlayingStatus(child: PopupMenu.PopupImageMenuItem): void {
    const currentRadio = this._radios.find((radio) => radio.radioName === child.label.text);

    if (child === this._activeRadioPopupItem) {
      this.mpvPlayer.stopPlayer();
      this._activeRadioPopupItem.setIcon(Gio.icon_new_for_string(Utils.ICONS.POPUP_PLAY));
      this._activeRadioPopupItem = null;
      this._updateIcon(false);
    } else {
      if (this._activeRadioPopupItem) {
        this._activeRadioPopupItem.setIcon(Gio.icon_new_for_string(Utils.ICONS.POPUP_PLAY));
        this._updateIcon(false);
      }

      this.mpvPlayer.startPlayer(currentRadio);
      this._activeRadioPopupItem = child;
      child.setIcon(Gio.icon_new_for_string(Utils.ICONS.POPUP_PAUSE));
      this._updateIcon(true);
    }
  }
  private _handleButtonClick(): void {
    this.connect('button-press-event', (_, event) => {
      const RIGHT_CLICK = 3;
      if (event.get_button() === RIGHT_CLICK) {
        this.menu.close(false);
        Utils.getExtension().openPreferences();
        return;
      }
    });
  }

  public _updateMenuItems(): void {
    this.menu.box.remove_all_children();
    this._radios = [];
    this._createRadios();
    this._createMenuItems();
  }

  private _createMenuItems() {
    const scrollView = new St.ScrollView();
    const section1 = new PopupMenu.PopupMenuSection();
    scrollView.add_actor(section1.actor);
    this._radios.forEach((radio) => {
      const menuItem = new PopupMenu.PopupImageMenuItem(
        radio.radioName,
        Gio.icon_new_for_string(Utils.ICONS.POPUP_PLAY),
      );
      menuItem.connect('activate', this._togglePlayingStatus.bind(this));
      section1.addMenuItem(menuItem);
    });
    this.menu.box.add_child(scrollView);
    this.menu.box.style = `
        max-height: 13em;
    `;
  }

  _init() {
    this._radios = [];
    this._createRadios();
    super._init(0.0, 'Quick Lofi');
    this._createMenuItems();
    this._handleButtonClick();
  }
}

export default class QuickLofi extends Extension {
  _indicator: Indicator = null;

  _removeIndicator() {
    // do not disable extension while is in lock screen, to continue playing music, but disable when it's not in lock screen.
    const isUserMode = Main.sessionMode.currentMode === 'user' || Main.sessionMode.parentMode === 'user';
    if (this._indicator && isUserMode) {
      Utils.debug('extension disabled');
      this._indicator.mpvPlayer.stopPlayer();
      this._indicator.destroy();
      this._indicator = null;
    }
  }

  enable() {
    if (this._indicator === null) {
      Utils.debug('extension enabled');
      this._indicator = new Indicator();
      Main.panel.addToStatusArea(this.uuid, this._indicator);
    }
  }

  disable() {
    this._removeIndicator();
  }
}
