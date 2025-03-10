import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from '@girs/gnome-shell/ui/main';
import { type Radio } from './types';
import Utils from './Utils';

type PlayerCommandString = string;
type PlayerCommand = {
  command: Array<string | boolean>;
};

export default class Player {
  private readonly _mpvSocket: string = '/tmp/quicklofi-socket';
  private _isCommandRunning: boolean = false;
  private _process: Gio.Subprocess | null = null;
  public debounceTimeout: number | null = null;

  constructor(private _settings: Gio.Settings) {}

  public initVolumeControl(): void {
    this._settings.connect('changed::volume', (settings, key) => {
      if (this._process !== null && !this._isCommandRunning) {
        const volume = settings.get_int(key);
        const command = this.createCommand({
          command: ['set_property', 'volume', volume],
        });
        this.sendCommandToMpvSocket(command);
      }
    });
  }

  public stopPlayer(): void {
    if (this._process !== null) {
      this._process.force_exit();
      this._process = null;
      return;
    }
  }

  public playPause(): void {
    const playPauseCommand = this.createCommand({ command: ['cycle', 'pause'] });
    this.sendCommandToMpvSocket(playPauseCommand);
  }

  public getProperty(prop: string): { data: boolean; request_id: number; error: string } | null {
    if (this._process) {
      const command = this.createCommand({ command: ['get_property', prop] });
      const output = this.sendCommandToMpvSocket(command);
      return JSON.parse(output) ?? null;
    }
  }

  public startPlayer(radio: Radio): void {
    this.stopPlayer();
    try {
      const [, argv] = GLib.shell_parse_argv(
        `mpv --volume=${this._settings.get_int('volume')} --input-ipc-server=/tmp/quicklofi-socket --loop-playlist=force --no-video --ytdl-format='best*[vcodec=none]' --ytdl-raw-options-add='force-ipv4=' ${radio.radioUrl}`,
      );
      this._process = Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
    } catch (e) {
      this._process = null;
      Main.notifyError(
        'MPV not found',
        'Did you have mpv installed?\nhttps://github.com/EuCaue/gnome-shell-extension-quick-lofi?tab=readme-ov-file#dependencies',
      );
    }
  }

  private createCommand(command: PlayerCommand): PlayerCommandString {
    return JSON.stringify(command) + '\n';
  }

  private sendCommandToMpvSocket(mpvCommand: string): string | null {
    let response: string | null = null;

    if (this._isCommandRunning) {
      return null;
    }

    this._isCommandRunning = true;
    try {
      const address = Gio.UnixSocketAddress.new(this._mpvSocket);
      const client = new Gio.SocketClient();
      const connection = client.connect(address, null);

      const outputStream = connection.get_output_stream();
      const inputStream = connection.get_input_stream();
      const command = mpvCommand;
      const byteArray = new TextEncoder().encode(command);

      outputStream.write(byteArray, null);
      outputStream.flush(null);

      const dataInputStream = new Gio.DataInputStream({ base_stream: inputStream });
      const [res] = dataInputStream.read_line_utf8(null);
      response = res;
      outputStream.close(null);
      inputStream.close(null);
      connection.close(null);
    } catch (e) {
      Main.notifyError('Error while connecting to the MPV SOCKET', e.message);
    }
    this._isCommandRunning = false;
    return response;
  }
}
