// Pure on purpose: tested with node --test, so no runtime imports.
export type YouTubeSearchResult = { title: string; url: string };

// Reads lines printed by `yt-dlp --print '%(title)s\t%(webpage_url)s'`.
// The url is after the last tab because titles may contain tabs themselves.
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

// Appends the results whose URL is not listed yet. `added` holds only the new
// ones, so `added.length > 0` tells whether the fetch brought anything new.
export function mergeSearchResults(
  existing: YouTubeSearchResult[],
  incoming: YouTubeSearchResult[],
): { results: YouTubeSearchResult[]; added: YouTubeSearchResult[] } {
  const seen = new Set(existing.map((result) => result.url));
  const added: YouTubeSearchResult[] = [];
  for (const result of incoming) {
    if (seen.has(result.url)) continue;
    seen.add(result.url);
    added.push(result);
  }
  return { results: [...existing, ...added], added };
}
