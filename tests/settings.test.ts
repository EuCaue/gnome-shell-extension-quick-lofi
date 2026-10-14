import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cookiesFromBrowserValue, formatCookiesFromBrowser, parseCookiesFromBrowser } from '../src/shared/settings.ts';

test('cookies round trip', () => {
  const cookies = { browser: 'Firefox (Flatpak)', value: 'firefox:/home/u/.var/app/x' };
  assert.deepEqual(parseCookiesFromBrowser(formatCookiesFromBrowser(cookies)), cookies);
});

test('cookies value is null when off', () => {
  assert.equal(cookiesFromBrowserValue('None - '), null);
  assert.equal(cookiesFromBrowserValue(''), null);
  assert.equal(cookiesFromBrowserValue('Firefox - '), null);
});

test('cookies value is the yt-dlp part', () => {
  assert.equal(cookiesFromBrowserValue('Firefox - firefox'), 'firefox');
  assert.equal(cookiesFromBrowserValue('Other - chrome:/a - b'), 'chrome:/a - b');
});
