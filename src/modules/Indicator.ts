import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import St from 'gi://St';
import * as Main from '@girs/gnome-shell/ui/main';
import * as PanelMenu from '@girs/gnome-shell/ui/panelMenu';
import * as PopupMenu from '@girs/gnome-shell/ui/popupMenu';
import * as Slider from '@girs/gnome-shell/ui/slider';
import { ICONS, SETTINGS_KEYS } from '@/shared/constants';
import { debug, writeLog } from '@/shared/log';
import { findRadioById, parseRadios } from '@/shared/radios';
import { clickAction } from '@/shared/settings';
import type { QuickLofiExtension, Radio } from '@/types';
import { ClickActions } from './ClickActions';
import { buildIndicatorStatus } from './IndicatorStatus';
import MiniPLayer from './MiniPlayer';
import { MprisController } from './Mpris';
import Player from './Player';
import { buildPopupStyles } from './PopupStyle';
import { radioItemStep } from './RadioItemClick';
import { createTooltip } from './Tooltip';

export default class Indicator extends PanelMenu.Button {
  static {
    GObject.registerClass(Indicator);
  }
  private _clickActions: ClickActions;
  private _activeRadioPopupItem: PopupMenu.PopupImageMenuItem | null = null;
  private _radios?: Array<Radio>;
  private _icon: St.Icon;
  private _extension: QuickLofiExtension;
  private _isUpdatingCurrentRadio: boolean = false;
  private mpvPlayer: Player;
  private _miniPlayer: MiniPLayer;
  public signalsHandlers: Array<{ emitter: any; signalID: number }> = [];
  public menuSignals: Array<{ emitter: any; signalID: number }> = [];
  private _volumeFocusId: number;
  private _popupSection: PopupMenu.PopupMenuSection;
  private _scrollView: St.ScrollView;
  private _statusLabel: St.Label;
  private _playback = { paused: false, position: 0, duration: 0 };

  constructor(ext: QuickLofiExtension) {
    super(0.0, 'Quick Lofi');
    writeLog({ message: '[Indicator] Initializing indicator', type: 'INFO' });
    this._extension = ext;
    this.mpvPlayer = Player.getInstance();
    this._miniPlayer = MiniPLayer.getInstance();
    this._icon = new St.Icon({
      gicon: Gio.icon_new_for_string(this._extension.path + ICONS.INDICATOR_DEFAULT),
      iconSize: 20,
      styleClass: 'system-status-icon indicator-icon',
    });
    this.add_child(this._icon);
    const statusTooltip = createTooltip(this, {
      placement: 'below',
      maxWidth: 320,
      // the menu opens right below the icon, where the tooltip would cover it
      // @ts-expect-error nothing
      shouldShow: () => !this.menu.isOpen,
    });
    this._statusLabel = statusTooltip.label;
    this._clickActions = new ClickActions(this.menu, this._extension);
    this._createMenu();
    this._bindSettingsChangeEvents();
    // runs after PanelMenu.Button's own handler, which resets `menu.actor.style`
    // @ts-expect-error nothing
    this.menu.connect('open-state-changed', (_menu, open: boolean) => {
      this._handlePopupSize();
      if (open) statusTooltip.hide();
    });
    this._handleButtonClick();
    writeLog({ message: '[Indicator] Indicator initialized successfully', type: 'INFO' });
  }

  private _createRadios(): void {
    const radios: string[] = this._extension._settings.get_strv(SETTINGS_KEYS.RADIOS_LIST);
    writeLog({ message: `[Indicator] Creating radios from ${radios.length} entries`, type: 'INFO' });

    this._radios = parseRadios(radios);
    writeLog({ message: `[Indicator] Created ${this._radios.length} radio objects`, type: 'INFO' });
  }

  private _handlePopupSize(): void {
    const settings = this._extension._settings;
    const valueIf = (enabledKey: string, valueKey: string): string | null =>
      settings.get_boolean(enabledKey) ? settings.get_string(valueKey) : null;

    const styles = buildPopupStyles(
      {
        maxWidth: valueIf(SETTINGS_KEYS.SET_POPUP_MAX_WIDTH, SETTINGS_KEYS.POPUP_MAX_WIDTH),
        maxHeight: valueIf(SETTINGS_KEYS.SET_POPUP_MAX_HEIGHT, SETTINGS_KEYS.POPUP_MAX_HEIGHT),
        width: valueIf(SETTINGS_KEYS.SET_POPUP_WIDTH, SETTINGS_KEYS.POPUP_WIDTH),
        height: valueIf(SETTINGS_KEYS.SET_POPUP_HEIGHT, SETTINGS_KEYS.POPUP_HEIGHT),
      },
      // @ts-expect-error nothing
      this.menu.actor.style ?? '',
    );
    // one write per widget: `style` is a single property, so two assignments would drop the first
    // @ts-expect-error nothing
    this.menu.box.style = styles.box;
    // @ts-expect-error nothing
    this.menu.actor.style = styles.actor;
    this._scrollView.style = styles.scrollView || null;
  }

