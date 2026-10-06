import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIndicatorStatus, formatTime } from '../src/modules/IndicatorStatus.ts';

test('formatTime pads minutes and seconds, shows hours only when needed', () => {
  assert.equal(formatTime(5), '00:05');
  assert.equal(formatTime(3725), '1:02:05');
  assert.equal(formatTime(undefined), '00:00');
});

test('status shows name, state and start:end', () => {
  assert.equal(
    buildIndicatorStatus({ radioName: 'Lofi', paused: false, position: 65, duration: 200 }),
    'Lofi - Playing - 01:05 / 03:20',
  );
  assert.equal(buildIndicatorStatus({ radioName: 'Lofi', paused: true, position: 65, duration: 200 }), 'Lofi - Paused - 01:05 / 03:20');
});

test('live stream shows only the elapsed time', () => {
  assert.equal(buildIndicatorStatus({ radioName: 'Lofi', paused: false, position: 65, duration: 0 }), 'Lofi - Playing - 01:05');
});

test('nothing playing', () => {
  assert.equal(buildIndicatorStatus({ radioName: null, paused: false, position: 0, duration: 0 }), 'Stopped');
});
