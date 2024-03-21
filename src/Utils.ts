import { Extension } from '@girs/gnome-shell/extensions/extension';
import Gio from 'gi://Gio';

export default class Utils {
  public static readonly UUID = 'quick-lofi@eucaue';

  public static getExtension(): Extension {
    return Extension.lookupByUUID(this.UUID);
  }

  public static getSettings(): Gio.Settings {
    return this.getExtension().getSettings();
  }

  public static debug(...message: any[]): void {
    console.log('[ QUICK LOFI DEBUG ] >>> ', ...message);
  }
}
