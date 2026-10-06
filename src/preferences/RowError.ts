import type Adw from 'gi://Adw';
import GLib from 'gi://GLib';

// Shows `errorMessage` as the row title in error style for a few seconds.
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
