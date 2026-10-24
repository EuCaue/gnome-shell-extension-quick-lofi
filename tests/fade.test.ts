import assert from 'node:assert/strict';
import test from 'node:test';
import { volumeRamp } from '../src/shared/fade.ts';

test('ramps from start to zero', () => {
  assert.deepEqual(volumeRamp(100, 4), [75, 50, 25, 0]);
});

test('clamps step count to at least one', () => {
  assert.deepEqual(volumeRamp(80, 0), [0]);
});
