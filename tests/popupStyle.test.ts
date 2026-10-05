import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPopupStyles } from '../src/utils/popupStyle.ts';

const SHELL_STYLE = 'max-height: 900px;';

test('limits enabled: box and actor carry the max values', () => {
  const styles = buildPopupStyles({ maxWidth: '26em', maxHeight: '13em' }, SHELL_STYLE);
  assert.match(styles.box, /max-height: 13em;/);
  assert.match(styles.box, /max-width: 26em;/);
  assert.match(styles.actor, /max-width: 26em;/);
  assert.match(styles.actor, /min-width: 0;/);
});

test('limits disabled: values fall back to auto', () => {
  const styles = buildPopupStyles({ maxWidth: null, maxHeight: null }, SHELL_STYLE);
  assert.match(styles.box, /max-height: auto;/);
  assert.match(styles.box, /max-width: auto;/);
  assert.match(styles.actor, /max-width: auto;/);
});

test("keeps the shell's work-area max-height on the actor", () => {
  const styles = buildPopupStyles({ maxWidth: '26em', maxHeight: '13em' }, SHELL_STYLE);
  assert.match(styles.actor, /max-height: 900px;/);
});

test('no shell style yet: actor has no max-height', () => {
  const styles = buildPopupStyles({ maxWidth: '26em', maxHeight: '13em' }, '');
  assert.doesNotMatch(styles.actor, /max-height/);
});
