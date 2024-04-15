export default class Utils {
  public static readonly ICONS = {
    INDICATOR_DEFAULT: '/icon-symbolic.svg',
    INDICATOR_PLAYING: '/icon-playing-symbolic.svg',
    POPUP_PLAY: 'media-playback-start-symbolic',
    POPUP_PAUSE: 'media-playback-stop-symbolic',
  };

  public static debug(...message: any[]): void {
    console.log('[ QUICK LOFI DEBUG ] >>> ', ...message);
  }
}
