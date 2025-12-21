import { QuickLofiExtension } from '@/types';
import Player from '@/modules/Player';
import { IndicatorActionKey } from '@/utils/constants';
//  TODO: remove more deps
export class IndicatorActions {
  private _mpv: Player;
  constructor(
    //  TODO: figure out how to use the type from PopupMenu
    private menu: any | null,
    private ext: QuickLofiExtension | null,
  ) {
    this._mpv = Player.getInstance();
  }

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
        this._mpv.playPause();
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
        this._mpv.stopPlayer();
      },
    ],
  ]);
}
