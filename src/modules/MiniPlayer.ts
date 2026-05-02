import { type PopupMenuSection, type PopupBaseMenuItem } from '@girs/gnome-shell/ui/popupMenu';
import * as PopupMenu from '@girs/gnome-shell/ui/popupMenu';
import St from 'gi://St';
import Clutter from '@girs/clutter-17';
import { ICONS, SETTINGS_KEYS } from '@/utils/constants';
import * as Slider from '@girs/gnome-shell/ui/slider';
import { debug } from '@/utils/debug';
import Player from './Player';
import Gio from '@girs/gio-2.0';
import { getExtSettings, parseRadios } from '@/utils/helpers';
import { Radio } from '@/types';

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
  }

  public createMiniPlayer(popup: PopupMenuSection) {
    if (this._miniPlayerItem) {
      return;
    }

    this._shouldStop = false;

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

    //  TODO: in playlist mode, show the current playing
    this.currentRadio = new St.Label({
      text: this._getCurrentRadioName(),
      xAlign: Clutter.ActorAlign.CENTER,
      style: 'font-weight: bold; margin-bottom: 10px',
    });

    const timeTrackingBox = new St.BoxLayout({
      vertical: false,
      x_expand: false,
    });

    this.timeTrackingSlider = new Slider.Slider(0);
    this.timeTrackingSlider.x_expand = true;
    this.timeTrackingSlider.style = 'margin-left: 4px; margin-right: 4px;';
    this.timeTrackingSlider.set_reactive(false);

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
      const playlistCount = this.mpvPlayer.getProperty<number>('playlist-count')?.data ?? 1;
      if (playlistCount > 1) {
        this.mpvPlayer.playlistPrev();
      } else {
        const prevRadio = this._findPrevRadio();
        this.mpvPlayer.startPlayer(prevRadio);
      }
      debug('clicked: prev');
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
      const playlistCount = this.mpvPlayer.getProperty<number>('playlist-count')?.data ?? 1;
      if (playlistCount > 1) {
        this.mpvPlayer.playlistNext();
      } else {
        const nextRadio = this._findNextRadio();
        this.mpvPlayer.startPlayer(nextRadio);
      }
      debug('clicked: next');
    });

    controlsBox.add_child(prev);
    controlsBox.add_child(pause);
    controlsBox.add_child(next);

    miniPlayerBoxLayout.add_child(this.currentRadio);
    miniPlayerBoxLayout.add_child(controlsBox);
    miniPlayerBoxLayout.add_child(timeTrackingBox);

    this._miniPlayerItem.add_child(miniPlayerBoxLayout);

    this._connectPlayerSignals();

    this.timeTrackingSlider.connect('drag-end', () => {
      if (!this._isSeekable || this._duration <= 0) return;

      const position = this.timeTrackingSlider.value * this._duration;
      this.mpvPlayer.seekTo(position);
    });

    popup.addMenuItem(this._miniPlayerItem, popup.numMenuItems - 1);
  }

  private _findNextRadio(): Radio | undefined {
    return this._findRadio((_radio, index, radios, currentRadioPlayingID) => {
      if (radios[index].id === currentRadioPlayingID) {
        return radios[(index + 1) % radios.length];
      }
      return undefined;
    });
  }

  private _findPrevRadio(): Radio | undefined {
    return this._findRadio((_radio, index, radios, currentRadioPlayingID) => {
      if (radios[index].id === currentRadioPlayingID) {
        return radios[(index - 1 + radios.length) % radios.length];
      }
      return undefined;
    });
  }

  private _findRadio(
    cb: (radio: Radio, index: number, radios: Array<Radio>, currentRadioPlayingID: string) => Radio | undefined,
  ): Radio | undefined {
    const settings = getExtSettings();
    const currentRadioPlayingID = settings.get_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING);
    const radios = parseRadios();
    for (let i = 0; i < radios.length; i++) {
      const radio = radios[i];
      const result = cb(radio, i, radios, currentRadioPlayingID);
      if (result) return result;
    }
    return undefined;
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
    const parsed = parseInt(String(time));

    if (isNaN(parsed)) return '00:00';

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
    this._shouldStop = true;

    this._disconnectPlayerSignals();

    if (this._miniPlayerItem) {
      this._miniPlayerItem.destroy();
      this._miniPlayerItem = null;
    }
  }
}
