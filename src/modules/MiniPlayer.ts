import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import type Gio from '@girs/gio-2.0';
import type { PopupBaseMenuItem, PopupMenuSection } from '@girs/gnome-shell/ui/popupMenu';
import * as PopupMenu from '@girs/gnome-shell/ui/popupMenu';
import * as Slider from '@girs/gnome-shell/ui/slider';
import { ICONS, MOUSE_BUTTONS, SETTINGS_KEYS } from '@/utils/constants';
import { debug } from '@/utils/debug';
import { getExtSettings, writeLog } from '@/utils/helpers';
import Player from './Player';

export default class MiniPlayer {
  private static _instance: MiniPlayer | null = null;

  public currentRadio!: St.Label;
  public currentTime!: St.Label;
  public endTime!: St.Label;
  public playIcon!: St.Icon;
  public timeTrackingSlider!: Slider.Slider;
  private _shouldStop = false;
  public mpvPlayer: Player;

  private _miniPlayerItem: PopupBaseMenuItem | null = null;
  private _settings: Gio.Settings;

  private _duration = 0;
  private _isSeekable = false;
  private _isUpdatingSlider = false;

  private _positionSignalId: number | null = null;
  private _durationSignalId: number | null = null;
  private _seekableSignalId: number | null = null;
  private _playStateSignalId: number | null = null;
  private _playbackStoppedSignalId: number | null = null;
  private _radioChangedSignalId: number | null = null;

  public static getInstance(): MiniPlayer {
    if (!MiniPlayer._instance) {
      MiniPlayer._instance = new MiniPlayer();
    }

    return MiniPlayer._instance;
  }

  private constructor() {
    this.mpvPlayer = Player.getInstance();
    this._settings = getExtSettings();
    writeLog({ message: '[MiniPlayer] Initialized', type: 'INFO' });
  }

