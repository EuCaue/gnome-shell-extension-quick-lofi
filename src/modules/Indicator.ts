import * as Slider from '@girs/gnome-shell/ui/slider';
import * as PanelMenu from '@girs/gnome-shell/ui/panelMenu';
import * as PopupMenu from '@girs/gnome-shell/ui/popupMenu';
import Gio from 'gi://Gio';
import Player from './Player';
import St from 'gi://St';
import GObject from 'gi://GObject';
import { ICONS, IndicatorActionKey, SETTINGS_KEYS } from '@utils/constants';
import { type Radio, type QuickLofiExtension } from '@/types';
import { isCurrentRadioPlaying, writeLog } from '@utils/helpers';
import { debug } from '@utils/debug';
import { IndicatorActions } from './IndicatorActions';

export default class Indicator extends PanelMenu.Button {
  static {
    GObject.registerClass(this);
  }
  private _indicatorActions: IndicatorActions;
  private _activeRadioPopupItem: PopupMenu.PopupImageMenuItem | null = null;
  private _radios?: Array<Radio>;
  private _icon: St.Icon;
  private _extension: QuickLofiExtension;
  private _isUpdatingCurrentRadio: boolean = false;
  private mpvPlayer: Player;
  public signalsHandlers: Array<{ emitter: any; signalID: number }> = [];
  public menuSignals: Array<{ emitter: any; signalID: number }> = [];

  constructor(ext: QuickLofiExtension) {
    super(0.0, 'Quick Lofi');
    writeLog({ message: '[Indicator] Initializing indicator', type: 'INFO' });
    this._extension = ext;
    this.mpvPlayer = Player.getInstance();
    this._icon = new St.Icon({
      gicon: Gio.icon_new_for_string(this._extension.path + ICONS.INDICATOR_DEFAULT),
      iconSize: 20,
      styleClass: 'system-status-icon indicator-icon',
    });
    this.add_child(this._icon);
    this._createMenu();
    this._bindSettingsChangeEvents();
    this._indicatorActions = new IndicatorActions(this.menu, this._extension);
    this._handleButtonClick();
    writeLog({ message: '[Indicator] Indicator initialized successfully', type: 'INFO' });
  }

