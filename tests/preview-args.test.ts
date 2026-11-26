import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPreviewArgv, PREVIEW_SECONDS } from '../src/preferences/PreviewArgs.ts';

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
  assert.equal(argv.at(-1), 'https://youtu.be/abc');
});

test('preview argv mirrors browser cookies when configured', () => {
  const argv = buildPreviewArgv('https://youtu.be/abc', 'firefox:default', 'node', 50);
  assert.equal(argv.includes('--ytdl-raw-options-add=cookies-from-browser=firefox:default'), true);
  assert.equal(argv.includes('--ytdl-raw-options-add=js-runtimes=node'), true);
  assert.equal(argv.includes('--ytdl-raw-options-add=remote-components=ejs:github'), true);
  assert.equal(argv.includes('--volume=50'), true);
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
