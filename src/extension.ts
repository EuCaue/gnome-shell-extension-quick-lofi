import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';
import St1 from '@girs/st-13';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { ICONS, UUID } from './consts';
import { Player } from './Player';
let activeChild = null;
type Radio = { radioName: string; radioUrl: string };

class Indicator extends PanelMenu.Button {
  static {
    GObject.registerClass(this);
  }
  private mpvPlayer = new Player();
  private _radios?: Array<Radio>;
  private _settings: Gio.Settings;
  private _extension: Extension;
  private icon: St.Icon;

  private _createRadios(): void {
    const radios: string[] = Extension.lookupByUUID(UUID).getSettings().get_strv('radios');
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
    this._extension = Extension.lookupByUUID(UUID);
    const path = this._extension.path;
    const gicon = Gio.icon_new_for_string(path + '/icon-symbolic.svg');
    this.icon = new St1.Icon({
      gicon: gicon,
      styleClass: 'system-status-icon',
      iconSize: 20,
    });
    this.add_child(this.icon);
    this._settings = this._extension.getSettings();
    this._settings.connect('changed', (_, key) => {
      if (key === 'radios') {
        this._updateMenuItems();
      }
    });
    this._createRadios();
  }

  private _togglePlayingStatus(child: PopupMenu.PopupImageMenuItem) {
    const currentRadioUrl = this._radios.find((radio) => radio.radioName === child.label.text).radioUrl;

    if (child === activeChild) {
      this.mpvPlayer.stopPlayer();
      activeChild.setIcon(ICONS.PLAY);
      activeChild = null;
      const path = this._extension.path;
      const gicon = Gio.icon_new_for_string(path + '/icon-symbolic.svg');
      this.icon.set_gicon(gicon);
    } else {
      if (activeChild) {
        activeChild.setIcon(ICONS.PLAY);
        const path = this._extension.path;
        const gicon = Gio.icon_new_for_string(path + '/icon-symbolic.svg');
        this.icon.set_gicon(gicon);
      }

      this.mpvPlayer.startPlayer(currentRadioUrl);
      activeChild = child;
      child.setIcon(ICONS.PAUSE);
      const path = this._extension.path;
      const gicon = Gio.icon_new_for_string(path + '/icon-playing-symbolic.svg');
      this.icon.set_gicon(gicon);
    }
  }
  private _handleButtonClick() {
    this.connect('button-press-event', (actor, event) => {
      // 1 = left click, 2 = midle click, 3 = right click;
      // right click open the preferences
      if (event.get_button() === 3) {
        this.menu.close(false);
        this._extension.openPreferences();
        return;
      }
    });
  }

  private _updateMenuItems(): void {
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
    this._extension = Extension.lookupByUUID(UUID);
    this._createRadios();
    super._init(0.0, 'Quick Lofi');
    this._createMenuItems();
    this._handleButtonClick();
  }
}

export default class QuickLofi extends Extension {
  _indicator: Indicator = null;

  enable() {
    this._indicator = new Indicator();
    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  disable() {
    this._indicator.destroy();
    this._indicator = null;
  }
}
