import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { SETTINGS_KEYS } from '@/shared/constants';
import { getExtSettings } from '@/shared/settings';

Gio._promisify(Gio.File.prototype, 'append_to_async');
Gio._promisify(Gio.OutputStream.prototype, 'write_bytes_async');

declare const __DEV__: boolean;
export function debug(...message: any[]): void {
  if (__DEV__) {
    log('[ QUICK LOFI DEBUG ] >>> ', ...message);
  }
}

export type Log = {
  message: string;
  type?: 'LOG' | 'ERROR' | 'WARN' | 'INFO';
};
export async function writeLog({ message, type = 'LOG' }: Log) {
  try {
    const settings: Gio.Settings = getExtSettings();
    if (settings.get_boolean(SETTINGS_KEYS.ENABLE_DEBUG)) {
      const filepath: string = GLib.build_filenamev([GLib.get_tmp_dir(), `/quick-lofi-${GLib.get_user_name()}.log`]);
      const file: Gio.File = Gio.File.new_for_path(filepath);
      const outputStream: Gio.OutputStream = await file.append_to_async(
        Gio.FileCreateFlags.NONE,
        GLib.PRIORITY_DEFAULT,
        null,
      );
      const formatedOutput: string = `[${type.toLocaleUpperCase()}] ${GLib.DateTime.new_now_local().format('%b %d %H:%M:%S').toLocaleUpperCase()}: ${message}\n`;
      const bytes: GLib.Bytes = new GLib.Bytes(new TextEncoder().encode(formatedOutput));
      await outputStream.write_bytes_async(bytes, GLib.PRIORITY_DEFAULT, null);
      debug(formatedOutput);
    }
  } catch (e) {
    console.error('Error while writing log:  ', e, message, type);
  }
}
