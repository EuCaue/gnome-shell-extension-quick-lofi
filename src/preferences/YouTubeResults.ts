// Pure: tested with node --test, no runtime imports.
export type YouTubeSearchResult = { title: string; url: string };

// Parses `yt-dlp --print '%(title)s\t%(webpage_url)s'` output.
// URL is after the last tab. Titles may contain tabs.
export function parseYouTubeSearchOutput(stdout: string): YouTubeSearchResult[] {
  const results: YouTubeSearchResult[] = [];
  for (const line of stdout.split('\n')) {
    const tab = line.lastIndexOf('\t');
    if (tab === -1) continue;
    const title = line.slice(0, tab).trim();
    const url = line.slice(tab + 1).trim();
    if (!title || !/^https?:\/\//i.test(url)) continue;
    results.push({ title, url });
  }
  return results;
}

// Video id for youtube.com, youtu.be, shorts, live and embed links; otherwise the url itself.
export function youtubeKey(url: string): string {
  return /(?:[?&]v=|youtu\.be\/|\/(?:shorts|live|embed)\/)([\w-]{11})/.exec(url)?.[1] ?? url;
}

export function mergeSearchResults(
  existing: YouTubeSearchResult[],
  incoming: YouTubeSearchResult[],
): { results: YouTubeSearchResult[]; added: YouTubeSearchResult[] } {
  const seen = new Set(existing.map((result) => youtubeKey(result.url)));
  const added: YouTubeSearchResult[] = [];
  for (const result of incoming) {
    const key = youtubeKey(result.url);
    if (seen.has(key)) continue;
    seen.add(key);
    added.push(result);
  }
  return { results: [...existing, ...added], added };
}
