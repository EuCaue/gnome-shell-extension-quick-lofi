export const PREVIEW_SECONDS = 30;

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
    '--no-terminal',
    '--quiet',
    `--volume=${volume}`,
    '--ytdl-format=bestaudio/best',
    `--length=${PREVIEW_SECONDS}`,
    '--loop-playlist=no',
    ...cookiesArgs,
    '--',
    url,
  ];
}
