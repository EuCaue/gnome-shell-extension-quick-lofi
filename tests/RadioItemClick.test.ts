import assert from 'node:assert/strict';
import { test } from 'node:test';
import { radioItemStep } from '../src/modules/RadioItemClick.ts';

const DEFAULTS = ['playPause', 'restart', 'stopPlayer'];
const KEYBOARD = 0;

test('defaults on the playing radio: toggle, restart, stop', () => {
  assert.equal(radioItemStep({ actions: DEFAULTS, button: 1, isActive: true }), 'playPause');
  assert.equal(radioItemStep({ actions: DEFAULTS, button: 2, isActive: true }), 'start');
  assert.equal(radioItemStep({ actions: DEFAULTS, button: 3, isActive: true }), 'stopPlayer');
});

test('keyboard and extra buttons restart the playing radio', () => {
  assert.equal(radioItemStep({ actions: DEFAULTS, button: KEYBOARD, isActive: true }), 'start');
  assert.equal(radioItemStep({ actions: DEFAULTS, button: 8, isActive: true }), 'start');
});

test('any click starts a radio that is not playing', () => {
  for (const button of [KEYBOARD, 1, 2, 3, 8]) {
    assert.equal(radioItemStep({ actions: DEFAULTS, button, isActive: false }), 'start');
  }
});

test('custom order is followed on the playing radio', () => {
  const actions = ['stopPlayer', 'playPause', 'restart'];
  assert.equal(radioItemStep({ actions, button: 1, isActive: true }), 'stopPlayer');
  assert.equal(radioItemStep({ actions, button: 2, isActive: true }), 'playPause');
  assert.equal(radioItemStep({ actions, button: 3, isActive: true }), 'start');
});

test('copyUrl copies without starting, playing or not', () => {
  const actions = ['playPause', 'copyUrl', 'stopPlayer'];
  assert.equal(radioItemStep({ actions, button: 2, isActive: true }), 'copyUrl');
  assert.equal(radioItemStep({ actions, button: 2, isActive: false }), 'copyUrl');
});

test('none does nothing on the playing radio and still starts the others', () => {
  const actions = ['playPause', 'none', 'stopPlayer'];
  assert.equal(radioItemStep({ actions, button: 2, isActive: true }), 'none');
  assert.equal(radioItemStep({ actions, button: 2, isActive: false }), 'start');
});
