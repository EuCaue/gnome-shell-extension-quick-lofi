import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeSearchResults, parseYouTubeSearchOutput } from '../src/preferences/YouTubeResults.ts';

test('parses title and url lines', () => {
  const stdout = 'A Title\thttps://www.youtube.com/watch?v=abc\nB Title\thttps://www.youtube.com/watch?v=def\n';
  assert.deepEqual(parseYouTubeSearchOutput(stdout), [
    { title: 'A Title', url: 'https://www.youtube.com/watch?v=abc' },
    { title: 'B Title', url: 'https://www.youtube.com/watch?v=def' },
  ]);
});

test('skips malformed lines', () => {
  const stdout = 'no tab here\n\tmissing title\nGood\thttps://example.com\n';
  assert.deepEqual(parseYouTubeSearchOutput(stdout), [{ title: 'Good', url: 'https://example.com' }]);
});

test('keeps tabs inside the title', () => {
  assert.deepEqual(parseYouTubeSearchOutput('Lofi\tbeats\thttps://youtu.be/x'), [
    { title: 'Lofi\tbeats', url: 'https://youtu.be/x' },
  ]);
});

test('skips lines whose url is not http', () => {
  assert.deepEqual(parseYouTubeSearchOutput('Title\tNA\nOther\tfile:///etc/passwd'), []);
});

test('merges new results after the existing ones', () => {
  const existing = [{ title: 'A', url: 'https://a' }];
  const incoming = [{ title: 'B', url: 'https://b' }];
  assert.deepEqual(mergeSearchResults(existing, incoming), {
    results: [existing[0], incoming[0]],
    added: [incoming[0]],
  });
});

test('drops an incoming result whose url is already listed', () => {
  const existing = [{ title: 'A', url: 'https://a' }];
  const incoming = [
    { title: 'A again', url: 'https://a' },
    { title: 'B', url: 'https://b' },
  ];
  const merged = mergeSearchResults(existing, incoming);
  assert.deepEqual(
    merged.results.map((result) => result.url),
    ['https://a', 'https://b'],
  );
  assert.deepEqual(merged.added, [incoming[1]]);
});

test('adds nothing when every incoming result is known', () => {
  const existing = [{ title: 'A', url: 'https://a' }];
  const merged = mergeSearchResults(existing, [{ title: 'A', url: 'https://a' }]);
  assert.deepEqual(merged.added, []);
  assert.equal(merged.results.length, 1);
});

test('keeps a duplicate inside the incoming results out', () => {
  const incoming = [
    { title: 'A', url: 'https://a' },
    { title: 'A', url: 'https://a' },
  ];
  const merged = mergeSearchResults([], incoming);
  assert.deepEqual(merged.added, [incoming[0]]);
});
