import { type PopupMenuSection, type PopupBaseMenuItem } from '@girs/gnome-shell/ui/popupMenu';
import * as PopupMenu from '@girs/gnome-shell/ui/popupMenu';
import St from 'gi://St';
import Clutter from '@girs/clutter-17';
import GLib from 'gi://GLib';
import { ICONS } from '@/utils/constants';
import * as Slider from '@girs/gnome-shell/ui/slider';
import { debug } from '@/utils/debug';
import Player from './Player';

export default class MiniPLayer {
  public currentRadio: St.Label;
  public currentTime: St.Label;
  public endTime: St.Label;
  public playIcon: St.Icon;
  public mpvPlayer: Player;

  private _miniPlayerItem: PopupBaseMenuItem | null = null;

  constructor() {
    this.mpvPlayer = Player.getInstance();
  }

  public createMiniPlayer(popup: PopupMenuSection) {
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

    this.currentRadio = new St.Label({
      text: 'No Radio Playing',
      xAlign: Clutter.ActorAlign.CENTER,
      style: 'font-weight: bold; margin-bottom: 10px',
    });

    const timeTrackingBox = new St.BoxLayout({ vertical: false, x_expand: false });
    //  TODO: make this work with arrow keys
    //  TODO: add this into the class
    const timeTrackingSlider = new Slider.Slider(0.5);
    const trackingTimeStyles = 'font-size: 0.9em;';
    timeTrackingSlider.x_expand = true;
    timeTrackingSlider.style = 'margin-left: 4px; margin-right: 4px;';
    const isLive = true ? 'LIVE' : '10:30'; // get on start player

    this.currentTime = new St.Label({
      text: '2:30',
      style: trackingTimeStyles,
    }); // polling?
    this.endTime = new St.Label({
      text: isLive,
      style: trackingTimeStyles,
    }); // get on start player

    timeTrackingBox.add_child(this.currentTime);
    timeTrackingBox.add_child(timeTrackingSlider);
    timeTrackingBox.add_child(this.endTime);

    const controlsBox = new St.BoxLayout({
      vertical: false,
      marginBottom: 10,
      xAlign: Clutter.ActorAlign.CENTER,
      x_expand: true,
      style: 'margin-bottom: 20px;',
    });
    const controlsStyle: string = 'color: inherit; background: transparent; padding: 4px;';
    const iconSize: number = 24;

    const prev = new St.Button({ x_expand: false });
    const prevIcon = new St.Icon({
      iconName: ICONS.MINI_PLAYER_SKIP_BACKWARD,
      iconSize,
      style: `${controlsStyle}`,
    });
    prev.set_child(prevIcon);
    prev.connect('clicked', () => {
      debug('cliced: prev');
    });

    //  TODO: update this icon correctly when starts a radio
    const pause = new St.Button({ x_expand: false });
    this.playIcon = new St.Icon({
      iconName: ICONS.POPUP_PLAY,
      iconSize,
      style: `${controlsStyle}`,
    });
    pause.set_child(this.playIcon);
    pause.connect('clicked', () => {
      debug('cliced: pause');
      this.mpvPlayer.playPause();
    });

    const next = new St.Button({ x_expand: false });
    const nextIcon = new St.Icon({
      iconName: ICONS.MINI_PLAYER_SKIP_FORWARD,
      iconSize,
      style: `${controlsStyle}`,
    });
    next.set_child(nextIcon);
    next.connect('clicked', () => {
      debug('cliced: next');
    });

    controlsBox.add_child(prev);
    controlsBox.add_child(pause);
    controlsBox.add_child(next);

    miniPlayerBoxLayout.add_child(this.currentRadio);
    miniPlayerBoxLayout.add_child(controlsBox);
    miniPlayerBoxLayout.add_child(timeTrackingBox);

    this._miniPlayerItem.add_child(miniPlayerBoxLayout);

    popup.addMenuItem(this._miniPlayerItem, popup.length - 1);
  }

  private _parseTime(time: string | number): string {
    const parsed = parseInt(String(time));

    if (isNaN(parsed)) return '00:00';

    const hours = Math.floor(parsed / 3600);
    const minutes = String(Math.floor((parsed % 3600) / 60)).padStart(2, '0');
    const seconds = String(Math.floor(parsed % 60)).padStart(2, '0');
    const finalTime = `${hours > 0 ? `${hours}:` : ''}${minutes}:${seconds}`;
    return finalTime;
  }

  public getCurrentTime() {
    debug('getCurrentTime');
    //  TODO: pause when pause/play
    //  TODO: start with seek
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, (_src) => {
      //  TODO: parse in a reasoble format in a format that slider understand
      const time = this.mpvPlayer.getProperty<number>('playback-time')?.data ?? undefined;
      debug('TIME', time);
      const currentTime = this._parseTime(time);
      debug('CURRENTTIME', currentTime);
      if (currentTime === this.endTime.get_text()) {
        debug('final?');
        this.currentTime.set_text('');
        return GLib.SOURCE_REMOVE;
      }
      debug('AFTER');
      this.currentTime.set_text(currentTime);
      return GLib.SOURCE_CONTINUE;
    });
  }

  public getEndTime() {
    debug('getEndTime');
    //  TODO: check if it's a livestream to just return "LIVE" and stop
    GLib.timeout_add_seconds(GLib.PRIORITY_HIGH, 1, (_src) => {
      const duration = this.mpvPlayer.getProperty<number>('duration')?.data ?? undefined;
      if (!duration) return GLib.SOURCE_CONTINUE;
      const endTime = this._parseTime(duration);
      console.log('ENDTIME', endTime);
      this.endTime.set_text(endTime);
      return GLib.SOURCE_REMOVE;
    });
  }
}
