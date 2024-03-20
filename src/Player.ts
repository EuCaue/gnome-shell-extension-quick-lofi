import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { UUID } from './consts';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { type Radio } from './extension';
import Utils from "./Utils";

type PlayerCommandString = string;
type PlayerCommand = {
  command: Array<string | boolean>;
};

export class Player {
  public isPlaying: boolean = false;
  private process: Gio.Subprocess | null = null;
  private readonly mpvSocket: string = '/tmp/quicklofi-socket';
  private readonly _settings = Extension.lookupByUUID(UUID).getSettings();

  public init(): void {
    this._settings.connect('changed::volume', (settings, key) => {
      if (this.process !== null) {
        const volume = settings.get_int(key);
        const command = this.createCommand({
          command: ['set_property', 'volume', volume],
        });
        this.sendCommandToMpvSocket(command);
      }
    });
  }

  public stopPlayer(): void {
    if (this.process !== null) {
      this.process.force_exit();
      this.isPlaying = false;
      this.process = null;
      Utils.deleteTempFile();
      return;
    }

    if (this.process === null) {
      const command = this.createCommand({
        command: ['quit'],
      });
      this.sendCommandToMpvSocket(command);
      Utils.deleteTempFile();
      return
    }
  }

  public startPlayer(radio: Radio): void {
    this.stopPlayer();
    Utils.createTempFile(radio.radioName);
    try {
      this.isPlaying = true;
      this.process = Gio.Subprocess.new(
        [
          'mpv',
          radio.radioUrl,
          `--volume=${this._settings.get_int('volume')}`,
          `--input-ipc-server=${this.mpvSocket}`,
          '--no-video',
        ],
        Gio.SubprocessFlags.NONE,
      );
    } catch (e) {
      this.isPlaying = false;
      this.process = null;
      Main.notifyError(
        'MPV not found',
        'Did you have mpv installed?\nhttps://github.com/EuCaue/quick-lofi?tab=readme-ov-file#dependencies',
      );
    }
  }

  private createCommand(command: PlayerCommand): PlayerCommandString {
    const cmd: PlayerCommandString = `echo '${JSON.stringify(command)}'`;
    return cmd;
  }

  private sendCommandToMpvSocket(mpvCommand: PlayerCommandString): void {
    //  TODO: use native socket with GJS in the future.
    const socatCommand = ['|', 'socat', '-', this.mpvSocket];
    const [success, _] = GLib.spawn_async(
      null,
      ['/bin/sh', '-c', mpvCommand + ' ' + socatCommand.join(' ')],
      null,
      GLib.SpawnFlags.SEARCH_PATH,
      null,
    );
    if (!success) {
      Main.notifyError(
        'Socat not found',
        'Did you have socat installed?\nhttps://github.com/EuCaue/quick-lofi?tab=readme-ov-file#dependencies',
      );
    }
  }
}
