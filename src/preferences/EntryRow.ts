import type Adw from 'gi://Adw';
import GLib from 'gi://GLib';

// Pending timers per row, so a new error removes the old one first and the window
// close removes whatever is left.
const rowTimers = new Map<Adw.EntryRow, { timer: number; originalTitle: string }>();

// Removes pending error timers. Call this when the preferences window closes.
export function clearErrorRowTimers(): void {
  for (const { timer } of rowTimers.values()) GLib.Source.remove(timer);
  rowTimers.clear();
}

// Shows `errorMessage` as the row title in error style for a few seconds.
export function handleErrorRow(row: Adw.EntryRow, errorMessage: string): void {
  const TIMEOUT_SECONDS = 3;
  // Reuse the first saved title: `get_title()` would return the previous error message.
  const originalTitle = rowTimers.get(row)?.originalTitle ?? row.get_title();
  if (originalTitle === errorMessage) return;

  const previous = rowTimers.get(row);
  if (previous) GLib.Source.remove(previous.timer);

  row.add_css_class('error');
  row.set_title(errorMessage);

  const timer = GLib.timeout_add_seconds(GLib.PRIORITY_HIGH, TIMEOUT_SECONDS, () => {
    rowTimers.delete(row);
    row.set_title(originalTitle);
    row.remove_css_class('error');
    return GLib.SOURCE_REMOVE;
  });
  rowTimers.set(row, { timer, originalTitle });
}

// Replaces the row text from code. `set_text` alone counts as an edit: it brings the apply
// button back and moves the caret to the start, even when the text is the same.
export function setEntryRowText(row: Adw.EntryRow, text: string): void {
  if (row.text === text) return;
  row.set_text(text);
  row.set_position(-1);
  if (row.show_apply_button) {
    row.set_show_apply_button(false);
    row.set_show_apply_button(true);
  }
}
