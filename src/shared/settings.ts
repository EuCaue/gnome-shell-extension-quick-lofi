// Only type imports from gi://: tests load this file directly with Node.
import type Gio from 'gi://Gio';

const COOKIES_SEPARATOR = ' - ';

let _settings: Gio.Settings | null = null;

// Seeded in `enable()` and `fillPreferencesWindow()`; a new instance replaces the cached one.
export function getExtSettings(settings?: Gio.Settings): Gio.Settings {
  if (settings) _settings = settings;
  if (!_settings) {
    throw new Error('Extension settings are required on first call');
  }
  return _settings;
}

export function resetExtSettings(): void {
  _settings = null;
}

// The action stored for mouse `button` (1-3) in a click actions key; a short stored list falls back to the default.
// Keyboard activation (0) and extra buttons have none.
export function clickAction(settings: Gio.Settings, key: string, button: number): string | undefined {
  if (button < 1 || button > 3) return undefined;
  const defaults = settings.get_default_value(key)?.deepUnpack() as string[] | undefined;
  return settings.get_strv(key)[button - 1] ?? defaults?.[button - 1];
}

// `cookies-from-browser` is stored as "<menu name> - <yt-dlp value>", e.g. "Firefox - firefox".
export type CookiesFromBrowser = { browser: string; value: string };

export function parseCookiesFromBrowser(raw: string): CookiesFromBrowser {
  const [browser = '', ...rest] = raw.split(COOKIES_SEPARATOR);
  return { browser: browser.trim(), value: rest.join(COOKIES_SEPARATOR).trim() };
}

export function formatCookiesFromBrowser({ browser, value }: CookiesFromBrowser): string {
  return `${browser}${COOKIES_SEPARATOR}${value}`;
}

// The yt-dlp `--cookies-from-browser` value, or null when cookies are off.
export function cookiesFromBrowserValue(raw: string): string | null {
  const { browser, value } = parseCookiesFromBrowser(raw);
  return browser !== 'None' && value ? value : null;
}
