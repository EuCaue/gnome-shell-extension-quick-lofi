import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  INDICATOR_ACTIONS_NAMES,
  MINI_PLAYER_ACTIONS_NAMES,
  RADIO_ITEM_ACTIONS_NAMES,
  SETTINGS_KEYS,
} from '../src/shared/constants.ts';

const schema = readFileSync(
  new URL('../schemas/org.gnome.shell.extensions.quick-lofi.gschema.xml', import.meta.url),
  'utf8',
);

function schemaDefault(key: string): string[] {
  const match = schema.match(new RegExp(`<key name="${key}" type="as">\\s*<default>([^<]*)</default>`));
  assert.ok(match, `schema has no "as" key named ${key}`);
  return JSON.parse(match[1].replaceAll("'", '"'));
}

test('defaults reproduce the current click behavior', () => {
  assert.deepEqual(schemaDefault(SETTINGS_KEYS.INDICATOR_ACTIONS), ['showPopupMenu', 'playPause', 'openPrefs']);
  assert.deepEqual(schemaDefault(SETTINGS_KEYS.RADIO_ITEM_ACTIONS), ['playPause', 'restart', 'stopPlayer']);
  assert.deepEqual(schemaDefault(SETTINGS_KEYS.MINI_PLAYER_PREV_ACTIONS), ['prev', 'none', 'prevRadio']);
  assert.deepEqual(schemaDefault(SETTINGS_KEYS.MINI_PLAYER_PLAY_ACTIONS), ['playPause', 'none', 'stopPlayer']);
  assert.deepEqual(schemaDefault(SETTINGS_KEYS.MINI_PLAYER_NEXT_ACTIONS), ['next', 'none', 'nextRadio']);
});

test('every default names a known action', () => {
  const cases: Array<[string, ReadonlyMap<string, string>]> = [
    [SETTINGS_KEYS.INDICATOR_ACTIONS, INDICATOR_ACTIONS_NAMES],
    [SETTINGS_KEYS.RADIO_ITEM_ACTIONS, RADIO_ITEM_ACTIONS_NAMES],
    [SETTINGS_KEYS.MINI_PLAYER_PREV_ACTIONS, MINI_PLAYER_ACTIONS_NAMES],
    [SETTINGS_KEYS.MINI_PLAYER_PLAY_ACTIONS, MINI_PLAYER_ACTIONS_NAMES],
    [SETTINGS_KEYS.MINI_PLAYER_NEXT_ACTIONS, MINI_PLAYER_ACTIONS_NAMES],
  ];
  for (const [key, names] of cases) {
    for (const action of schemaDefault(key)) {
      assert.ok(names.has(action), `${key} default "${action}" has no label`);
    }
  }
});

test('keeps every existing indicator action, so saved settings still resolve', () => {
  for (const action of ['showPopupMenu', 'playPause', 'openPrefs', 'stopPlayer']) {
    assert.ok(INDICATOR_ACTIONS_NAMES.has(action as never), action);
  }
});

test('indicator offers the playback navigation actions', () => {
  for (const action of ['next', 'nextRadio', 'prev', 'prevRadio']) {
    assert.ok(INDICATOR_ACTIONS_NAMES.has(action as never), action);
  }
});
