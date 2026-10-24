import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_FADE_DURATION_S, fadeSteps, volumeRamp } from '../src/shared/fade.ts';

test('ramps from start to zero', () => {
  assert.deepEqual(volumeRamp(100, 4), [75, 50, 25, 0]);
});

test('clamps step count to at least one', () => {
  assert.deepEqual(volumeRamp(80, 0), [0]);
});

test('a duration of zero disables the fade', () => {
  assert.equal(fadeSteps(0, 50), 0);
});

test('a negative duration disables the fade', () => {
  assert.equal(fadeSteps(-100, 50), 0);
});

test('counts the steps of a duration', () => {
  assert.equal(fadeSteps(1000, 50), 20);
  assert.equal(fadeSteps(1001, 50), 21);
});

test('the default duration fades for one second', () => {
  assert.equal(fadeSteps(DEFAULT_FADE_DURATION_S * 1000, 50), 20);
});
