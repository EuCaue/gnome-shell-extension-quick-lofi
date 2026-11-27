import Gio from 'gi://Gio';
import St from 'gi://St';
import type { PopupDummyMenu, PopupMenu } from '@girs/gnome-shell/ui/popupMenu';
import Player from '@/modules/Player';
import { type ClickActionKey, SETTINGS_KEYS } from '@/shared/constants';
import { writeLog } from '@/shared/log';
import { findRadioById, parseRadios } from '@/shared/radios';
import { getExtSettings } from '@/shared/settings';
import { stepVolume } from '@/shared/volume';
import type { QuickLofiExtension, Radio } from '@/types';

// Runs the click actions configured for the indicator, the radios and the mini player buttons.
export class ClickActions {
  private _mpv: Player;
  constructor(
    private menu: PopupMenu | PopupDummyMenu,
    private ext: QuickLofiExtension | null,
  ) {
    this._mpv = Player.getInstance();
    writeLog({ message: '[ClickActions] Initialized', type: 'INFO' });
  }

  // `radio` is the radio the click targets (the playing one when omitted). Only openPrefs closes the menu.
  // Returns false when there was nothing to run.
  public run(action: string, { radio }: { radio?: Radio } = {}): boolean {
    const runAction = this._actions.get(action as ClickActionKey);
    if (!runAction || action === 'none') return false;
    writeLog({ message: `[ClickActions] Running ${action}`, type: 'INFO' });
    runAction(radio ?? this._playingRadio());
    return true;
  }

  private _changeVolume(direction: 1 | -1): void {
    const settings = getExtSettings();
    const current = settings.get_int(SETTINGS_KEYS.VOLUME);
    const step = new Gio.Settings({ schema: 'org.gnome.settings-daemon.plugins.media-keys' }).get_int('volume-step');
    const updated = stepVolume(current, step, direction);
    if (updated !== current) settings.set_int(SETTINGS_KEYS.VOLUME, updated);
  }

  private _playingRadio(): Radio | undefined {
    const settings = this.ext._settings;
    return findRadioById(
      parseRadios(settings.get_strv(SETTINGS_KEYS.RADIOS_LIST)),
      settings.get_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING),
    );
  }

  private _actions = new Map<ClickActionKey, (radio: Radio | undefined) => void>([
    ['none', () => {}],
    ['showPopupMenu', () => this.menu.open()],
    ['playPause', () => this._mpv.playPause()],
    ['stopPlayer', (radio) => this._mpv.stopPlayer(radio)],
    [
      'restart',
      (radio) => {
        if (radio) this._mpv.startPlayer(radio);
      },
    ],
    ['prev', () => this._mpv.prev()],
    ['prevRadio', () => this._mpv.prev('radio')],
    ['next', () => this._mpv.next()],
    ['nextRadio', () => this._mpv.next('radio')],
    [
      'copyUrl',
      (radio) => {
        if (radio) St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, radio.radioUrl);
      },
    ],
    ['playPauseDefaultRadio', () => this._mpv.playPauseDefaultRadio()],
    ['stopDefaultRadio', () => this._mpv.stopDefaultRadio()],
    ['increaseVolume', () => this._changeVolume(1)],
    ['decreaseVolume', () => this._changeVolume(-1)],
    [
      'openPrefs',
      () => {
        this.menu.close();
        this.ext.openPreferences();
      },
    ],
  ]);
}
