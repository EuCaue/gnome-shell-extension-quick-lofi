import assert from 'node:assert/strict';
import { test } from 'node:test';
import { radioItemStep } from '../src/modules/RadioItemClick.ts';

test('defaults on the playing radio: toggle, restart, stop', () => {
  assert.equal(radioItemStep({ action: 'playPause', isActive: true }), 'playPause');
  assert.equal(radioItemStep({ action: 'restart', isActive: true }), 'start');
  assert.equal(radioItemStep({ action: 'stopPlayer', isActive: true }), 'stopPlayer');
});

test('keyboard and extra buttons (no action) restart the playing radio', () => {
  assert.equal(radioItemStep({ action: undefined, isActive: true }), 'start');
});

test('playback actions and keyboard start a radio that is not playing', () => {
  for (const action of ['playPause', 'restart', 'stopPlayer', undefined]) {
    assert.equal(radioItemStep({ action, isActive: false }), 'start');
  }
});

test('copyUrl runs on any radio without starting it', () => {
  assert.equal(radioItemStep({ action: 'copyUrl', isActive: true }), 'copyUrl');
  assert.equal(radioItemStep({ action: 'copyUrl', isActive: false }), 'copyUrl');
});

test('none does nothing, playing or not', () => {
  assert.equal(radioItemStep({ action: 'none', isActive: true }), 'none');
  assert.equal(radioItemStep({ action: 'none', isActive: false }), 'none');
});

test('the other actions run as they do anywhere else', () => {
  for (const action of ['next', 'nextRadio', 'prev', 'prevRadio', 'openPrefs', 'showPopupMenu']) {
    assert.equal(radioItemStep({ action, isActive: false }), action);
    assert.equal(radioItemStep({ action, isActive: true }), action);
  }
});
