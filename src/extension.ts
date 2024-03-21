import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { ICONS, UUID } from './consts';
import { Player } from './Player';
import Utils from './Utils';
let activeChild = null;
export type Radio = { radioName: string; radioUrl: string };

class Indicator extends PanelMenu.Button {
  static {
    GObject.registerClass(this);
  }

  public mpvPlayer = new Player();
  private _radios?: Array<Radio>;
  private _settings: Gio.Settings = Utils.getSettings();
  private _icon: St.Icon;

  private _createRadios(): void {
    const radios: string[] = Utils.getSettings().get_strv('radios');
    radios.forEach((entry: string) => {
      const [radioName, radioUrl] = entry.split(' - ');
      this._radios.push({ radioName, radioUrl });
    });
  }

  constructor() {
    super(0.0, 'Quick Lofi');
    this.mpvPlayer = new Player();
    this.mpvPlayer.init();
    this._radios = [];
    const gicon = Gio.icon_new_for_string(Utils.getExtension().path + '/icon-symbolic.svg');
    this._icon = new St.Icon({
      gicon: gicon,
      styleClass: 'system-status-icon',
      iconSize: 20,
    });
    this.add_child(this._icon);
    // FIXME: for some reason, this only work with this._settings, anything else does not work.
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
    const iconPath = `${extPath}/icon${playing ? '-playing' : ''}-symbolic.svg`;
    const gicon = Gio.icon_new_for_string(iconPath);
    this._icon.set_gicon(gicon);
  }

  private _togglePlayingStatus(child: PopupMenu.PopupImageMenuItem): void {
    const currentRadio = this._radios.find((radio) => radio.radioName === child.label.text);

    if (child === activeChild) {
      this.mpvPlayer.stopPlayer();
      activeChild.setIcon(ICONS.PLAY);
      activeChild = null;
      this._updateIcon(false);
    } else {
      if (activeChild) {
        activeChild.setIcon(ICONS.PLAY);
        this._updateIcon(false);
      }

      this.mpvPlayer.startPlayer(currentRadio);
      activeChild = child;
      child.setIcon(ICONS.PAUSE);
      this._updateIcon(true);
    }
  }
  private _handleButtonClick(): void {
    this.connect('button-press-event', (actor, event) => {
      // 1 = left click, 2 = midle click, 3 = right click;
      // right click open the preferences
      if (event.get_button() === 3) {
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
      const menuItem = new PopupMenu.PopupImageMenuItem(radio.radioName, ICONS.PLAY);
      menuItem.connect('activate', this._togglePlayingStatus.bind(this));
      section1.addMenuItem(menuItem);
    });
    this.menu.box.add_child(scrollView);
    this.menu.box.style = `
        max-height: 200px;
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
    if (this._indicator && (Main.sessionMode.currentMode === 'user' || Main.sessionMode.parentMode === 'user')) {
      console.log('[Quick Lofi] disabled');
      this._indicator.mpvPlayer.stopPlayer();
      this._indicator.destroy();
      this._indicator = null;
    }
  }

  enable() {
    if (this._indicator === null) {
      console.log('[Quick Lofi] enabled');
      this._indicator = new Indicator();
      Main.panel.addToStatusArea(this.uuid, this._indicator);
    }
  }

  disable() {
    this._removeIndicator();
  }
}
