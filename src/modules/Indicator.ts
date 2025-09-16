import * as Slider from '@girs/gnome-shell/ui/slider';
import * as PanelMenu from '@girs/gnome-shell/ui/panelMenu';
import * as PopupMenu from '@girs/gnome-shell/ui/popupMenu';
import Gio from 'gi://Gio';
import Player from './Player';
import St from 'gi://St';
import GObject from 'gi://GObject';
import { ICONS, SETTINGS_KEYS } from '@utils/constants';
import { type Radio, type QuickLofiExtension } from '@/types';
import { isCurrentRadioPlaying } from '@utils/helpers';
import { debug } from '@utils/debug';

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
      gicon: Gio.icon_new_for_string(this._extension.path + ICONS.INDICATOR_DEFAULT),
      iconSize: 20,
      styleClass: 'system-status-icon indicator-icon',
    });
    this.add_child(this._icon);
    this._createMenu();
    this._bindSettingsChangeEvents();
    this._handleButtonClick();
  }

  private _createRadios(): void {
    const radios: string[] = this._extension._settings.get_strv(SETTINGS_KEYS.RADIOS_LIST);
    radios.forEach((entry: string) => {
      const [radioName, radioUrl, id] = entry.split(' - ');
      this._radios.push({ radioName, radioUrl, id });
    });
  }

  private _handlePopupMaxHeight(): void {
    const isPopupMaxHeightSet = this._extension._settings.get_boolean(SETTINGS_KEYS.SET_POPUP_MAX_HEIGHT);
    const popupMaxHeight = this._extension._settings.get_string(SETTINGS_KEYS.POPUP_MAX_HEIGHT);
    const styleString = isPopupMaxHeightSet ? popupMaxHeight : 'auto';
    // @ts-expect-error nothing
    this.menu.box.style = `
        max-height: ${styleString};
      `;
  }

  private _bindSettingsChangeEvents(): void {
    this._extension._settings.connect('changed', (_: any, key: string): void => {
      if (key === SETTINGS_KEYS.RADIOS_LIST) {
        this._createMenu();
      }
    });
    this._extension._settings.connect(`changed::${SETTINGS_KEYS.CURRENT_RADIO_PLAYING}`, () => {
      // stop player if current radio was removed
      if (
        this.mpvPlayer.isPlaying() &&
        this._extension._settings.get_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING).length <= 0
      ) {
        this.mpvPlayer.stopPlayer();
      }
    });
    this._extension._settings.connect(`changed::${SETTINGS_KEYS.SET_POPUP_MAX_HEIGHT}`, () => {
      this._handlePopupMaxHeight();
    });
    this._extension._settings.connect(`changed::${SETTINGS_KEYS.POPUP_MAX_HEIGHT}`, () => {
      this._handlePopupMaxHeight();
    });
    this.mpvPlayer.connect('play-state-changed', (sender: Player, isPaused: boolean) => {
      this._activeRadioPopupItem.setIcon(Gio.icon_new_for_string(isPaused ? ICONS.POPUP_PAUSE : ICONS.POPUP_STOP));
      this._updateIndicatorIcon({ playing: isPaused ? 'paused' : 'playing' });
    });
    this.mpvPlayer.connect('playback-stopped', () => {
      this._updateIndicatorIcon({ playing: 'default' });
      this._activeRadioPopupItem.setIcon(Gio.icon_new_for_string(ICONS.POPUP_PLAY));
      this._extension._settings.set_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING, '');
      this._activeRadioPopupItem.set_style('font-weight: normal');
      this._activeRadioPopupItem = null;
    });
  }

  private _updateIndicatorIcon({ playing }: { playing: 'playing' | 'default' | 'paused' }): void {
    const extPath = this._extension.path;
    const icon = `INDICATOR_${playing.toUpperCase()}` as keyof typeof ICONS;
    const iconPath = `${extPath}/${ICONS[icon]}`;
    const gicon = Gio.icon_new_for_string(iconPath);
    this._icon.set_gicon(gicon);
  }

  private _togglePlayingStatus(child: PopupMenu.PopupImageMenuItem, radioID: string, mouseButton: number): void {
    const isRightClickOnActiveRadio = child === this._activeRadioPopupItem && mouseButton === 3;
    const isLeftClickOnActiveRadio = child === this._activeRadioPopupItem && mouseButton === 1;

    if (isRightClickOnActiveRadio) {
      this.mpvPlayer.stopPlayer();
      return;
    }
    if (isLeftClickOnActiveRadio) {
      this.mpvPlayer.playPause();
      return;
    }
    const currentRadio = this._radios.find((radio) => radio.id === radioID);
    if (this._activeRadioPopupItem) {
      this._activeRadioPopupItem.setIcon(Gio.icon_new_for_string(ICONS.POPUP_PLAY));
      this._activeRadioPopupItem.set_style('font-weight: normal');
      this._updateIndicatorIcon({ playing: 'default' });
    }
    this.mpvPlayer.startPlayer(currentRadio);
    this._updateIndicatorIcon({ playing: 'playing' });
    child.setIcon(Gio.icon_new_for_string(ICONS.POPUP_STOP));
    child.set_style('font-weight: bold');
    this._extension._settings.set_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING, radioID);
    this._activeRadioPopupItem = child;
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
    const volumeLevel = this._extension._settings.get_int(SETTINGS_KEYS.VOLUME);
    const volumePopupItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
    const volumeBoxLayout = new St.BoxLayout({ vertical: true, x_expand: true });
    const volumeSlider = new Slider.Slider(volumeLevel / 100);
    volumeSlider.connect('notify::value', (slider) => {
      const currentVolume = (slider.value * 100).toFixed(0);
      volumeLabel.text = `Volume: ${currentVolume}`;
      this._extension._settings.set_int(SETTINGS_KEYS.VOLUME, Number(currentVolume));
    });
    this._extension._settings.connect(`changed::${SETTINGS_KEYS.VOLUME}`, (settings, key) => {
      const volume = settings.get_int(key);
      volumeLabel.text = `Volume: ${volume}`;
      volumeSlider.value = volume / 100;
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
    const isPaused = this.mpvPlayer.getProperty('pause');
    this._radios.forEach((radio) => {
      const isRadioPlaying = isCurrentRadioPlaying(this._extension._settings, radio.id);
      const menuItem = new PopupMenu.PopupImageMenuItem(
        radio.radioName,
        Gio.icon_new_for_string(
          isRadioPlaying && isPaused.data ? ICONS.POPUP_PAUSE : isRadioPlaying ? ICONS.POPUP_STOP : ICONS.POPUP_PLAY,
        ),
      );
      if (isRadioPlaying) {
        menuItem.set_style('font-weight: bold');
        this._activeRadioPopupItem = menuItem;
      }
      menuItem.connect('activate', (item, event) => {
        //  NOTE: MOUSE BUTTONS IDS
        // 1 -> LMB
        // 3 -> RMB
        const mouseButton = event.get_button();
        this._togglePlayingStatus(item as PopupMenu.PopupImageMenuItem, radio.id, mouseButton);
      });
      popupSection.addMenuItem(menuItem);
    });
    this._createVolumeSlider(popupSection);
    // @ts-expect-error nothing
    this.menu.box.add_child(scrollView);
    this._handlePopupMaxHeight();
  }

  public dispose(): void {
    debug('extension disabled');
    this._extension._settings.set_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING, '');
    this.mpvPlayer.stopPlayer();
    this.destroy();
  }
}
