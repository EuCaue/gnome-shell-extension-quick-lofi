import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseYouTubeSearchOutput } from '../src/preferences/YouTubeResults.ts';

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
