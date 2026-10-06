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
