import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import St from 'gi://St';
import type Gio from '@girs/gio-2.0';
import type { PopupBaseMenuItem, PopupMenuSection } from '@girs/gnome-shell/ui/popupMenu';
import * as PopupMenu from '@girs/gnome-shell/ui/popupMenu';
import * as Slider from '@girs/gnome-shell/ui/slider';
import { ICONS, SETTINGS_KEYS } from '@/shared/constants';
import { writeLog } from '@/shared/log';
import { findRadioById, parseRadios } from '@/shared/radios';
import { clickAction, getExtSettings } from '@/shared/settings';
import type { Radio } from '@/types';
import type { ClickActions } from './ClickActions';
import { formatTime } from './IndicatorView';
import Player from './Player';
import { createTooltip } from './Tooltip';

export default class MiniPlayer {
  private static _instance: MiniPlayer | null = null;

  public currentRadio!: St.Label;
  public currentPlaylistItem!: St.Label;
  private _playlistItemTooltip!: St.Label;
  public currentTime!: St.Label;
  public endTime!: St.Label;
  public playIcon!: St.Icon;
  public timeTrackingSlider!: Slider.Slider;
  public mpvPlayer: Player;

  private _miniPlayerItem: PopupBaseMenuItem | null = null;
  private _settings: Gio.Settings;
  private _clickActions: ClickActions | null = null;

  private _duration = 0;
  private _isSeekable = false;

  private _positionSignalId: number | null = null;
  private _durationSignalId: number | null = null;
  private _seekableSignalId: number | null = null;
  private _playStateSignalId: number | null = null;
  private _playbackStoppedSignalId: number | null = null;
  private _radioChangedSignalId: number | null = null;
  private _mediaTitleChangedSignalId: number | null = null;

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

  public createMiniPlayer(popup: PopupMenuSection, clickActions: ClickActions) {
    if (this._miniPlayerItem) {
      return;
    }
    this._clickActions = clickActions;

    const MINI_PLAYER_ITEM_STYLE = 'padding-left: 0px; padding-right: 0px; background-color: transparent;';
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

    const radioBox = new St.BoxLayout({
      vertical: true,
      x_align: Clutter.ActorAlign.CENTER,
      x_expand: true,
      style: 'margin-bottom: 6px;',
    });

    this.currentRadio = new St.Label({
      text: this._getCurrentRadioName(),
      x_align: Clutter.ActorAlign.CENTER,
      style: 'font-weight: bold;',
    });

    this.currentPlaylistItem = new St.Label({
      text: '',
      x_align: Clutter.ActorAlign.CENTER,
      x_expand: true,
      style: 'font-size: 0.75em; opacity: 0.7; max-width: 200px;',
      hover: true,
      reactive: true,
      visible: false,
    });
    this.currentPlaylistItem.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    this.currentPlaylistItem.clutter_text.line_wrap = false;

    this._playlistItemTooltip = createTooltip(this.currentPlaylistItem).label;

    this._settings.connect(`changed::${SETTINGS_KEYS.SHOW_MINI_PLAYER_TITLE}`, () => {
      this._updateTitleVisibility();
    });

    this._settings.connect(`changed::${SETTINGS_KEYS.ENABLE_MINI_PLAYER}`, () => {
      this._updateTitleVisibility();
    });

    radioBox.add_child(this.currentRadio);
    radioBox.add_child(this.currentPlaylistItem);

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
      marginBottom: 5,
      xAlign: Clutter.ActorAlign.CENTER,
      x_expand: true,
      style: 'margin-bottom: 5px;',
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
      this._runControlAction(SETTINGS_KEYS.MINI_PLAYER_PREV_ACTIONS, event.get_button());
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

    pause.connect('button-press-event', (_, event) =>
      this._runControlAction(SETTINGS_KEYS.MINI_PLAYER_PLAY_ACTIONS, event.get_button())
        ? Clutter.EVENT_STOP
        : Clutter.EVENT_PROPAGATE,
    );

    const next = new St.Button({ x_expand: false, reactive: true });
    const nextIcon = new St.Icon({
      iconName: ICONS.MINI_PLAYER_SKIP_FORWARD,
      iconSize,
      style: controlsStyle,
    });

    next.set_child(nextIcon);
    next.connect('button-press-event', (_, event) => {
      this._runControlAction(SETTINGS_KEYS.MINI_PLAYER_NEXT_ACTIONS, event.get_button());
    });

    controlsBox.add_child(prev);
    controlsBox.add_child(pause);
    controlsBox.add_child(next);

    miniPlayerBoxLayout.add_child(radioBox);
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

  // Runs the action stored for `button` in a mini player button's settings key.
  private _runControlAction(settingsKey: string, button: number): boolean {
    const action = clickAction(this._settings, settingsKey, button);
    return action ? (this._clickActions?.run(action) ?? false) : false;
  }

  private _connectPlayerSignals(): void {
    this._positionSignalId = this.mpvPlayer.connect('position-changed', (_player, position: number) => {
      if (!this._miniPlayerItem) return;

      this.currentTime.set_text(formatTime(position));

      if (this._duration > 0 && this._isSeekable) {
        this.timeTrackingSlider.value = position / this._duration;
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

      this.endTime.set_text(formatTime(duration));
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
      this._updateTitleVisibility();
    });

    // playback-started carries (id, name, url).
    this._radioChangedSignalId = this.mpvPlayer.connect(
      'playback-started',
      (_player, _radioID: string, radioName: string) => {
        if (!this._miniPlayerItem) return;

        this.currentRadio.set_text(radioName);
        this._updateTitleVisibility();
      },
    );
    this._mediaTitleChangedSignalId = this.mpvPlayer.connect('media-title-changed', () => {
      this._updateTitleVisibility();
    });
    // The menu rebuilds the mini player mid-playback (e.g. after a radio rename), and
    // media-title-changed won't fire again until the next track, so show the current one now.
    this._updateTitleVisibility();
  }

  private _updateTitleVisibility(): void {
    if (!this._miniPlayerItem) return;

    const showTitle = this._settings.get_boolean(SETTINGS_KEYS.SHOW_MINI_PLAYER_TITLE);
    const isMiniPlayerEnabled = this._settings.get_boolean(SETTINGS_KEYS.ENABLE_MINI_PLAYER);
    const mediaTitle = this.mpvPlayer.getProperty<string>('media-title')?.data;

    if (showTitle && isMiniPlayerEnabled && mediaTitle && mediaTitle !== this.currentRadio.get_text()) {
      this.currentPlaylistItem.set_text(mediaTitle);
      this._playlistItemTooltip.set_text(mediaTitle);
      this.currentPlaylistItem.show();
    } else {
      this.currentPlaylistItem.hide();
    }
  }

  private _getCurrentRadioName(): string {
    const currentRadioPlayingID = this._settings.get_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING);

    const radios: Radio[] = parseRadios(this._settings.get_strv(SETTINGS_KEYS.RADIOS_LIST));
    return findRadioById(radios, currentRadioPlayingID)?.radioName || 'Quick Lofi';
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

    if (this._mediaTitleChangedSignalId !== null) {
      this.mpvPlayer.disconnect(this._mediaTitleChangedSignalId);
      this._mediaTitleChangedSignalId = null;
    }
  }

  public dispose() {
    writeLog({ message: '[MiniPlayer] Disposing mini player', type: 'INFO' });

    this._disconnectPlayerSignals();

    if (this._miniPlayerItem) {
      this._miniPlayerItem.destroy();
      this._miniPlayerItem = null;
    }
    MiniPlayer._instance = null;
  }
}
