import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import GLib from 'gi://GLib';

export default class Utils {
  public static readonly ICONS = {
    INDICATOR_DEFAULT: '/icons/icon-symbolic.svg',
    INDICATOR_PAUSED: '/icons/icon-paused-symbolic.svg',
    INDICATOR_PLAYING: '/icons/icon-playing-symbolic.svg',
    POPUP_PLAY: 'media-playback-start-symbolic',
    POPUP_STOP: 'media-playback-stop-symbolic',
    POPUP_PAUSE: 'media-playback-pause-symbolic',
  };

  //  TODO: refactor to put all keys here

  public static readonly SHORTCUTS = {
    PLAY_PAUSE_SHORTCUT: 'play-pause-quick-lofi',
    STOP_SHORTCUT: 'stop-quick-lofi',
  };

  public static readonly SETTINGS_KEYS = {
    ...this.SHORTCUTS,
    RADIOS_LIST: 'radios',
  };

  public static debug(...message: any[]): void {
    log('[ QUICK LOFI DEBUG ] >>> ', ...message);
  }
  //  TODO: find a better place to put this
  public static handleErrorRow(row: Adw.EntryRow, errorMessage: string): void {
    const TIMEOUT_SECONDS = 3 as const;
    const currentRadioRowTitle = row.get_title();
    row.add_css_class('error');
    row.set_title(errorMessage);
    GLib.timeout_add_seconds(GLib.PRIORITY_HIGH, TIMEOUT_SECONDS, () => {
      row.set_title(currentRadioRowTitle);
      row.remove_css_class('error');
      return GLib.SOURCE_REMOVE;
    });
  }

  public static isCurrentRadioPlaying(settings: Gio.Settings, radioID: string): boolean {
    const currentRadioPlaying = settings.get_string('current-radio-playing');
    return currentRadioPlaying.length > 0 && radioID === currentRadioPlaying;
  }

  public static generateNanoIdWithSymbols(size: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    const charactersLength = characters.length;
    let result = '';

    for (let i = 0; i < size; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }
}
