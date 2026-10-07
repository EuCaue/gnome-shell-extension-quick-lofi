import type { PopupDummyMenu, PopupMenu } from '@girs/gnome-shell/ui/popupMenu';
import Player from '@/modules/Player';
import { type IndicatorActionKey, SETTINGS_KEYS } from '@/shared/constants';
import { writeLog } from '@/shared/log';
import type { QuickLofiExtension } from '@/types';
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
    [
      'next',
      () => {
        writeLog({ message: '[IndicatorActions] Next', type: 'INFO' });
        this.menu.close();
        this._mpv.next();
      },
    ],
    [
      'nextRadio',
      () => {
        writeLog({ message: '[IndicatorActions] Next radio', type: 'INFO' });
        this.menu.close();
        this._mpv.next('radio');
      },
    ],
    [
      'prev',
      () => {
        writeLog({ message: '[IndicatorActions] Previous', type: 'INFO' });
        this.menu.close();
        this._mpv.prev();
      },
    ],
    [
      'prevRadio',
      () => {
        writeLog({ message: '[IndicatorActions] Previous radio', type: 'INFO' });
        this.menu.close();
        this._mpv.prev('radio');
      },
    ],
  ]);
}