  public createMiniPlayer(popup: PopupMenuSection) {
    if (this._miniPlayerItem) {
      return;
    }

    this._shouldStop = false;

    const MINI_PLAYER_ITEM_STYLE = 'padding-left: 0px; padding-right: 0px; background-color: transparent;';
    const CURRENT_RADIO_STYLE = 'font-weight: bold; margin-bottom: 10px;';
    const TIME_BOX_BASE_STYLE = 'padding: 8px; border-radius: 10px;';
    const TIME_BOX_FOCUSED_STYLE = `${TIME_BOX_BASE_STYLE} background-color: rgba(255, 255, 255, 0.1);`;
    const TIME_SLIDER_MARGIN = 'margin-left: 4px; margin-right: 4px;';
    const TRACKING_TIME_STYLE = 'font-size: 0.9em;';

    this._miniPlayerItem = new PopupMenu.PopupBaseMenuItem({
      activate: true,
      hover: true,
      can_focus: true,
      reactive: true,
    });

    this._miniPlayerItem.style = MINI_PLAYER_ITEM_STYLE;

    const miniPlayerBoxLayout = new St.BoxLayout({
      vertical: true,
      x_expand: true,
    });

    //  TODO: in playlist mode, show the current playing item name
    this.currentRadio = new St.Label({
      text: this._getCurrentRadioName(),
      xAlign: Clutter.ActorAlign.CENTER,
      style: CURRENT_RADIO_STYLE,
    });

    const timeTrackingBoxWrapper = new St.BoxLayout({
      x_expand: true,
    });
    timeTrackingBoxWrapper.add_style_class_name('time-slider-row');

    const timeTrackingBox = new St.BoxLayout({
      vertical: false,
      x_expand: true,
    });

    this.timeTrackingSlider = new Slider.Slider(0);
    this.timeTrackingSlider.add_style_class_name('time-slider');
    this.timeTrackingSlider.x_expand = true;
    this.timeTrackingSlider.style = TIME_SLIDER_MARGIN;
    this.timeTrackingSlider.set_reactive(false);
    this.timeTrackingSlider.can_focus = true;
    this.timeTrackingSlider.accessible_name = 'Time Tracking';

    this._miniPlayerItem.connect('key-focus-in', () => {
      timeTrackingBoxWrapper.style = TIME_BOX_BASE_STYLE;
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        if (this.timeTrackingSlider.get_reactive()) {
          timeTrackingBoxWrapper.style = TIME_BOX_FOCUSED_STYLE;
          this.timeTrackingSlider.grab_key_focus();
        }
        return GLib.SOURCE_REMOVE;
      });
    });
    this._miniPlayerItem.connect('key-focus-out', () => {
      timeTrackingBoxWrapper.style = TIME_BOX_BASE_STYLE;
    });
    this.timeTrackingSlider.connect('key-focus-in', () => {
      timeTrackingBoxWrapper.style = TIME_BOX_FOCUSED_STYLE;
    });
    this.timeTrackingSlider.connect('key-focus-out', () => {
      timeTrackingBoxWrapper.style = TIME_BOX_BASE_STYLE;
    });

    this.timeTrackingSlider.connect('key-press-event', (_actor, event) => {
      if (!this._isSeekable || this._duration <= 0) {
        return Clutter.EVENT_PROPAGATE;
      }

      const symbol = event.get_key_symbol();
      // NOTE: 5 seconds for arrows, 30 seconds for PageUp/Down
      let step = 5;
      if (symbol === Clutter.KEY_Page_Up || symbol === Clutter.KEY_Page_Down) {
        step = 30;
      }

      const delta = step / this._duration;

      if (symbol === Clutter.KEY_Left || symbol === Clutter.KEY_Page_Down) {
        this.timeTrackingSlider.value = Math.max(0, this.timeTrackingSlider.value - delta);
        this.mpvPlayer.seekTo(this.timeTrackingSlider.value * this._duration);
        return Clutter.EVENT_STOP;
      } else if (symbol === Clutter.KEY_Right || symbol === Clutter.KEY_Page_Up) {
        this.timeTrackingSlider.value = Math.min(1, this.timeTrackingSlider.value + delta);
        this.mpvPlayer.seekTo(this.timeTrackingSlider.value * this._duration);
        return Clutter.EVENT_STOP;
      }
      return Clutter.EVENT_PROPAGATE;
    });

    this.currentTime = new St.Label({ text: '00:00', style: TRACKING_TIME_STYLE });
    this.endTime = new St.Label({ text: '00:00', style: TRACKING_TIME_STYLE });

    timeTrackingBox.add_child(this.currentTime);
    timeTrackingBox.add_child(this.timeTrackingSlider);
    timeTrackingBox.add_child(this.endTime);
    timeTrackingBoxWrapper.add_child(timeTrackingBox);

    const controlsBox = new St.BoxLayout({
      vertical: false,
      marginBottom: 10,
      xAlign: Clutter.ActorAlign.CENTER,
      x_expand: true,
      style: 'margin-bottom: 20px;',
    });

    const controlsStyle = 'color: inherit; background: transparent; padding: 4px;';
    const iconSize = 24;

    const prev = new St.Button({ x_expand: false, reactive: true });
    const prevIcon = new St.Icon({
      iconName: ICONS.MINI_PLAYER_SKIP_BACKWARD,
      iconSize,
      style: controlsStyle,
    });

    prev.set_child(prevIcon);
    prev.connect('button-press-event', (_, event) => {
      const btnClicked = event.get_button();
      if (MOUSE_BUTTONS.get('LEFT') === btnClicked) {
        this.mpvPlayer.prev();
      }
      if (btnClicked === MOUSE_BUTTONS.get('RIGHT')) {
        this.mpvPlayer.prev('radio');
      }
    });

    const pause = new St.Button({
      x_expand: false,
      reactive: true,
    });

    const isPaused = this.mpvPlayer.getProperty<boolean>('pause')?.data ?? false;

    this.playIcon = new St.Icon({
      iconName: isPaused ? ICONS.POPUP_PAUSE : ICONS.POPUP_STOP,
      iconSize,
      style: controlsStyle,
    });

    pause.set_child(this.playIcon);

    pause.connect('button-press-event', (_, event) => {
      const btnClicked = event.get_button();

      if (btnClicked === MOUSE_BUTTONS.get('LEFT')) {
        this.mpvPlayer.playPause();
        return Clutter.EVENT_STOP;
      }

      if (btnClicked === MOUSE_BUTTONS.get('RIGHT')) {
        this.mpvPlayer.stopPlayer();
        return Clutter.EVENT_STOP;
      }

      return Clutter.EVENT_PROPAGATE;
    });

    const next = new St.Button({ x_expand: false, reactive: true });
    const nextIcon = new St.Icon({
      iconName: ICONS.MINI_PLAYER_SKIP_FORWARD,
      iconSize,
      style: controlsStyle,
    });

    next.set_child(nextIcon);
    next.connect('button-press-event', (_, event) => {
      const btnClicked = event.get_button();
      if (MOUSE_BUTTONS.get('LEFT') === btnClicked) {
        this.mpvPlayer.next();
      }
      if (btnClicked === MOUSE_BUTTONS.get('RIGHT')) {
        this.mpvPlayer.next('radio');
      }
    });

    controlsBox.add_child(prev);
    controlsBox.add_child(pause);
    controlsBox.add_child(next);

    miniPlayerBoxLayout.add_child(this.currentRadio);
    miniPlayerBoxLayout.add_child(controlsBox);
    miniPlayerBoxLayout.add_child(timeTrackingBoxWrapper);

    this._miniPlayerItem.add_child(miniPlayerBoxLayout);

    this._connectPlayerSignals();

    this.timeTrackingSlider.connect('drag-end', () => {
      if (!this._isSeekable || this._duration <= 0) return;

      const position = this.timeTrackingSlider.value * this._duration;
      this.mpvPlayer.seekTo(position);
    });

    popup.addMenuItem(this._miniPlayerItem, popup.numMenuItems - 1);
  }

  private _connectPlayerSignals(): void {
    this._positionSignalId = this.mpvPlayer.connect('position-changed', (_player, position: number) => {
      if (!this._miniPlayerItem) return;

      this.currentTime.set_text(this._parseTime(position));

      if (this._duration > 0 && this._isSeekable) {
        this._isUpdatingSlider = true;
        this.timeTrackingSlider.value = position / this._duration;
        this._isUpdatingSlider = false;
      }
    });

    this._durationSignalId = this.mpvPlayer.connect('duration-changed', (_player, duration: number) => {
      if (!this._miniPlayerItem) return;

      this._duration = duration;

      if (!duration || duration <= 0) {
        this.endTime.set_text('00:00');
        return;
      }

      if (!this._isSeekable) {
        this.endTime.set_text('LIVE');
        this.timeTrackingSlider.value = 1;
        this.timeTrackingSlider.set_reactive(false);
        return;
      }

      this.endTime.set_text(this._parseTime(duration));
      this.timeTrackingSlider.set_reactive(true);
    });

    this._seekableSignalId = this.mpvPlayer.connect('seekable-changed', (_player, seekable: boolean) => {
      if (!this._miniPlayerItem) return;

      this._isSeekable = seekable;

      if (!seekable) {
        this.endTime.set_text('LIVE');
        this.timeTrackingSlider.value = 1;
        this.timeTrackingSlider.set_reactive(false);
        return;
      }

      this.timeTrackingSlider.set_reactive(true);
    });

    this._playStateSignalId = this.mpvPlayer.connect('play-state-changed', (_player, isPaused: boolean) => {
      if (!this._miniPlayerItem) return;

      this.playIcon.iconName = isPaused ? ICONS.POPUP_PAUSE : ICONS.POPUP_STOP;
    });

    this._playbackStoppedSignalId = this.mpvPlayer.connect('playback-stopped', () => {
      if (!this._miniPlayerItem) return;

      this._duration = 0;
      this._isSeekable = false;

      this.currentTime.set_text('00:00');
      this.endTime.set_text('00:00');
      this.timeTrackingSlider.value = 0;
      this.timeTrackingSlider.set_reactive(false);
    });

    this._radioChangedSignalId = this.mpvPlayer.connect('playback-started', (_player, radioName: string) => {
      if (!this._miniPlayerItem) return;

      this.currentRadio.set_text(radioName);
    });
  }

  private _getCurrentRadioName(): string {
    const currentRadioPlayingID = this._settings.get_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING);

    const currentRadio = this._settings
      .get_strv(SETTINGS_KEYS.RADIOS_LIST)
      .find((radio) => radio.endsWith(currentRadioPlayingID));

    if (!currentRadio) return 'Quick Lofi';

    const [currentRadioName] = currentRadio.split(' - ');

    return currentRadioName ?? 'Quick Lofi';
  }

  private _parseTime(time: string | number | undefined): string {
    const parsed = parseInt(String(time), 10);

    if (Number.isNaN(parsed)) return '00:00';

    const hours = Math.floor(parsed / 3600);
    const minutes = String(Math.floor((parsed % 3600) / 60)).padStart(2, '0');
    const seconds = String(Math.floor(parsed % 60)).padStart(2, '0');

    return `${hours > 0 ? `${hours}:` : ''}${minutes}:${seconds}`;
  }

  private _disconnectPlayerSignals(): void {
    if (this._positionSignalId !== null) {
      this.mpvPlayer.disconnect(this._positionSignalId);
      this._positionSignalId = null;
    }

    if (this._durationSignalId !== null) {
      this.mpvPlayer.disconnect(this._durationSignalId);
      this._durationSignalId = null;
    }

    if (this._seekableSignalId !== null) {
      this.mpvPlayer.disconnect(this._seekableSignalId);
      this._seekableSignalId = null;
    }

    if (this._playStateSignalId !== null) {
      this.mpvPlayer.disconnect(this._playStateSignalId);
      this._playStateSignalId = null;
    }

    if (this._playbackStoppedSignalId !== null) {
      this.mpvPlayer.disconnect(this._playbackStoppedSignalId);
      this._playbackStoppedSignalId = null;
    }

    if (this._radioChangedSignalId !== null) {
      this.mpvPlayer.disconnect(this._radioChangedSignalId);
      this._radioChangedSignalId = null;
    }
  }

  public dispose() {
    writeLog({ message: '[MiniPlayer] Disposing mini player', type: 'INFO' });
    this._shouldStop = true;

    this._disconnectPlayerSignals();

    if (this._miniPlayerItem) {
      this._miniPlayerItem.destroy();
      this._miniPlayerItem = null;
    }
  }
}
