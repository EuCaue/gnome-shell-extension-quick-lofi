import { QuickLofiExtension } from '@/types';
import Player from '@/modules/Player';
import { IndicatorActionKey, SETTINGS_KEYS } from '@/utils/constants';
import { writeLog } from '@/utils/helpers';
//  TODO: remove more deps
export class IndicatorActions {
  private _mpv: Player;
  constructor(
    //  TODO: figure out how to use the type from PopupMenu
    private menu: any | null,
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
