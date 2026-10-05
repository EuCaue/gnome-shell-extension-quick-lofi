// No gi:// imports: tests load this file directly with Node.

export const PROBE_PREFIX = 'QLNAME';
export const PROBE_SEPARATOR = '\x1f';
const MIN_LENGTH = 2;
const DEFAULT_NAME = 'Radio';

// GJS has no global URL, so URLs are split by hand: scheme://[user@]host[:port]/path?query#hash
const URL_PARTS = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/?#]*@)?([^:/?#]*)(?::\d+)?([^?#]*)/i;
const isUrl = (source: string): boolean => URL_PARTS.test(source);
const urlHost = (source: string): string => source.match(URL_PARTS)?.[1] ?? '';

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function parseMpvProbe(stdout: string): { icyName: string; mediaTitle: string } | null {
  const line = stdout.split('\n').find((l) => l.startsWith(PROBE_PREFIX + PROBE_SEPARATOR));
  if (!line) return null;
  const [, icyName = '', mediaTitle = ''] = line.split(PROBE_SEPARATOR);
  return { icyName: icyName.trim(), mediaTitle: mediaTitle.trim() };
}

function lastSegment(source: string): string {
  const url = source.match(URL_PARTS);
  if (url) {
    const segment = url[2].split('/').filter(Boolean).pop();
    return segment ? decode(segment) : url[1];
  }
  return source.split('/').filter(Boolean).pop() ?? source;
}

const stripExtension = (name: string): string => name.replace(/\.[^.\s]{1,5}$/, '');

export function fallbackRadioName(source: string): string {
  const tail = lastSegment(source.trim());
  return isUrl(source) ? tail : stripExtension(tail);
}

// " - " separates name, url and id in the `radios` setting.
export function sanitizeRadioName(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ -(?= |$)/g, ' –');
}

export function pickRadioName(input: {
  source: string;
  icyName?: string;
  mediaTitle?: string;
  ytTitle?: string;
}): string {
  const { source } = input;
  const tail = lastSegment(source);
  const candidates = [
    input.icyName,
    input.ytTitle !== tail ? input.ytTitle : undefined,
    // For URLs mpv's media-title is the URL tail or the current song, never a station name.
    !isUrl(source) && input.mediaTitle !== tail ? input.mediaTitle : undefined,
    fallbackRadioName(source),
    urlHost(source),
  ];
  for (const candidate of candidates) {
    const name = sanitizeRadioName(candidate ?? '');
    if (name.length >= MIN_LENGTH) return name;
  }
  return DEFAULT_NAME;
}
