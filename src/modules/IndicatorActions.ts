import type { PopupDummyMenu, PopupMenu } from '@girs/gnome-shell/ui/popupMenu';
import Player from '@/modules/Player';
import type { QuickLofiExtension } from '@/types';
import { type IndicatorActionKey, SETTINGS_KEYS } from '@/utils/constants';
import { writeLog } from '@/utils/helpers';
export class IndicatorActions {
  private _mpv: Player;
  constructor(
    private menu: PopupMenu | PopupDummyMenu,
    private ext: QuickLofiExtension | null,
  ) {
    this._mpv = Player.getInstance();
    writeLog({ message: '[IndicatorActions] Initialized', type: 'INFO' });
  }

  public actions = new Map<IndicatorActionKey, CallableFunction>([
    [
      'showPopupMenu',
      () => {
        writeLog({ message: '[IndicatorActions] Opening popup menu', type: 'INFO' });
        this.menu.open();
      },
    ],
    [
      'playPause',
      () => {
        writeLog({ message: '[IndicatorActions] Toggling play/pause', type: 'INFO' });
        this.menu.close();
        this._mpv.playPause();
      },
    ],
    [
      'openPrefs',
      () => {
        writeLog({ message: '[IndicatorActions] Opening preferences', type: 'INFO' });
        this.menu.close();
        this.ext.openPreferences();
      },
    ],
    [
      'stopPlayer',
      () => {
        const currentRadio = this.ext._settings.get_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING);
        writeLog({ message: `[IndicatorActions] Stopping player for radio: ${currentRadio}`, type: 'INFO' });
        this.menu.close();
        this._mpv.stopPlayer({ id: currentRadio });
      },
    ],
  ]);
}
