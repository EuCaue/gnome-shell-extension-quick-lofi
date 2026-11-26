import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildPreviewArgv,
  formatPreviewTime,
  parsePreviewStatus,
  previewElapsedSince,
  PREVIEW_SECONDS,
  previewFailed,
} from '../src/preferences/PreviewArgs.ts';

test('preview argv has its own short-lived mpv', () => {
  const argv = buildPreviewArgv('https://youtu.be/abc', null, null, 50);
  assert.equal(argv[0], 'mpv');
  assert.equal(argv.includes('--no-video'), true);
  assert.equal(argv.includes('--loop-playlist=no'), true);
  assert.equal(argv.includes(`--length=${PREVIEW_SECONDS}`), true);
  assert.equal(
    argv.some((arg) => arg.startsWith('--input-ipc-server')),
    false,
  );
  assert.equal(argv.includes('--no-terminal'), false);
  assert.equal(argv.includes('--quiet'), false);
  assert.equal(argv.includes('--term-status-msg=QLOFI T=${=time-pos:} D=${=duration:}\\n'), true);
  assert.equal(argv.at(-1), 'https://youtu.be/abc');
});

test('preview status parser reads real mpv position and duration', () => {
  assert.deepEqual(parsePreviewStatus('\rQLOFI T=4.208 D=214.830\n'), { elapsed: 4.208, duration: 214.83 });
  assert.deepEqual(parsePreviewStatus('QLOFI T=11.937 D=\n'), { elapsed: 11.937, duration: null });
  assert.equal(parsePreviewStatus('AV: 00:00:04 / 00:03:34'), null);
  assert.equal(parsePreviewStatus('QLOFI T=nan D=12'), null);
  assert.equal(parsePreviewStatus('QLOFI D=214.830'), null);
});

test('preview elapsed is measured from preview start for live streams', () => {
  assert.equal(previewElapsedSince(1234.5, 1200), 34.5);
  assert.equal(previewElapsedSince(5, 0), 5);
  assert.equal(previewElapsedSince(10, 20), 0);
});

test('preview time label uses m:ss', () => {
  assert.equal(formatPreviewTime(0), '0:00');
  assert.equal(formatPreviewTime(12.8), '0:12');
  assert.equal(formatPreviewTime(75), '1:15');
});

test('preview argv mirrors browser cookies when configured', () => {
  const argv = buildPreviewArgv('https://youtu.be/abc', 'firefox:default', 'node', 50);
  assert.equal(argv.includes('--ytdl-raw-options-add=cookies-from-browser=firefox:default'), true);
  assert.equal(argv.includes('--ytdl-raw-options-add=js-runtimes=node'), true);
  assert.equal(argv.includes('--ytdl-raw-options-add=remote-components=ejs:github'), true);
  assert.equal(argv.includes('--volume=50'), true);
});

test('preview failure is detected for nonzero exit or signal', () => {
  assert.equal(previewFailed(0, false), false);
  assert.equal(previewFailed(2, false), true);
  assert.equal(previewFailed(0, true), true);
});

test('preview argv falls back to deno and omits cookies when absent', () => {
  const withDeno = buildPreviewArgv('u', 'chrome', 'deno', 100);
  assert.equal(withDeno.includes('--ytdl-raw-options-add=js-runtimes=deno'), true);
  const noCookies = buildPreviewArgv('u', null, 'node', 100);
  assert.equal(
    noCookies.some((arg) => arg.includes('cookies-from-browser')),
    false,
  );
});
