import Gio from 'gi://Gio';

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
  };

  public static debug(...message: any[]): void {
    log('[ QUICK LOFI DEBUG ] >>> ', ...message);
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
