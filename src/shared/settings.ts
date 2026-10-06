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
