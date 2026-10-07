import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CLICK_ACTIONS_NAMES, SETTINGS_KEYS } from '../src/shared/constants.ts';
import { clickAction } from '../src/shared/settings.ts';

const schema = readFileSync(
  new URL('../schemas/org.gnome.shell.extensions.quick-lofi.gschema.xml', import.meta.url),
  'utf8',
);

function schemaDefault(key: string): string[] {
  const match = schema.match(new RegExp(`<key name="${key}" type="as">\\s*<default>([^<]*)</default>`));
  assert.ok(match, `schema has no "as" key named ${key}`);
  return JSON.parse(match[1].replaceAll("'", '"'));
}

const CLICK_KEYS = [
  SETTINGS_KEYS.INDICATOR_ACTIONS,
  SETTINGS_KEYS.RADIO_ITEM_ACTIONS,
  SETTINGS_KEYS.MINI_PLAYER_PREV_ACTIONS,
  SETTINGS_KEYS.MINI_PLAYER_PLAY_ACTIONS,
  SETTINGS_KEYS.MINI_PLAYER_NEXT_ACTIONS,
];

test('defaults reproduce the current click behavior', () => {
  assert.deepEqual(schemaDefault(SETTINGS_KEYS.INDICATOR_ACTIONS), ['showPopupMenu', 'playPause', 'openPrefs']);
  assert.deepEqual(schemaDefault(SETTINGS_KEYS.RADIO_ITEM_ACTIONS), ['playPause', 'restart', 'stopPlayer']);
  assert.deepEqual(schemaDefault(SETTINGS_KEYS.MINI_PLAYER_PREV_ACTIONS), ['prev', 'none', 'prevRadio']);
  assert.deepEqual(schemaDefault(SETTINGS_KEYS.MINI_PLAYER_PLAY_ACTIONS), ['playPause', 'none', 'stopPlayer']);
  assert.deepEqual(schemaDefault(SETTINGS_KEYS.MINI_PLAYER_NEXT_ACTIONS), ['next', 'none', 'nextRadio']);
});

test('every default names a known action', () => {
  for (const key of CLICK_KEYS) {
    for (const action of schemaDefault(key)) {
      assert.ok(CLICK_ACTIONS_NAMES.has(action as never), `${key} default "${action}" has no label`);
    }
  }
});

test('one list offers every action, including the ones saved by older versions', () => {
  const expected = [
    'none',
    'showPopupMenu',
    'playPause',
    'stopPlayer',
    'restart',
    'prev',
    'prevRadio',
    'next',
    'nextRadio',
    'copyUrl',
    'openPrefs',
  ];
  assert.deepEqual([...CLICK_ACTIONS_NAMES.keys()].sort(), [...expected].sort());
});

// Minimal stand-in for Gio.Settings: only what clickAction reads.
function fakeSettings(saved: Record<string, string[]>, defaults: Record<string, string[]>) {
  return {
    get_strv: (key: string) => saved[key] ?? defaults[key],
    get_default_value: (key: string) => ({ deepUnpack: () => defaults[key] }),
  } as never;
}

const KEY = 'radio-item-actions';
const DEFAULTS = { [KEY]: ['playPause', 'restart', 'stopPlayer'] };

test('clickAction reads the stored action for buttons 1-3', () => {
  const settings = fakeSettings({ [KEY]: ['copyUrl', 'none', 'nextRadio'] }, DEFAULTS);
  assert.equal(clickAction(settings, KEY, 1), 'copyUrl');
  assert.equal(clickAction(settings, KEY, 2), 'none');
  assert.equal(clickAction(settings, KEY, 3), 'nextRadio');
});

test('clickAction falls back to the default for a short stored list', () => {
  const settings = fakeSettings({ [KEY]: ['stopPlayer'] }, DEFAULTS);
  assert.equal(clickAction(settings, KEY, 1), 'stopPlayer');
  assert.equal(clickAction(settings, KEY, 2), 'restart');
  assert.equal(clickAction(settings, KEY, 3), 'stopPlayer');
});

test('clickAction has no action for keyboard or extra buttons', () => {
  const settings = fakeSettings({}, DEFAULTS);
  assert.equal(clickAction(settings, KEY, 0), undefined);
  assert.equal(clickAction(settings, KEY, 4), undefined);
  assert.equal(clickAction(settings, KEY, 8), undefined);
});
