import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldHandleScroll, stepVolume } from '../src/shared/volume.ts';

test('steps volume and clamps to the range', () => {
  assert.equal(stepVolume(50, 5, 1), 55);
  assert.equal(stepVolume(50, 5, -1), 45);
  assert.equal(stepVolume(100, 5, 1), 100);
  assert.equal(stepVolume(0, 5, -1), 0);
});

test('throttles scroll events', () => {
  assert.equal(shouldHandleScroll(1000, 0, 150), true);
  assert.equal(shouldHandleScroll(1100, 1000, 150), false);
  assert.equal(shouldHandleScroll(1150, 1000, 150), true);
});
