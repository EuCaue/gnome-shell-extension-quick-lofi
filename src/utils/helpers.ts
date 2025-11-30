import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import { SETTINGS_KEYS } from '@utils/constants';

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
