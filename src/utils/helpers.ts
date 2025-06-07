import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import GLib from 'gi://GLib';

export function handleErrorRow(row: Adw.EntryRow, errorMessage: string): void {
  const TIMEOUT_SECONDS = 3;
  const originalTitle = row.get_title();

  row.add_css_class('error');
  row.set_title(errorMessage);

  GLib.timeout_add_seconds(GLib.PRIORITY_HIGH, TIMEOUT_SECONDS, () => {
    row.set_title(originalTitle);
    row.remove_css_class('error');
    return GLib.SOURCE_REMOVE;
  });
}

export function isCurrentRadioPlaying(settings: Gio.Settings, radioID: string): boolean {
  const current = settings.get_string('current-radio-playing');
  return current.length > 0 && current === radioID;
}

export function generateNanoIdWithSymbols(size: number): string {
  const chars: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  return Array.from({ length: size }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}
