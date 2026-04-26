import { type PopupMenuSection, type PopupBaseMenuItem } from '@girs/gnome-shell/ui/popupMenu';
import * as PopupMenu from '@girs/gnome-shell/ui/popupMenu';
import St from 'gi://St';
import Clutter from '@girs/clutter-17';
import GLib from 'gi://GLib';
import { ICONS, SETTINGS_KEYS } from '@/utils/constants';
import * as Slider from '@girs/gnome-shell/ui/slider';
import { debug } from '@/utils/debug';
import Player from './Player';
import Gio from '@girs/gio-2.0';
import { getExtSettings } from '@/utils/helpers';

//  TODO: when restoring, doesn't came with the values
//  TODO: text for the currentTime is undefined, not setting in any case
//  TODO: radioName not setting either
export default class MiniPlayer {
  private static _instance: MiniPlayer | null = null;

  public currentRadio!: St.Label;
  public currentTime!: St.Label;
  public endTime!: St.Label;
  public playIcon!: St.Icon;
  public timeTrackingSlider!: Slider.Slider;
  public shouldStop = false;
  public mpvPlayer: Player;

  private _miniPlayerItem: PopupBaseMenuItem | null = null;
  private _currentTimeTimeoutId: number | null = null;
  private _endTimeTimeoutId: number | null = null;
  private _settings: Gio.Settings;

  public static getInstance(): MiniPlayer {
    if (!MiniPlayer._instance) {
      MiniPlayer._instance = new MiniPlayer();
    }

    return MiniPlayer._instance;
  }

  private constructor() {
    this.mpvPlayer = Player.getInstance();
    this._settings = getExtSettings();
  }

  public createMiniPlayer(popup: PopupMenuSection) {
    if (this._miniPlayerItem) {
      return;
    }

    this.shouldStop = false;

    this._miniPlayerItem = new PopupMenu.PopupBaseMenuItem({
      activate: true,
      hover: true,
      can_focus: true,
      reactive: true,
    });

    this._miniPlayerItem.style = 'padding-left: 0px; padding-right: 0px; background-color: transparent;';

    const miniPlayerBoxLayout = new St.BoxLayout({
      vertical: true,
      x_expand: true,
    });

    const currentRadioPlayingID = this._settings.get_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING);
    const [currentRadioName]: string[] = this._settings
      .get_strv(SETTINGS_KEYS.RADIOS_LIST)
      .find((radio) => radio.endsWith(currentRadioPlayingID))
      .split(' - ');
    this.currentRadio = new St.Label({
      text: currentRadioName,
      xAlign: Clutter.ActorAlign.CENTER,
      style: 'font-weight: bold; margin-bottom: 10px',
    });

    const timeTrackingBox = new St.BoxLayout({
      vertical: false,
      x_expand: false,
    });

    this.timeTrackingSlider = new Slider.Slider(0.5);
    this.timeTrackingSlider.x_expand = true;
    this.timeTrackingSlider.style = 'margin-left: 4px; margin-right: 4px;';

    const trackingTimeStyles = 'font-size: 0.9em;';

    this.currentTime = new St.Label({
      text: '00:00',
      style: trackingTimeStyles,
    });

    this.endTime = new St.Label({
      text: '00:00',
      style: trackingTimeStyles,
    });

    timeTrackingBox.add_child(this.currentTime);
    timeTrackingBox.add_child(this.timeTrackingSlider);
    timeTrackingBox.add_child(this.endTime);

    const controlsBox = new St.BoxLayout({
      vertical: false,
      marginBottom: 10,
      xAlign: Clutter.ActorAlign.CENTER,
      x_expand: true,
      style: 'margin-bottom: 20px;',
    });

    const controlsStyle = 'color: inherit; background: transparent; padding: 4px;';
    const iconSize = 24;

    const prev = new St.Button({ x_expand: false });
    const prevIcon = new St.Icon({
      iconName: ICONS.MINI_PLAYER_SKIP_BACKWARD,
      iconSize,
      style: controlsStyle,
    });

    prev.set_child(prevIcon);
    prev.connect('clicked', () => {
      debug('clicked: prev');
    });

    const pause = new St.Button({
      x_expand: false,
      reactive: true,
    });

    const isPaused = this.mpvPlayer.getProperty('pause')?.data ?? { data: false };
    this.playIcon = new St.Icon({
      iconName: isPaused ? ICONS.POPUP_PAUSE : ICONS.POPUP_STOP,
      iconSize,
      style: controlsStyle,
    });

    pause.set_child(this.playIcon);

