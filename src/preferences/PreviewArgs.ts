export const PREVIEW_SECONDS = 120;
// mpv property expansion uses ${...}; it is not a JavaScript template literal.
// biome-ignore lint/suspicious/noTemplateCurlyInString: mpv property expansion syntax.
export const PREVIEW_STATUS_TEMPLATE = '--term-status-msg=QLOFI T=${=time-pos:} D=${=duration:}\\n';

export type PreviewStatus = { elapsed: number; duration: number | null };

export function parsePreviewStatus(line: string): PreviewStatus | null {
  const clean = line.replace(/\r/g, '').trim();
  if (!clean.startsWith('QLOFI ')) return null;
  const time = clean.match(/\bT=(\S*)/)?.[1];
  const elapsed = Number.parseFloat(time ?? '');
  if (!Number.isFinite(elapsed) || elapsed < 0) return null;
  const rawDuration = clean.match(/\bD=(\S*)/)?.[1] ?? '';
  const parsedDuration = Number.parseFloat(rawDuration);
  const duration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : null;
  return { elapsed, duration };
}

export function previewElapsedSince(elapsed: number, baseline: number): number {
  return Math.max(0, elapsed - baseline);
}

export function formatPreviewTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function previewFailed(exitStatus: number, signaled: boolean): boolean {
  return signaled || exitStatus !== 0;
}

export function buildPreviewArgv(
  url: string,
  cookiesValue: string | null,
  jsRuntime: 'node' | 'deno' | null,
  volume: number,
): string[] {
  const cookiesArgs =
    cookiesValue && jsRuntime
      ? [
          `--ytdl-raw-options-add=cookies-from-browser=${cookiesValue}`,
          `--ytdl-raw-options-add=js-runtimes=${jsRuntime}`,
          '--ytdl-raw-options-add=remote-components=ejs:github',
        ]
      : [];

  return [
    'mpv',
    '--no-config',
    '--no-video',
    `--volume=${volume}`,
    PREVIEW_STATUS_TEMPLATE,
    '--ytdl-format=bestaudio/best',
    '--loop-playlist=no',
    ...cookiesArgs,
    '--',
    url,
  ];
}
