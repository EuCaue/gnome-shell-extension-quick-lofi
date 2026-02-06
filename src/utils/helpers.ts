import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import { SETTINGS_KEYS } from '@utils/constants';

Gio._promisify(Gio.File.prototype, 'append_to_async');
Gio._promisify(Gio.OutputStream.prototype, 'write_bytes_async');

export function handleErrorRow(row: Adw.EntryRow, errorMessage: string): void {
  const TIMEOUT_SECONDS = 3;
  const originalTitle = row.get_title();
  if (originalTitle === errorMessage) return;

  row.add_css_class('error');
  row.set_title(errorMessage);

  GLib.timeout_add_seconds(GLib.PRIORITY_HIGH, TIMEOUT_SECONDS, () => {
    row.set_title(originalTitle);
    row.remove_css_class('error');
    return GLib.SOURCE_REMOVE;
  });
}

export function isCurrentRadioPlaying(settings: Gio.Settings, radioID: string): boolean {
  const current = settings.get_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING);
  return current.length > 0 && current === radioID;
}

export function generateNanoIdWithSymbols(size: number): string {
  const chars: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  return Array.from({ length: size }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

export function isUri(uri: string): boolean {
  const scheme = GLib.uri_parse_scheme(uri);
  if (scheme) {
    return true;
  }
  return false;
}

let _settings: Gio.Settings | null = null;
export function getExtSettings(settings?: Gio.Settings): Gio.Settings {
  if (_settings) return _settings;
  if (!settings) {
    throw new Error('Extension instance is required on first call');
  }
  _settings = settings;
  return _settings;
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
    }
  } catch (e) {
    console.error('Error while writing log:  ', e, message, type);
  }
}

export type TypeOf =
  | 'string'
  | 'number'
  | 'boolean'
  | 'undefined'
  | 'object'
  | 'function'
  | 'symbol'
  | 'bigint'
  | 'error';
export function inspectItem(item: object): Record<string, TypeOf> {
  const inspected: Record<string, TypeOf> = {};
  for (const prop in item) {
    try {
      const type: TypeOf = typeof item[prop];
      inspected[prop] = type;
    } catch (e) {
      inspected[prop] = 'error';
    }
  }
  return inspected;
}
