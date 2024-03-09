import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { UUID } from './consts';

type PlayerCommandString = string;
type PlayerCommand = {
  command: Array<string | boolean>;
};

export class Player {
  isPlaying: boolean = false;
  private process: Gio.Subprocess | null = null;
  private readonly mpvSocket: string = '/tmp/quicklofi-socket';
  private readonly _settings = Extension.lookupByUUID(UUID).getSettings();

  public init() {
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

  public stopPlayer() {
    if (this.process !== null) {
      this.process.force_exit();
      this.isPlaying = false;
      this.process = null;
    }
  }

  public startPlayer(url: string) {
    this.stopPlayer();
    try {
      this.isPlaying = true;
      this.process = Gio.Subprocess.new(
        [
          'mpv',
          url,
          '--title=quicklofi',
          `--volume=${this._settings.get_int('volume')}`,
          `--input-ipc-server=${this.mpvSocket}`,
          '--no-video',
        ],
        Gio.SubprocessFlags.NONE,
      );
    } catch (e) {
      this.isPlaying = false;
      this.process = null;
    }
  }

  public resume() {
    const command = this.createCommand({
      command: ['set_property', 'pause', false],
    });
    this.sendCommandToMpvSocket(command);
    this.isPlaying = true;
  }

  public pause() {
    const command = this.createCommand({
      command: ['set_property', 'pause', true],
    });
    this.sendCommandToMpvSocket(command);
    this.isPlaying = false;
  }

  private createCommand(command: PlayerCommand): PlayerCommandString {
    const cmd: PlayerCommandString = `echo '${JSON.stringify(command)}'`;
    return cmd;
  }

  private sendCommandToMpvSocket(mpvCommand: PlayerCommandString): void {
    //  TODO: use native socket with GJS in the future.
    const socatCommand = ['|', 'socat', '-', this.mpvSocket];
    //  TODO: handle the errors and notify when success
    const [success, stdout, stderr] = GLib.spawn_sync(
      null,
      ['/bin/sh', '-c', mpvCommand + ' ' + socatCommand.join(' ')],
      null,
      GLib.SpawnFlags.SEARCH_PATH,
      null,
    );
  }
}
