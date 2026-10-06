import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createRadio,
  findRadioById,
  formatRadio,
  migrateRadios,
  neighborRadio,
  parseRadio,
  parseRadios,
  sanitizeRadioName,
} from '../src/shared/radios.ts';

const radios = parseRadios(['A - http://a - id1', 'B - http://b - id2', 'C - http://c - id3']);

test('parse reads name, url and id', () => {
  assert.deepEqual(parseRadio('Lofi - https://x.fm/live - abc'), {
    radioName: 'Lofi',
    radioUrl: 'https://x.fm/live',
    id: 'abc',
  });
});

test('a source containing " - " survives a round trip', () => {
  const radio = { radioName: 'Rain', radioUrl: '~/Music/A - B.mp3', id: 'xyz' };
  assert.deepEqual(parseRadio(formatRadio(radio)), radio);
});

test('format escapes the separator in the name', () => {
  for (const name of ['a - - b', 'Chill - - Radio', 'Lofi -', 'Lofi\t-', ' - Lofi', 'Hunter.FM - O Canal']) {
    const radio = parseRadio(formatRadio({ radioName: name, radioUrl: 'http://u', id: 'ID' }));
    assert.equal(radio.radioUrl, 'http://u', JSON.stringify(name));
    assert.equal(radio.id, 'ID', JSON.stringify(name));
  }
});

test('sanitize trims, collapses spaces and swaps " - " for " – "', () => {
  assert.equal(sanitizeRadioName('  Hunter.FM - O Canal Lo-Fi '), 'Hunter.FM – O Canal Lo-Fi');
  assert.equal(sanitizeRadioName('a  \n b'), 'a b');
});

test('create sanitizes the name, trims the url and adds an id', () => {
  const radio = createRadio(' Hunter.FM - Lofi ', ' http://x ');
  assert.equal(radio.radioName, 'Hunter.FM – Lofi');
  assert.equal(radio.radioUrl, 'http://x');
  assert.equal(radio.id.length, 10);
  assert.doesNotMatch(radio.id, /\s/);
});

test('migrate adds an id to old "name - url" entries only', () => {
  const [old, current, junk] = migrateRadios(['Old - http://o', 'New - http://n - id9', 'junk']);
  const migrated = parseRadio(old);
  assert.equal(migrated.radioName, 'Old');
  assert.equal(migrated.radioUrl, 'http://o');
  assert.equal(migrated.id.length, 10);
  assert.equal(current, 'New - http://n - id9');
  assert.equal(junk, 'junk');
});

test('findById matches the whole id, never an empty one', () => {
  assert.equal(findRadioById(radios, 'id2')?.radioName, 'B');
  assert.equal(findRadioById(radios, '2'), undefined);
  assert.equal(findRadioById(radios, ''), undefined);
});

test('neighbor wraps around both ways', () => {
  assert.equal(neighborRadio(radios, 'id3', 1)?.id, 'id1');
  assert.equal(neighborRadio(radios, 'id1', -1)?.id, 'id3');
  assert.equal(neighborRadio(radios, 'id1', 1)?.id, 'id2');
});

test('neighbor is undefined when nothing is playing', () => {
  assert.equal(neighborRadio(radios, '', 1), undefined);
  assert.equal(neighborRadio([], 'id1', 1), undefined);
});