    pause.connect('button-press-event', (_, event) => {
      const btnClicked = event.get_button();
      const LMB = 1;
      const RMB = 3;

      if (btnClicked === LMB) {
        this.mpvPlayer.playPause();
        return Clutter.EVENT_STOP;
      }

      if (btnClicked === RMB) {
        this.mpvPlayer.stopPlayer();
        return Clutter.EVENT_STOP;
      }

      return Clutter.EVENT_PROPAGATE;
    });

    const next = new St.Button({ x_expand: false });
    const nextIcon = new St.Icon({
      iconName: ICONS.MINI_PLAYER_SKIP_FORWARD,
      iconSize,
      style: controlsStyle,
    });

    next.set_child(nextIcon);
    next.connect('clicked', () => {
      debug('clicked: next');
    });

    controlsBox.add_child(prev);
    controlsBox.add_child(pause);
    controlsBox.add_child(next);

    miniPlayerBoxLayout.add_child(this.currentRadio);
    miniPlayerBoxLayout.add_child(controlsBox);
    miniPlayerBoxLayout.add_child(timeTrackingBox);

    this._miniPlayerItem.add_child(miniPlayerBoxLayout);

    //  TODO: make await before adding into the UI
    this.getCurrentTime();
    this.getEndTime();

    popup.addMenuItem(this._miniPlayerItem, popup.length - 1);
  }

  private _parseTime(time: string | number | undefined): string {
    const parsed = parseInt(String(time));

    if (isNaN(parsed)) return '00:00';

    const hours = Math.floor(parsed / 3600);
    const minutes = String(Math.ceil((parsed % 3600) / 60)).padStart(2, '0');
    const seconds = String(Math.floor(parsed % 60)).padStart(2, '0');

    return `${hours > 0 ? `${hours}:` : ''}${minutes}:${seconds}`;
  }

  //  TODO: clear and set again on pause
  public getCurrentTime() {
    if (this._currentTimeTimeoutId) {
      GLib.source_remove(this._currentTimeTimeoutId);
      this._currentTimeTimeoutId = null;
    }

    this._currentTimeTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
      if (this.shouldStop || !this._miniPlayerItem) {
        this._currentTimeTimeoutId = null;
        return GLib.SOURCE_REMOVE;
      }

      const time = this.mpvPlayer.getProperty<number>('playback-time')?.data;
      if (!time) {
        return GLib.SOURCE_CONTINUE;
      }
      debug('TIME', time);
      const currentTime = this._parseTime(time);
      debug('CURRENTTIME', currentTime);

      if (currentTime === this.endTime.get_text()) {
        debug('HERE', this.endTime.get_text());
        this.currentTime.set_text('');
        this._currentTimeTimeoutId = null;
        return GLib.SOURCE_REMOVE;
      }

      this.currentTime.set_text(currentTime);
      return GLib.SOURCE_CONTINUE;
    });
  }

  private _isLiveStream() {
    const seekable = this.mpvPlayer.getProperty<boolean>('seekable')?.data;
    debug('SEEKABLE1', seekable);

    return !seekable;
  }

  public getEndTime() {
    if (this._endTimeTimeoutId) {
      GLib.source_remove(this._endTimeTimeoutId);
      this._endTimeTimeoutId = null;
    }

    this._endTimeTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_HIGH, 1, () => {
      if (this.shouldStop || !this._miniPlayerItem) {
        this._endTimeTimeoutId = null;
        return GLib.SOURCE_REMOVE;
      }

      const duration = this.mpvPlayer.getProperty<number>('duration')?.data;

      if (!duration) {
        return GLib.SOURCE_CONTINUE;
      }

      if (this._isLiveStream()) {
        this.endTime.set_text('LIVE');
        this.timeTrackingSlider.set_reactive(false);
        this.timeTrackingSlider.value = 1;
        this._endTimeTimeoutId = null;
        return GLib.SOURCE_REMOVE;
      }

      const endTime = this._parseTime(duration);
      this.endTime.set_text(endTime);

      this._endTimeTimeoutId = null;
      return GLib.SOURCE_REMOVE;
    });
  }

  public dispose() {
    this.shouldStop = true;

    if (this._currentTimeTimeoutId) {
      GLib.source_remove(this._currentTimeTimeoutId);
      this._currentTimeTimeoutId = null;
    }

    if (this._endTimeTimeoutId) {
      GLib.source_remove(this._endTimeTimeoutId);
      this._endTimeTimeoutId = null;
    }

    if (this._miniPlayerItem) {
      this._miniPlayerItem.destroy();
      this._miniPlayerItem = null;
    }
  }
}
