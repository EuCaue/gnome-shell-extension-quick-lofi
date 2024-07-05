import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';
import { Extension, ExtensionMetadata } from '@girs/gnome-shell/extensions/extension';
import * as Main from '@girs/gnome-shell/ui/main';
import * as PanelMenu from '@girs/gnome-shell/ui/panelMenu';
import * as PopupMenu from '@girs/gnome-shell/ui/popupMenu';
import Player from './Player';
import Utils from './Utils';

export type Radio = { radioName: string; radioUrl: string };

class Indicator extends PanelMenu.Button {
  static {
    GObject.registerClass(this);
  }
  public mpvPlayer: Player;
  private _activeRadioPopupItem: PopupMenu.PopupImageMenuItem | null = null;
  private _radios?: Array<Radio>;
  private _icon: St.Icon;
  private _extension: Extension;

  constructor(ext: Extension) {
    super(0.0, 'Quick Lofi');
    this._extension = ext;
    this.mpvPlayer = new Player(this._extension._settings);
    this.mpvPlayer.init();
    this._radios = [];
    const gicon = Gio.icon_new_for_string(this._extension.path + Utils.ICONS.INDICATOR_DEFAULT);
    this._icon = new St.Icon({
      gicon: gicon,
      styleClass: 'system-status-icon',
      iconSize: 20,
    });
    this.add_child(this._icon);
    this._createRadios();
    this._connectSettingsChangedEvent();
    this._createMenuItems();
    this._handleButtonClick();
  }

  private _createRadios(): void {
    const radios: string[] = this._extension._settings.get_strv('radios');
    radios.forEach((entry: string) => {
      const [radioName, radioUrl] = entry.split(' - ');
      this._radios.push({ radioName, radioUrl });
    });
  }

  private _connectSettingsChangedEvent(): void {
    // HACK: this only work with this._settings, anything else does not work.
    this._extension._settings.connect('changed', (_, key) => {
      if (key === 'radios') {
        this._updateMenuItems();
      }
    });
  }

  private _updateIcon(playing: boolean): void {
    const extPath = this._extension.path;
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
        this._extension.openPreferences();
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

  private _createMenuItems(): void {
    const scrollView = new St.ScrollView();
    const section1 = new PopupMenu.PopupMenuSection();
    scrollView.add_child(section1.actor);
    this._radios.forEach((radio) => {
      const menuItem = new PopupMenu.PopupImageMenuItem(
        radio.radioName,
        Gio.icon_new_for_string(Utils.ICONS.POPUP_PLAY),
      );
      menuItem.connect('activate', this._togglePlayingStatus.bind(this));
      section1.addMenuItem(menuItem);
    });
    this.menu.box.add_child(scrollView);
  }
}

export default class QuickLofi extends Extension {
  _indicator: Indicator | null = null;
  _settings: Gio.Settings | null = null;

  constructor(props: ExtensionMetadata) {
    super(props);
  }

  _removeIndicator() {
    Utils.debug('extension disabled');
    this._indicator?.mpvPlayer.stopPlayer();
    this._indicator.destroy();
    this._indicator = null;
    this._settings = null;
  }

  enable() {
    Utils.debug('extension enabled');
    this._settings = this.getSettings();
    this._indicator = new Indicator(this);
    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  disable() {
    this._removeIndicator();
  }
}
