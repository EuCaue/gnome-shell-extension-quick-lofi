import * as Slider from '@girs/gnome-shell/ui/slider';
import * as PanelMenu from '@girs/gnome-shell/ui/panelMenu';
import * as PopupMenu from '@girs/gnome-shell/ui/popupMenu';
import Gio from 'gi://Gio';
import Player from './Player';
import St from 'gi://St';
import GObject from 'gi://GObject';
import Utils from './Utils';
import GLib from 'gi://GLib';
import { type Radio, type QuickLofiExtension } from './type';

export default class Indicator extends PanelMenu.Button {
  static {
    GObject.registerClass(this);
  }
  public mpvPlayer: Player;
  private _activeRadioPopupItem: PopupMenu.PopupImageMenuItem | null = null;
  private _radios?: Array<Radio>;
  private _icon: St.Icon;
  private _extension: QuickLofiExtension;

  constructor(ext: QuickLofiExtension) {
    super(0.0, 'Quick Lofi');
    this._extension = ext;
    this.mpvPlayer = new Player(this._extension._settings);
    this.mpvPlayer.initVolumeControl();
    this._icon = new St.Icon({
      gicon: Gio.icon_new_for_string(this._extension.path + Utils.ICONS.INDICATOR_DEFAULT),
      iconSize: 20,
      styleClass: 'system-status-icon indicator-icon',
    });
    this.add_child(this._icon);
    this._createMenu();
    this._bindSettingsChangeEvents();
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
    // @ts-expect-error nothing
    this.menu.box.style = `
        max-height: ${styleString};
      `;
  }

  private _bindSettingsChangeEvents(): void {
    this._extension._settings.connect('changed', (_: any, key: string): void => {
      if (key === 'radios') {
        this._createMenu();
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

  public _createMenu(): void {
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
      this._extension._settings.set_int('volume', Number(currentVolume));
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

  public dispose(): void {
    Utils.debug('extension disabled');
    this._extension._settings.set_string('current-radio-playing', '');
    this.mpvPlayer.stopPlayer();
    if (this.mpvPlayer.debounceTimeout) {
      GLib.Source.remove(this.mpvPlayer.debounceTimeout);
      this.mpvPlayer.debounceTimeout = null;
    }
    this.destroy();
  }
}
