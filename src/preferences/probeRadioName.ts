import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { writeLog } from '@utils/helpers';
import { PROBE_PREFIX, PROBE_SEPARATOR, parseMpvProbe, pickRadioName } from '@utils/radioName';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async', 'communicate_utf8_finish');

const MPV_TIMEOUT_SECONDS = 10;
const YTDLP_TIMEOUT_SECONDS = 15;

async function run(argv: string[], timeoutSeconds: number): Promise<string> {
  const proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
  const timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, timeoutSeconds, () => {
    proc.force_exit();
    return GLib.SOURCE_REMOVE;
  });
  try {
    const [stdout] = await proc.communicate_utf8_async(null, null);
    return stdout ?? '';
  } finally {
    GLib.Source.remove(timer);
  }
}

function expandHome(source: string): string {
  return source.startsWith('~') ? GLib.get_home_dir() + source.slice(1) : source;
}

export async function detectRadioName(source: string, cookiesFromBrowser: string): Promise<string> {
  const path = expandHome(source.trim());
  let icyName = '';
  let mediaTitle = '';
  let ytTitle = '';

  try {
    // --ytdl=no keeps this fast: ICY and file tags come from ffmpeg directly.
    const mpvOut = await run(
      [
        'mpv',
        '--no-config',
        '--ytdl=no',
        '--no-video',
        '--ao=null',
        '--end=0.1',
        `--term-playing-msg=${PROBE_PREFIX}${PROBE_SEPARATOR}\${metadata/by-key/icy-name:}${PROBE_SEPARATOR}\${media-title}`,
        path,
      ],
      MPV_TIMEOUT_SECONDS,
    );
    const probe = parseMpvProbe(mpvOut);
    icyName = probe?.icyName ?? '';
    mediaTitle = probe?.mediaTitle ?? '';
  } catch (e) {
    writeLog({ message: `[probeRadioName] mpv probe failed: ${e}`, type: 'WARN' });
  }

  const ytdlp = GLib.find_program_in_path('yt-dlp');
  if (!icyName && ytdlp && /^https?:\/\//i.test(path)) {
    const [browser, cookiesValue] = cookiesFromBrowser.split(' - ');
    const cookiesArgs = browser !== 'None' && cookiesValue ? ['--cookies-from-browser', cookiesValue] : [];
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
          path,
        ],
        YTDLP_TIMEOUT_SECONDS,
      );
      ytTitle = out.split('\n')[0]?.trim() ?? '';
      if (ytTitle === 'NA') ytTitle = '';
    } catch (e) {
      writeLog({ message: `[probeRadioName] yt-dlp probe failed: ${e}`, type: 'WARN' });
    }
  }

  const name = pickRadioName({ source, icyName, mediaTitle, ytTitle });
  writeLog({ message: `[probeRadioName] ${source} -> "${name}" (icy="${icyName}", yt="${ytTitle}")`, type: 'INFO' });
  return name;
}
