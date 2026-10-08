import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIndicatorStatus, buildPopupStyles, formatTime } from '../src/modules/IndicatorView.ts';

const SHELL_STYLE = 'max-height: 900px;';

test('limits enabled: box and actor carry the max values', () => {
  const styles = buildPopupStyles({ maxWidth: '26em', maxHeight: '13em', width: null, height: null }, SHELL_STYLE);
  assert.match(styles.box, /max-height: 13em;/);
  assert.match(styles.box, /max-width: 26em;/);
  assert.match(styles.actor, /max-width: 26em;/);
  assert.match(styles.actor, /min-width: 0;/);
});

test('limits disabled: values fall back to auto', () => {
  const styles = buildPopupStyles({ maxWidth: null, maxHeight: null, width: null, height: null }, SHELL_STYLE);
  assert.match(styles.box, /max-height: auto;/);
  assert.match(styles.box, /max-width: auto;/);
  assert.match(styles.actor, /max-width: auto;/);
});

test("keeps the shell's work-area max-height on the actor", () => {
  const styles = buildPopupStyles({ maxWidth: '26em', maxHeight: '13em', width: null, height: null }, SHELL_STYLE);
  assert.match(styles.actor, /max-height: 900px;/);
});

test('no shell style yet: actor has no max-height', () => {
  const styles = buildPopupStyles({ maxWidth: '26em', maxHeight: '13em', width: null, height: null }, '');
  assert.doesNotMatch(styles.actor, /max-height/);
});

const LIMITS = { maxWidth: '26em', maxHeight: '13em' };

test('no preset: scroll view has no style, so the popup is content-sized as before', () => {
  const styles = buildPopupStyles({ ...LIMITS, width: null, height: null }, SHELL_STYLE);
  assert.equal(styles.scrollView, '');
});

test('preset width pins the scroll view natural width', () => {
  const styles = buildPopupStyles({ ...LIMITS, width: '20em', height: null }, SHELL_STYLE);
  assert.match(styles.scrollView, /-st-natural-width: 20em;/);
  assert.match(styles.scrollView, /max-width: 20em;/);
  assert.doesNotMatch(styles.scrollView, /height/);
});

test('preset height pins the scroll view natural height', () => {
  const styles = buildPopupStyles({ ...LIMITS, width: null, height: '18em' }, SHELL_STYLE);
  assert.match(styles.scrollView, /-st-natural-height: 18em;/);
  assert.match(styles.scrollView, /max-height: 18em;/);
  assert.doesNotMatch(styles.scrollView, /width/);
});

test('preset never sets a minimum size, so outer limits can always shrink it', () => {
  const styles = buildPopupStyles({ ...LIMITS, width: '40em', height: '40em' }, SHELL_STYLE);
  assert.doesNotMatch(styles.scrollView, /min-/);
  assert.doesNotMatch(styles.scrollView, /(^|[\s;])width:/);
  assert.doesNotMatch(styles.scrollView, /(^|[\s;])height:/);
});

test('limits stay on the outer widgets when a preset is set', () => {
  const styles = buildPopupStyles({ ...LIMITS, width: '40em', height: '40em' }, SHELL_STYLE);
  assert.match(styles.box, /max-width: 26em;/);
  assert.match(styles.box, /max-height: 13em;/);
  assert.match(styles.actor, /max-width: 26em;/);
  assert.match(styles.actor, /max-height: 900px;/);
});

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
