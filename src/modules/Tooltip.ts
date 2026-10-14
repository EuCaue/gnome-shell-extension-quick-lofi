import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import St from 'gi://St';
import * as Main from '@girs/gnome-shell/ui/main';

const GAP = 6;

export type TooltipPlacement = 'above' | 'below';

export type TooltipOptions = {
  placement?: TooltipPlacement;
  shouldShow?: () => boolean;
  // in px; longer text wraps
  maxWidth?: number;
};

export type Tooltip = {
  label: St.Label;
  hide: () => void;
};

// Floating label shown while `targetWidget` is hovered. `below` suits panel widgets,
// where there is no room above.
export function createTooltip(targetWidget: St.Widget, options: TooltipOptions = {}): Tooltip {
  const placement: TooltipPlacement = options.placement ?? 'above';
  const shouldShow = options.shouldShow ?? ((): boolean => true);
  const maxWidth = options.maxWidth ?? 210;
  // St.BoxLayout draws its background more reliably than a bare St.Label
  const tooltip = new St.BoxLayout({
    style: [
      'background-color: #1e1e1e;',
      'border-width: 1px;',
      'border-style: solid;',
      'border-color: rgba(255, 255, 255, 0.2);',
      'border-radius: 8px;',
      'padding-top: 6px;',
      'padding-bottom: 6px;',
      'padding-left: 12px;',
      'padding-right: 12px;',
      `max-width: ${maxWidth}px;`,
    ].join(' '),
    opacity: 0,
    visible: false,
    vertical: true,
    reactive: false,
  });

  const label = new St.Label({ text: '', style: 'color: #ffffff; font-size: 10pt;' });
  label.clutter_text.line_wrap = true;
  label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
  label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
  tooltip.add_child(label);

  // uiGroup is the global overlay layer, so the tooltip draws above menus and the panel
  Main.layoutManager.uiGroup.add_child(tooltip);

  targetWidget.reactive = true;
  targetWidget.track_hover = true;

  const show = () => {
    if (!label.text || !shouldShow()) return;

    const [, tw] = tooltip.get_preferred_width(-1);
    const [, th] = tooltip.get_preferred_height(-1);
    const [x, y] = targetWidget.get_transformed_position();
    const [w, h] = targetWidget.get_size();

    const posX =
      placement === 'below' ? Math.min(Math.max(0, x + (w - tw) / 2), Main.layoutManager.uiGroup.width - tw) : x;
    const posY = placement === 'below' ? y + h + GAP : y - th - GAP;
    tooltip.set_position(Math.round(posX), Math.round(posY));

    tooltip.get_parent()?.set_child_above_sibling(tooltip, null);
    tooltip.visible = true;
    tooltip.ease({ opacity: 255, duration: 150, mode: Clutter.AnimationMode.EASE_OUT_QUAD });
  };

  const hide = () => {
    tooltip.ease({
      opacity: 0,
      duration: 150,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
      onComplete: () => {
        tooltip.visible = false;
      },
    });
  };

  targetWidget.connect('enter-event', show);
  targetWidget.connect('leave-event', hide);
  targetWidget.connect('destroy', () => tooltip.destroy());

  return { label, hide };
}
