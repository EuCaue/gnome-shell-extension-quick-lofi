import assert from 'node:assert/strict';
import { test } from 'node:test';

// GJS has no global URL, so the module must work without it.
delete (globalThis as { URL?: unknown }).URL;
const { fallbackRadioName, parseMpvProbe, pickRadioName, sanitizeRadioName } = await import(
  '../src/utils/radioName.ts'
);

test('parseMpvProbe reads the playing message', () => {
  const out = 'AO: [null] 44100Hz\nQLNAME\x1fHunter.FM - O Canal Lo-Fi\x1flofi_high\nExiting...\n';
  assert.deepEqual(parseMpvProbe(out), { icyName: 'Hunter.FM - O Canal Lo-Fi', mediaTitle: 'lofi_high' });
});

test('parseMpvProbe returns null when mpv never played', () => {
  assert.equal(parseMpvProbe('Failed to recognize file format.\n'), null);
});

test('fallback uses the file name without extension', () => {
  assert.equal(fallbackRadioName('~/Music/rain sounds.mp3'), 'rain sounds');
  assert.equal(fallbackRadioName('/usr/share/sounds/freedesktop/stereo/bell.oga'), 'bell');
});

test('fallback uses the last URL path segment, then the host', () => {
  assert.equal(fallbackRadioName('https://live.hunter.fm/lofi_high'), 'lofi_high');
  assert.equal(fallbackRadioName('https://example.com/'), 'example.com');
  assert.equal(fallbackRadioName('https://example.com/a/b%20c?x=1'), 'b c');
});

test('sanitize protects the " - " storage separator and trims', () => {
  assert.equal(sanitizeRadioName('  Hunter.FM - O Canal Lo-Fi '), 'Hunter.FM – O Canal Lo-Fi');
  assert.equal(sanitizeRadioName('a  \n b'), 'a b');
});

test('icy-name wins for streams', () => {
  assert.equal(
    pickRadioName({
      source: 'https://live.hunter.fm/lofi_high',
      icyName: 'Hunter.FM - O Canal Lo-Fi',
      mediaTitle: 'lofi_high',
    }),
    'Hunter.FM – O Canal Lo-Fi',
  );
});

test('yt-dlp title is used when there is no icy-name', () => {
  assert.equal(
    pickRadioName({ source: 'https://www.youtube.com/playlist?list=PL1', ytTitle: '💕Lofi Hip Hop💕' }),
    '💕Lofi Hip Hop💕',
  );
});

test('yt-dlp title equal to the URL tail is ignored', () => {
  assert.equal(pickRadioName({ source: 'https://live.hunter.fm/lofi_high', ytTitle: 'lofi_high' }), 'lofi_high');
});

test('local file: tag title wins, bare file name falls back without extension', () => {
  assert.equal(pickRadioName({ source: '/m/rain.ogg', mediaTitle: 'Rain on a Tin Roof' }), 'Rain on a Tin Roof');
  assert.equal(pickRadioName({ source: '/m/rain.ogg', mediaTitle: 'rain.ogg' }), 'rain');
});

test('media-title of a URL is not used as a name (it is the URL tail or a song)', () => {
  assert.equal(pickRadioName({ source: 'https://x.com/stream', mediaTitle: 'Some Song - Artist' }), 'stream');
});

test('result is always at least 2 characters', () => {
  assert.equal(pickRadioName({ source: 'https://x.io/a' }), 'x.io');
  assert.equal(pickRadioName({ source: 'https://x.io/', icyName: ' ' }), 'x.io');
  assert.equal(pickRadioName({ source: '/m/a.mp3' }), 'Radio');
});

test('sanitize leaves no " - " behind, even overlapping or trailing', () => {
  for (const raw of ['a - - b', 'Chill - - Radio', 'Lofi -', 'Lofi\t-', ' - Lofi']) {
    const stored = `${sanitizeRadioName(raw)} - http://u - ID`;
    assert.equal(stored.split(' - ').length, 3, `${JSON.stringify(raw)} -> ${JSON.stringify(stored)}`);
  }
});
