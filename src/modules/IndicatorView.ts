// No gi:// imports: tests load this file directly with Node.

export interface PopupSize {
  maxWidth: string | null;
  maxHeight: string | null;
  width: string | null;
  height: string | null;
}

export interface PopupStyles {
  box: string;
  actor: string;
  scrollView: string;
}

export function buildPopupStyles(size: PopupSize, panelMenuStyle: string): PopupStyles {
  const maxWidth = size.maxWidth ?? 'auto';
  const maxHeight = size.maxHeight ?? 'auto';

  // `max-width` only caps the natural width, never the minimum one, so the shell
  // theme's `min-width: 15em` on `.popup-menu` has to be cleared for the popup to
  // shrink below it. PanelMenu.Button rewrites the actor's style with its own
  // max-height on every open, so that declaration is carried over instead of lost.
  const maxHeightDeclaration = panelMenuStyle.match(/max-height:[^;]+;/)?.[0] ?? '';

  // The preset pins only the natural size (never `min-*` or `width`/`height`, which
  // set the minimum too), so the max limits on box/actor can still shrink it.
  const scrollView = [
    size.width ? `-st-natural-width: ${size.width}; max-width: ${size.width};` : '',
    size.height ? `-st-natural-height: ${size.height}; max-height: ${size.height};` : '',
  ]
    .join(' ')
    .trim();

  return {
    box: `max-height: ${maxHeight}; max-width: ${maxWidth};`,
    actor: `${maxHeightDeclaration} min-width: 0; max-width: ${maxWidth};`.trim(),
    scrollView,
  };
}

export function formatTime(time: string | number | undefined): string {
  const parsed = parseInt(String(time), 10);

  if (Number.isNaN(parsed)) return '00:00';

  const hours = Math.floor(parsed / 3600);
  const minutes = String(Math.floor((parsed % 3600) / 60)).padStart(2, '0');
  const seconds = String(Math.floor(parsed % 60)).padStart(2, '0');

  return `${hours > 0 ? `${hours}:` : ''}${minutes}:${seconds}`;
}

export type IndicatorStatus = {
  radioName: string | null;
  paused: boolean;
  position: number;
  duration: number;
};

export function buildIndicatorStatus({ radioName, paused, position, duration }: IndicatorStatus): string {
  if (radioName === null) return 'Stopped';
  // live streams report no duration, so there is no end to show
  const time = duration > 0 ? `${formatTime(position)} / ${formatTime(duration)}` : formatTime(position);
  return `${radioName} - ${paused ? 'Paused' : 'Playing'} - ${time}`;
}