  private _createRadios(): void {
    const radios: string[] = this._extension._settings.get_strv(SETTINGS_KEYS.RADIOS_LIST);
    writeLog({ message: `[Indicator] Creating radios from ${radios.length} entries`, type: 'INFO' });

    this._radios = radios.map((entry: string) => {
      const parts = entry.split(' - ');
      const radioName = (parts[0] || '').trim();
      const radioUrl = (parts[1] || '').trim();
      const id = (parts[2] || '').trim();
      return { radioName, radioUrl, id };
    });
    writeLog({ message: `[Indicator] Created ${this._radios.length} radio objects`, type: 'INFO' });
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
    this.signalsHandlers.push({
      emitter: this._extension._settings,
      signalID: this._extension._settings.connect('changed', (_: any, key: string): void => {
        if (key === SETTINGS_KEYS.RADIOS_LIST) {
          if (this.mpvPlayer.isPlaying()) {
            const currentRadioPlayingID = this._extension._settings.get_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING);
            const currentRadioPlaying = this._radios.find((radio) => radio.id === currentRadioPlayingID);
            const [updatedRadioName, updatedRadioUrl, id]: string[] = this._extension._settings
              .get_strv(SETTINGS_KEYS.RADIOS_LIST)
              .find((radio) => radio.endsWith(currentRadioPlayingID))
              .split(' - ');
            if (currentRadioPlaying.radioUrl !== updatedRadioUrl.trim() && currentRadioPlaying.id === id) {
              const isPaused = this.mpvPlayer.getProperty('pause').data;
              if (!isPaused) {
                this._isUpdatingCurrentRadio = true;
                this.mpvPlayer.startPlayer({ id, radioName: updatedRadioName, radioUrl: updatedRadioUrl });
                this._updateIndicatorIcon({ playing: 'playing' });
                this._activeRadioPopupItem.setIcon(Gio.icon_new_for_string(ICONS.POPUP_STOP));
                this._activeRadioPopupItem.set_style('font-weight: bold');
              } else if (isPaused) {
                this.mpvPlayer.stopPlayer();
                this.mpvPlayer.startPlayer({ id, radioName: updatedRadioName, radioUrl: updatedRadioUrl });
                this.mpvPlayer.playPause();
              }
              return;
            }
          }
          if (!this._isUpdatingCurrentRadio) {
            this._createMenu();
          }
        }
      }),
    });
    this.signalsHandlers.push({
      emitter: this._extension._settings,
      signalID: this._extension._settings.connect(`changed::${SETTINGS_KEYS.CURRENT_RADIO_PLAYING}`, () => {
        // stop player if current radio was removed
        if (
          this.mpvPlayer.isPlaying() &&
          this._extension._settings.get_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING).length <= 0
        ) {
          this.mpvPlayer.stopPlayer();
        }
      }),
    });
    this.signalsHandlers.push({
      emitter: this._extension._settings,
      signalID: this._extension._settings.connect(`changed::${SETTINGS_KEYS.SET_POPUP_MAX_HEIGHT}`, () => {
        this._handlePopupMaxHeight();
      }),
    });
    this.signalsHandlers.push({
      emitter: this._extension._settings,
      signalID: this._extension._settings.connect(`changed::${SETTINGS_KEYS.POPUP_MAX_HEIGHT}`, () => {
        this._handlePopupMaxHeight();
      }),
    });
    this.signalsHandlers.push({
      emitter: this.mpvPlayer,
      signalID: this.mpvPlayer.connect('play-state-changed', (sender: Player, isPaused: boolean) => {
        this._activeRadioPopupItem.setIcon(Gio.icon_new_for_string(isPaused ? ICONS.POPUP_PAUSE : ICONS.POPUP_STOP));
        this._updateIndicatorIcon({ playing: isPaused ? 'paused' : 'playing' });
      }),
    });
    this.signalsHandlers.push({
      emitter: this.mpvPlayer,
      signalID: this.mpvPlayer.connect('playback-stopped', () => {
        if (this._isUpdatingCurrentRadio) {
          this._isUpdatingCurrentRadio = false;
          this._createMenu();
          return;
        }
        this._updateIndicatorIcon({ playing: 'default' });
        this._activeRadioPopupItem.setIcon(Gio.icon_new_for_string(ICONS.POPUP_PLAY));
        this._extension._settings.set_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING, '');
        this._activeRadioPopupItem.set_style('font-weight: normal');
        this._activeRadioPopupItem = null;
      }),
    });
  }

  private _updateIndicatorIcon({ playing }: { playing: 'playing' | 'default' | 'paused' }): void {
    const extPath = this._extension.path;
    const icon = `INDICATOR_${playing.toUpperCase()}` as keyof typeof ICONS;
    const iconPath = `${extPath}/${ICONS[icon]}`;
    const gicon = Gio.icon_new_for_string(iconPath);
    this._icon.set_gicon(gicon);
    writeLog({ message: `[Indicator] Updated icon to: ${playing}`, type: 'INFO' });
  }

  private async _togglePlayingStatus(
    child: PopupMenu.PopupImageMenuItem,
    radioID: string,
    mouseButton: number,
  ): Promise<void> {
    const isRightClickOnActiveRadio = child === this._activeRadioPopupItem && mouseButton === 3;
    const isLeftClickOnActiveRadio = child === this._activeRadioPopupItem && mouseButton === 1;
    const currentRadio = this._radios.find((radio) => radio.id === radioID);

    writeLog({
      message: `[Indicator] Toggle playing status - Radio: ${radioID}, Button: ${mouseButton}`,
      type: 'INFO',
    });

    if (isRightClickOnActiveRadio) {
      writeLog({ message: '[Indicator] Right click on active radio - stopping playback', type: 'INFO' });
      this.mpvPlayer.stopPlayer(currentRadio);
      return;
    }
    if (isLeftClickOnActiveRadio) {
      writeLog({ message: '[Indicator] Left click on active radio - toggling play/pause', type: 'INFO' });
      this.mpvPlayer.playPause();
      return;
    }
    if (this._activeRadioPopupItem) {
      this._activeRadioPopupItem.setIcon(Gio.icon_new_for_string(ICONS.POPUP_PLAY));
      this._activeRadioPopupItem.set_style('font-weight: normal');
      this._updateIndicatorIcon({ playing: 'default' });
    }
    writeLog({ message: `[Indicator] Starting new radio: ${currentRadio?.radioName}`, type: 'INFO' });
    await this.mpvPlayer.startPlayer(currentRadio);
    this._updateIndicatorIcon({ playing: 'playing' });
    child.setIcon(Gio.icon_new_for_string(ICONS.POPUP_STOP));
    child.set_style('font-weight: bold');
    this._extension._settings.set_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING, radioID);
    this._activeRadioPopupItem = child;
  }

  private _handleButtonClick(): void {
    this.connect('button-press-event', (_, event) => {
      const mouseBtn = event.get_button() - 1;
      const actions = this._extension._settings.get_strv(SETTINGS_KEYS.INDICATOR_ACTIONS);
      const action = actions[mouseBtn] as IndicatorActionKey;
      writeLog({ message: `[Indicator] Button ${mouseBtn} clicked, action: ${action}`, type: 'INFO' });
      this._indicatorActions.actions.get(action)();
    });
  }

  public _createMenu(): void {
    writeLog({ message: '[Indicator] Creating menu', type: 'INFO' });
    this._activeRadioPopupItem = null;
    this.menuSignals.forEach(({ emitter, signalID }) => {
      try {
        emitter.disconnect(signalID);
      } catch (e) {}
    });
    this.menuSignals = [];
    // @ts-expect-error nothing
    this.menu.box.destroy_all_children();
    this._radios = [];
    this._createRadios();
    this._createMenuItems();
    writeLog({ message: '[Indicator] Menu created successfully', type: 'INFO' });
  }

  private _createVolumeSlider(popup: PopupMenu.PopupMenuBase): void {
    writeLog({ message: '[Indicator] Creating volume slider', type: 'INFO' });
    const separator = new PopupMenu.PopupSeparatorMenuItem();
    const volumeLevel = this._extension._settings.get_int(SETTINGS_KEYS.VOLUME);
    const volumePopupItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
    const volumeBoxLayout = new St.BoxLayout({ vertical: true, x_expand: true });
    const volumeSlider = new Slider.Slider(volumeLevel / 100);
    const volumeLabel = new St.Label({ text: `Volume: ${Math.floor(volumeSlider.value * 100)}` });
    this.menuSignals.push({
      emitter: volumeSlider,
      signalID: volumeSlider.connect('notify::value', (slider) => {
        const currentVolume = Math.floor(slider.value * 100).toFixed(0);
        volumeLabel.text = `Volume: ${currentVolume}`;
        this._extension._settings.set_int(SETTINGS_KEYS.VOLUME, Number(currentVolume));
      }),
    });
    this.signalsHandlers.push({
      emitter: this._extension._settings,
      signalID: this._extension._settings.connect(`changed::${SETTINGS_KEYS.VOLUME}`, (settings, key) => {
        const volume = settings.get_int(key);
        volumeLabel.text = `Volume: ${Math.floor(volume)}`;
        volumeSlider.value = volume / 100;
      }),
    });
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
    const isPaused = this.mpvPlayer.getProperty('pause') ?? { data: false };
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
      this.menuSignals.push({
        emitter: menuItem,
        signalID: menuItem.connect('activate', (item, event) => {
          //  NOTE: MOUSE BUTTONS IDS
          // 1 -> LMB
          // 3 -> RMB
          const mouseButton = event.get_button();
          this._togglePlayingStatus(item as PopupMenu.PopupImageMenuItem, radio.id, mouseButton);
        }),
      });
      popupSection.addMenuItem(menuItem);
    });
    this._createVolumeSlider(popupSection);
    // @ts-expect-error nothing
    this.menu.box.add_child(scrollView);
    this._handlePopupMaxHeight();
  }

  public dispose(): void {
    writeLog({ message: '[Indicator] Disposing indicator', type: 'INFO' });
    debug('extension disabled');
    this._extension._settings.set_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING, '');
    this.mpvPlayer.destroy();
    this.signalsHandlers.forEach(({ emitter, signalID }) => {
      emitter.disconnect(signalID);
    });
    this.menuSignals.forEach(({ emitter, signalID }) => {
      try {
        emitter.disconnect(signalID);
      } catch (e) {}
    });
    this.signalsHandlers = [];
    this.menuSignals = [];
    this.destroy();
    writeLog({ message: '[Indicator] Indicator disposed successfully', type: 'INFO' });
  }
}