  private _bindSettingsChangeEvents(): void {
    this.signalsHandlers.push({
      emitter: this._extension._settings,
      signalID: this._extension._settings.connect(`changed::${SETTINGS_KEYS.MPV_ARGUMENTS}`, () => {
        if (this.mpvPlayer.isPlaying()) {
          Main.notify('QUICK LOFI', 'Settings updated. Restart the radio to apply the new playback arguments.');
        }
      }),
    });
    this.signalsHandlers.push({
      emitter: this._extension._settings,
      signalID: this._extension._settings.connect(`changed::${SETTINGS_KEYS.ENABLE_MPRIS}`, () => {
        const mpris = MprisController.getInstance(this.mpvPlayer);
        const enabled = this._extension._settings.get_boolean(SETTINGS_KEYS.ENABLE_MPRIS);
        if (enabled) {
          mpris.enable();
        } else {
          mpris.disable();
        }
      }),
    });
    this.signalsHandlers.push({
      emitter: this._extension._settings,
      signalID: this._extension._settings.connect('changed', (_: any, key: string): void => {
        if (key === SETTINGS_KEYS.RADIOS_LIST) {
          if (this.mpvPlayer.isPlaying()) {
            const currentRadioPlayingID = this._extension._settings.get_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING);
            const currentRadioPlaying: Radio | undefined = findRadioById(this._radios, currentRadioPlayingID);
            const updatedRadio: Radio | undefined = findRadioById(
              parseRadios(this._extension._settings.get_strv(SETTINGS_KEYS.RADIOS_LIST)),
              currentRadioPlayingID,
            );
            if (currentRadioPlaying && updatedRadio && currentRadioPlaying.radioUrl !== updatedRadio.radioUrl) {
              // Restart on the new source; a paused radio resumes, since the new source starts playing.
              this._isUpdatingCurrentRadio = true;
              this.mpvPlayer.startPlayer(updatedRadio);
              this._updateIndicatorIcon({ playing: 'playing' });
              this._activeRadioPopupItem?.setIcon(Gio.icon_new_for_string(ICONS.POPUP_STOP));
              this._activeRadioPopupItem?.set_style('font-weight: bold');
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
        //  NOTE: stop player if current radio was removed
        if (
          this.mpvPlayer.isPlaying() &&
          this._extension._settings.get_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING).length <= 0
        ) {
          this.mpvPlayer.stopPlayer();
          return;
        }
      }),
    });
    for (const key of [
      SETTINGS_KEYS.SET_POPUP_MAX_HEIGHT,
      SETTINGS_KEYS.POPUP_MAX_HEIGHT,
      SETTINGS_KEYS.SET_POPUP_MAX_WIDTH,
      SETTINGS_KEYS.POPUP_MAX_WIDTH,
      SETTINGS_KEYS.SET_POPUP_WIDTH,
      SETTINGS_KEYS.POPUP_WIDTH,
      SETTINGS_KEYS.SET_POPUP_HEIGHT,
      SETTINGS_KEYS.POPUP_HEIGHT,
    ]) {
      this.signalsHandlers.push({
        emitter: this._extension._settings,
        signalID: this._extension._settings.connect(`changed::${key}`, () => this._handlePopupSize()),
      });
    }
    this.signalsHandlers.push({
      emitter: this.mpvPlayer,
      signalID: this.mpvPlayer.connect('playback-started', (_sender: Player, radioID: string) => {
        const pos = this._radios.findIndex((radio) => radio.id === radioID);
        const child = this._popupSection._getMenuItems()[pos] as PopupMenu.PopupImageMenuItem;
        this._updateIndicatorIcon({ playing: 'playing' });
        child.setIcon(Gio.icon_new_for_string(ICONS.POPUP_STOP));
        child.set_style('font-weight: bold');
        this._extension._settings.set_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING, radioID);
        this._activeRadioPopupItem = child;
        this._miniPlayer.createMiniPlayer(this._popupSection, this._clickActions);
        this._playback = { paused: false, position: 0, duration: 0 };
        this._updateStatus();
      }),
    });
    this.signalsHandlers.push({
      emitter: this.mpvPlayer,
      signalID: this.mpvPlayer.connect('play-state-changed', (_sender: Player, isPaused: boolean) => {
        this._activeRadioPopupItem.setIcon(Gio.icon_new_for_string(isPaused ? ICONS.POPUP_PAUSE : ICONS.POPUP_STOP));
        this._updateIndicatorIcon({ playing: isPaused ? 'paused' : 'playing' });
        this._playback.paused = isPaused;
        this._updateStatus();
      }),
    });
    this.signalsHandlers.push({
      emitter: this.mpvPlayer,
      signalID: this.mpvPlayer.connect('position-changed', (_sender: Player, position: number) => {
        this._playback.position = position;
        this._updateStatus();
      }),
    });
    this.signalsHandlers.push({
      emitter: this.mpvPlayer,
      signalID: this.mpvPlayer.connect('duration-changed', (_sender: Player, duration: number) => {
        this._playback.duration = duration;
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
        this._miniPlayer.dispose();
        this._extension._settings.set_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING, '');
        this._activeRadioPopupItem.set_style('font-weight: normal');
        this._activeRadioPopupItem = null;
        this._updateStatus();
      }),
    });
    this.signalsHandlers.push({
      emitter: this._extension._settings,
      signalID: this._extension._settings.connect(`changed::${SETTINGS_KEYS.ENABLE_MINI_PLAYER}`, () => {
        // check if a radio is playing
        const enabled = this._extension._settings.get_boolean(SETTINGS_KEYS.ENABLE_MINI_PLAYER);
        if (enabled && this.mpvPlayer.isPlaying()) {
          this._miniPlayer.createMiniPlayer(this._popupSection, this._clickActions);
        } else {
          this._miniPlayer.dispose();
        }
      }),
    });
  }

  private _updateStatus(): void {
    const radioID = this._extension._settings.get_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING);
    const radioName = this.mpvPlayer.isPlaying() ? (findRadioById(this._radios, radioID)?.radioName ?? null) : null;
    this._statusLabel.set_text(buildIndicatorStatus({ radioName, ...this._playback }));
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
    const currentRadio = this._radios.find((radio) => radio.id === radioID);
    const step = radioItemStep({
      action: clickAction(this._extension._settings, SETTINGS_KEYS.RADIO_ITEM_ACTIONS, mouseButton),
      isActive: child === this._activeRadioPopupItem,
    });

    writeLog({
      message: `[Indicator] Toggle playing status - Radio: ${radioID}, Button: ${mouseButton}, Step: ${step}`,
      type: 'INFO',
    });

    if (step !== 'start') {
      this._clickActions.run(step, { radio: currentRadio });
      return;
    }
    if (this._activeRadioPopupItem) {
      this._activeRadioPopupItem.setIcon(Gio.icon_new_for_string(ICONS.POPUP_PLAY));
      this._activeRadioPopupItem.set_style('font-weight: normal');
      this._updateIndicatorIcon({ playing: 'default' });
    }
    writeLog({ message: `[Indicator] Starting new radio: ${currentRadio?.radioName}`, type: 'INFO' });
    await this.mpvPlayer.startPlayer(currentRadio);
  }

  private _handleButtonClick(): void {
    this.connect('captured-event', (_, event) => {
      if (event.type() !== Clutter.EventType.BUTTON_PRESS) {
        return Clutter.EVENT_PROPAGATE;
      }
      const mouseBtn = event.get_button();
      const action = clickAction(this._extension._settings, SETTINGS_KEYS.INDICATOR_ACTIONS, mouseBtn);
      writeLog({ message: `[Indicator] Button ${mouseBtn} clicked, action: ${action}`, type: 'INFO' });
      if (action) this._clickActions.run(action);
      return Clutter.EVENT_STOP;
    });
  }

  public _createMenu(): void {
    writeLog({ message: '[Indicator] Creating menu', type: 'INFO' });
    this._activeRadioPopupItem = null;
    this.menuSignals.forEach(({ emitter, signalID }) => {
      try {
        emitter.disconnect(signalID);
      } catch (_e) {}
    });
    this.menuSignals = [];
    this._miniPlayer.dispose();
    // @ts-expect-error nothing
    this.menu.box.destroy_all_children();
    this._radios = [];
    this._createRadios();
    this._createMenuItems();
    this._updateStatus();
    writeLog({ message: '[Indicator] Menu created successfully', type: 'INFO' });
  }

  private _createVolumeSlider(popup: PopupMenu.PopupMenuBase): void {
    writeLog({ message: '[Indicator] Creating volume slider', type: 'INFO' });
    const separator = new PopupMenu.PopupSeparatorMenuItem();
    const volumeLevel = this._extension._settings.get_int(SETTINGS_KEYS.VOLUME);
    const volumePopupItem = new PopupMenu.PopupBaseMenuItem({ reactive: true, can_focus: true });
    const volumeBoxLayout = new St.BoxLayout({ vertical: true, x_expand: true });
    const volumeSlider = new Slider.Slider(volumeLevel / 100);
    volumeSlider.add_style_class_name('volume-slider');
    volumeSlider.can_focus = true;
    volumeSlider.accessible_name = 'Volume';

    this.menuSignals.push({
      emitter: volumePopupItem,
      signalID: volumePopupItem.connect('key-focus-in', () => {
        this._volumeFocusId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
          volumeSlider.grab_key_focus();
          return GLib.SOURCE_REMOVE;
        });
      }),
    });
    this.menuSignals.push({
      emitter: volumeSlider,
      signalID: volumeSlider.connect('key-focus-in', () => {
        volumePopupItem.add_style_pseudo_class('selected');
      }),
    });
    this.menuSignals.push({
      emitter: volumeSlider,
      signalID: volumeSlider.connect('key-focus-out', () => {
        volumePopupItem.remove_style_pseudo_class('selected');
      }),
    });
    this.menuSignals.push({
      emitter: volumeSlider,
      signalID: volumeSlider.connect('key-press-event', (_actor, event) => {
        const symbol = event.get_key_symbol();

        if (symbol === Clutter.KEY_Up) {
          (this.menu.actor as St.Widget).navigate_focus(volumeSlider, St.DirectionType.UP, false);
          return Clutter.EVENT_STOP;
        }

        if (symbol === Clutter.KEY_Down) {
          (this.menu.actor as St.Widget).navigate_focus(volumeSlider, St.DirectionType.DOWN, false);
          return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
      }),
    });

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
    this._scrollView = new St.ScrollView();
    this._popupSection = new PopupMenu.PopupMenuSection();
    this._scrollView.add_child(this._popupSection.actor);
    const isPaused = this.mpvPlayer.getProperty('pause') ?? { data: false };
    const currentRadioPlayingID: string = this._extension._settings.get_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING);
    this._radios.forEach((radio) => {
      const isRadioPlaying: boolean = currentRadioPlayingID !== '' && currentRadioPlayingID === radio.id;
      const menuItem = new PopupMenu.PopupImageMenuItem(
        radio.radioName,
        Gio.icon_new_for_string(
          isRadioPlaying && isPaused.data ? ICONS.POPUP_PAUSE : isRadioPlaying ? ICONS.POPUP_STOP : ICONS.POPUP_PLAY,
        ),
      );
      // without ellipsizing, the label's minimum width is the full radio name, and a
      // minimum width is never capped by `max-width`
      menuItem.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
      if (isRadioPlaying) {
        menuItem.set_style('font-weight: bold');
        this._activeRadioPopupItem = menuItem;
      }
      this.menuSignals.push({
        emitter: menuItem,
        signalID: menuItem.connect('activate', (item, event) => {
          // the menu closes from an AFTER 'activate' handler; stopping here keeps it open (openPrefs closes it)
          // @ts-expect-error nothing
          GObject.signal_stop_emission_by_name(item, 'activate');
          //  NOTE: MOUSE BUTTONS IDS
          // 1 -> LMB
          // 3 -> RMB
          const mouseButton = event.get_button();
          this._togglePlayingStatus(item as PopupMenu.PopupImageMenuItem, radio.id, mouseButton);
        }),
      });
      this._popupSection.addMenuItem(menuItem);
    });
    this._createVolumeSlider(this._popupSection);
    if (this._extension._settings.get_boolean(SETTINGS_KEYS.ENABLE_MINI_PLAYER) && this.mpvPlayer.isPlaying()) {
      this._miniPlayer.createMiniPlayer(this._popupSection, this._clickActions);
    }
    // @ts-expect-error nothing
    this.menu.box.add_child(this._scrollView);
    this._handlePopupSize();
  }

  public dispose(): void {
    writeLog({ message: '[Indicator] Disposing indicator', type: 'INFO' });
    debug('extension disabled');
    this._extension._settings.set_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING, '');
    this.mpvPlayer.destroy();
    this._miniPlayer.dispose();
    if (this._volumeFocusId) {
      GLib.source_remove(this._volumeFocusId);
      this._volumeFocusId = null;
    }
    this.signalsHandlers.forEach(({ emitter, signalID }) => {
      emitter.disconnect(signalID);
    });
    this.menuSignals.forEach(({ emitter, signalID }) => {
      try {
        emitter.disconnect(signalID);
      } catch (_e) {}
    });
    this.signalsHandlers = [];
    this.menuSignals = [];
    this.destroy();
    writeLog({ message: '[Indicator] Indicator disposed successfully', type: 'INFO' });
  }
}
