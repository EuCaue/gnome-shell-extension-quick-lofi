import GLib from 'gi://GLib';
import { run } from '@/preferences/Subprocess';
import { parseYouTubeSearchOutput, type YouTubeSearchResult } from '@/preferences/YouTubeResults';
import { writeLog } from '@/shared/log';
import { cookiesFromBrowserValue } from '@/shared/settings';

const SEARCH_TIMEOUT_SECONDS = 20;

// Throws an Error whose message is shown to the user as is.
export async function searchYouTube(
  query: string,
  limit: number,
  cookiesFromBrowser: string,
): Promise<YouTubeSearchResult[]> {
  const ytdlp = GLib.find_program_in_path('yt-dlp');
  if (!ytdlp) throw new Error('yt-dlp not found');

  const cookiesValue = cookiesFromBrowserValue(cookiesFromBrowser);
  const out = await run(
    [
      ytdlp,
      '--flat-playlist',
      '--no-warnings',
      ...(cookiesValue ? ['--cookies-from-browser', cookiesValue] : []),
      '--print',
      '%(title)s\t%(webpage_url)s',
      '--',
      `ytsearch${limit}:${query}`,
    ],
    SEARCH_TIMEOUT_SECONDS,
  );
  if (out.timedOut) throw new Error('Search timed out');

  const results = parseYouTubeSearchOutput(out.stdout);
  if (!out.succeeded && results.length === 0) throw new Error('Search failed');
  writeLog({ message: `[YouTubeSearch] "${query}" -> ${results.length} results`, type: 'INFO' });
  return results;
}
