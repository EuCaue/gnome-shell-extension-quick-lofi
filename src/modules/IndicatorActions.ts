import { QuickLofiExtension } from '@/types';
import Player from './Player';
import { IndicatorActionKey } from '@/utils/constants';
export class IndicatorActions {
  constructor(
    //  TODO: figure out how to use the type from PopupMenu
    private menu: any | null,
    private ext: QuickLofiExtension | null,
    private mpv: Player | null,
  ) {}

  public actions = new Map<IndicatorActionKey, CallableFunction>([
    [
      'showPopupMenu',
      () => {
        this.menu.open();
      },
    ],
    [
      'playPause',
      () => {
        this.menu.close();
        this.mpv.playPause();
      },
    ],
    [
      'openPrefs',
      () => {
        this.menu.close();
        this.ext.openPreferences();
      },
    ],
    [
      'stopPlayer',
      () => {
        this.menu.close();
        this.mpv.stopPlayer();
      },
    ],
  ]);
}
