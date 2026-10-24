import GLib from 'gi://GLib';
import { PROBE_PREFIX, PROBE_SEPARATOR, parseMpvProbe, pickRadioName } from '@/preferences/RadioName';
import { expandHome } from '@/preferences/RadioSource';
import { run } from '@/preferences/Subprocess';
import { writeLog } from '@/shared/log';
import { cookiesFromBrowserValue } from '@/shared/settings';

const MPV_TIMEOUT_SECONDS = 10;
const YTDLP_TIMEOUT_SECONDS = 15;

export async function detectRadioName(source: string, cookiesFromBrowser: string): Promise<string> {
  const path: string = expandHome(source.trim());
  let icyName: string = '';
  let mediaTitle: string = '';
  let ytTitle: string = '';
  let unreachable: boolean = false;

  try {
    // --ytdl=no keeps this fast: ICY and file tags come from ffmpeg directly.
    // Using mpv to find ICY and file tags (metadata) from the source.
    const mpv = await run(
      [
        'mpv',
        '--no-config',
        '--ytdl=no',
        '--no-video',
        '--ao=null',
        '--end=0.1',
        `--term-playing-msg=${PROBE_PREFIX}${PROBE_SEPARATOR}\${metadata/by-key/icy-name:}${PROBE_SEPARATOR}\${media-title}`,
        '--',
        path,
      ],
      MPV_TIMEOUT_SECONDS,
    );
    // A source that didn't answer mpv won't answer yt-dlp either; don't wait twice.
    unreachable = mpv.timedOut;
    const probe = parseMpvProbe(mpv.stdout);
    icyName = probe?.icyName ?? '';
    mediaTitle = probe?.mediaTitle ?? '';
  } catch (e) {
    writeLog({ message: `[RadioNameProbe] mpv probe failed: ${e}`, type: 'WARN' });
  }

  // Using yt-dlp to find the title of a YouTube video or playlist.
  const ytdlp = GLib.find_program_in_path('yt-dlp');
  if (!icyName && !unreachable && ytdlp && /^https?:\/\//i.test(path)) {
    const cookiesValue = cookiesFromBrowserValue(cookiesFromBrowser);
    const cookiesArgs = cookiesValue ? ['--cookies-from-browser', cookiesValue] : [];
    try {
      const out = await run(
        [
          ytdlp,
          '--no-warnings',
          '--flat-playlist',
          '-I',
          '1',
          ...cookiesArgs,
          '--print',
          '%(playlist_title,title)s',
          '--',
          path,
        ],
        YTDLP_TIMEOUT_SECONDS,
      );
      ytTitle = out.stdout.split('\n')[0]?.trim() ?? '';
      if (ytTitle === 'NA') ytTitle = '';
    } catch (e) {
      writeLog({ message: `[RadioNameProbe] yt-dlp probe failed: ${e}`, type: 'WARN' });
    }
  }

  const name = pickRadioName({ source, icyName, mediaTitle, ytTitle });
  writeLog({ message: `[RadioNameProbe] ${source} -> "${name}" (icy="${icyName}", yt="${ytTitle}")`, type: 'INFO' });
  return name;
}
