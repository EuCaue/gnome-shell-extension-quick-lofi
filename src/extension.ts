import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';
import { Extension, ExtensionMetadata } from '@girs/gnome-shell/extensions/extension';
import * as Main from '@girs/gnome-shell/ui/main';
import * as Slider from '@girs/gnome-shell/ui/slider';
import * as PanelMenu from '@girs/gnome-shell/ui/panelMenu';
import * as PopupMenu from '@girs/gnome-shell/ui/popupMenu';
import Player from './Player';
import Utils from './Utils';

export type Radio = { radioName: string; radioUrl: string; id: string };

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
    this._icon = new St.Icon({
      gicon: Gio.icon_new_for_string(this._extension.path + Utils.ICONS.INDICATOR_DEFAULT),
      iconSize: 20,
      styleClass: 'system-status-icon indicator-icon',
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
      const [radioName, radioUrl, id] = entry.split(' - ');
      this._radios.push({ radioName, radioUrl, id });
    });
  }

  private _handlePopupMaxHeight(): void {
    const isPopupMaxHeightSet = this._extension._settings.get_boolean('set-popup-max-height');
    const popupMaxHeight = this._extension._settings.get_string('popup-max-height');
    const styleString = isPopupMaxHeightSet ? popupMaxHeight : 'auto';
    this.menu.box.style = `
        max-height: ${styleString};
      `;
  }

  private _connectSettingsChangedEvent(): void {
    this._extension._settings.connect('changed', (_, key) => {
      if (key === 'radios') {
        this._updateMenuItems();
      }
    });
    this._extension._settings.connect('changed::set-popup-max-height', () => {
      this._handlePopupMaxHeight();
    });
    this._extension._settings.connect('changed::popup-max-height', () => {
      this._handlePopupMaxHeight();
    });
  }

  private _updateIcon(playing: boolean): void {
    const extPath = this._extension.path;
    const iconPath = `${extPath}/${playing ? Utils.ICONS.INDICATOR_PLAYING : Utils.ICONS.INDICATOR_DEFAULT}`;
    const gicon = Gio.icon_new_for_string(iconPath);
    this._icon.set_gicon(gicon);
  }

  private _togglePlayingStatus(child: PopupMenu.PopupImageMenuItem, radioID: string): void {
    const currentRadio = this._radios.find((radio) => radio.id === radioID);
    if (child === this._activeRadioPopupItem) {
      this.mpvPlayer.stopPlayer();
      this._activeRadioPopupItem.setIcon(Gio.icon_new_for_string(Utils.ICONS.POPUP_PLAY));
      this._activeRadioPopupItem = null;
      this._updateIcon(false);
      this._extension._settings.set_string('current-radio-playing', '');
      child.set_style('font-weight: normal');
    } else {
      if (this._activeRadioPopupItem) {
        this._activeRadioPopupItem.setIcon(Gio.icon_new_for_string(Utils.ICONS.POPUP_PLAY));
        this._activeRadioPopupItem.set_style('font-weight: normal');
        this._updateIcon(false);
      }
      this._extension._settings.set_string('current-radio-playing', radioID);
      child.set_style('font-weight: bold');
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
    this._activeRadioPopupItem = null;
    // @ts-expect-error nothing
    this.menu.box.destroy_all_children();
    this._radios = [];
    this._createRadios();
    this._createMenuItems();
  }

  private _createVolumeSlider(popup: PopupMenu.PopupMenuBase): void {
    const separator = new PopupMenu.PopupSeparatorMenuItem();
    const volumeLevel = this._extension._settings.get_int('volume');
    const volumePopupItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
    const volumeBoxLayout = new St.BoxLayout({ vertical: true, x_expand: true });
    const volumeSlider = new Slider.Slider(volumeLevel / 100);
    volumeSlider.connect('notify::value', (slider) => {
      const currentVolume = (slider.value * 100).toFixed(0);
      volumeLabel.text = `Volume: ${currentVolume}`;
      this._extension._settings.set_int('volume', currentVolume);
    });
    const volumeLabel = new St.Label({ text: `Volume: ${volumeSlider.value * 100}` });
    volumeBoxLayout.add_child(volumeLabel);
    volumeBoxLayout.add_child(volumeSlider);
    volumePopupItem.add_child(volumeBoxLayout);
    popup.addMenuItem(separator);
    popup.addMenuItem(volumePopupItem);
  }

  private _createMenuItems(): void {
    const scrollView = new St.ScrollView();
    const popupSection = new PopupMenu.PopupMenuSection();
    scrollView.add_child(popupSection.actor);
    this._radios.forEach((radio) => {
      // @ts-expect-error nothing
      const isRadioPlaying = Utils.isCurrentRadioPlaying(this._extension._settings, radio.id);
      const menuItem = new PopupMenu.PopupImageMenuItem(
        radio.radioName,
        Gio.icon_new_for_string(isRadioPlaying ? Utils.ICONS.POPUP_PAUSE : Utils.ICONS.POPUP_PLAY),
      );
      if (isRadioPlaying) menuItem.set_style('font-weight: bold');
      menuItem.connect('activate', (item) => {
        // @ts-expect-error nothing
        this._togglePlayingStatus(item, radio.id);
      });
      popupSection.addMenuItem(menuItem);
    });
    this._createVolumeSlider(popupSection);
    // @ts-expect-error nothing
    this.menu.box.add_child(scrollView);
    this._handlePopupMaxHeight();
  }
}

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

  _removeIndicator() {
    Utils.debug('extension disabled');
    this._settings.set_string('current-radio-playing', '');
    this._indicator?.mpvPlayer.stopPlayer();
    this._indicator.destroy();
    this._indicator = null;
    this._settings = null;
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
    this._removeIndicator();
  }
}
