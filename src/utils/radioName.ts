// No gi:// imports: tests load this file directly with Node.

export const PROBE_PREFIX = 'QLNAME';
export const PROBE_SEPARATOR = '\x1f';
const MIN_LENGTH = 2;
const DEFAULT_NAME = 'Radio';

const isUrl = (source: string): boolean => /^[a-z][a-z0-9+.-]*:\/\//i.test(source);

export function parseMpvProbe(stdout: string): { icyName: string; mediaTitle: string } | null {
  const line = stdout.split('\n').find((l) => l.startsWith(PROBE_PREFIX + PROBE_SEPARATOR));
  if (!line) return null;
  const [, icyName = '', mediaTitle = ''] = line.split(PROBE_SEPARATOR);
  return { icyName: icyName.trim(), mediaTitle: mediaTitle.trim() };
}

function lastSegment(source: string): string {
  if (isUrl(source)) {
    try {
      const url = new URL(source);
      const segment = url.pathname.split('/').filter(Boolean).pop();
      return segment ? decodeURIComponent(segment) : url.hostname;
    } catch {
      return source;
    }
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
  return name.replace(/\s+/g, ' ').trim().replaceAll(' - ', ' – ');
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
    isUrl(source) ? new URL(source).hostname : undefined,
  ];
  for (const candidate of candidates) {
    const name = sanitizeRadioName(candidate ?? '');
    if (name.length >= MIN_LENGTH) return name;
  }
  return DEFAULT_NAME;
}
