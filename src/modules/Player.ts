import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from '@girs/gnome-shell/ui/main';
import GObject from 'gi://GObject';
import { type Radio } from '@/types';
import { SETTINGS_KEYS } from '@utils/constants';

type PlayerCommandString = string;
type PlayerCommand = {
  command: Array<string | boolean>;
};

export default class Player extends GObject.Object {
  static {
    GObject.registerClass(
      {
        Signals: {
          'play-state-changed': { param_types: [GObject.TYPE_BOOLEAN] },
          'playback-stopped': { param_types: [] },
        },
      },
      this,
    );
  }
  private readonly _mpvSocket: string = '/tmp/quicklofi-socket';
  private _isCommandRunning: boolean = false;
  private _proc: Gio.Subprocess | null = null;
  private _keepReading: boolean = true;
  private _stdoutStream: Gio.DataInputStream | null = null;
  private _cancellable: Gio.Cancellable | null = null;

  constructor(private _settings: Gio.Settings) {
    super();
  }

  public initVolumeControl(): void {
    this._settings.connect(`changed::${SETTINGS_KEYS.VOLUME}`, (settings, key) => {
      if (this._proc !== null && !this._isCommandRunning) {
        const volume = settings.get_int(key);
        const command = this.createCommand({
          command: ['set_property', 'volume', volume],
        });
        this.sendCommandToMpvSocket(command);
      }
    });
  }

  public async stopPlayer(): Promise<void> {
    this._keepReading = false;

    if (this._cancellable) {
      this._cancellable.cancel();
      this._cancellable = null;
    }

    if (this._stdoutStream) {
      try {
        this._stdoutStream.close(null);
      } catch (e) {}
      this._stdoutStream = null;
    }

    if (this._proc) {
      const proc = this._proc;
      this._proc = null;

      return new Promise((resolve) => {
        proc.wait_check_async(null, (p, res) => {
          try {
            p.wait_check_finish(res);
          } catch (e) {}
          GLib.unlink(this._mpvSocket);
          this.emit('playback-stopped');
          resolve();
        });
        try {
          proc.force_exit();
        } catch (e) {}
      });
      return;
    }
  }

  public isPlaying(): boolean {
    return this._proc !== null;
  }

  public playPause(): void {
    const playPauseCommand = this.createCommand({ command: ['cycle', 'pause'] });
    this.sendCommandToMpvSocket(playPauseCommand);
    const result = this.getProperty('pause');
    if (result) {
      const isPaused = result.data;
      this.emit('play-state-changed', isPaused);
    }
  }

  public getProperty(prop: string): { data: boolean; request_id: number; error: string } | null {
    if (this._proc) {
      const command = this.createCommand({ command: ['get_property', prop] });
      const output = this.sendCommandToMpvSocket(command);
      return JSON.parse(output) ?? null;
    }
  }

  private _monitorPlayerOutput({
    stream,
    onLine,
  }: {
    stream: Gio.DataInputStream;
    onLine: (line: string) => boolean | void;
  }) {
    this._cancellable = new Gio.Cancellable();

    const readLine = () => {
      if (!this._keepReading || this._proc === null) return;

      stream.read_line_async(GLib.PRIORITY_DEFAULT, this._cancellable, (s, res) => {
        if (this._cancellable?.is_cancelled()) return;

        let line: string | null = null;
        try {
          [line] = s.read_line_finish_utf8(res);
        } catch (e) {
          return; // stream closed
        }

        if (line !== null) {
          const keep = onLine(line);
          if (keep === false) {
            this._keepReading = false;
            return;
          }
        }

        if (this._keepReading) readLine();
      });
    };

    readLine();
  }
  public async startPlayer(radio: Radio): Promise<void> {
    await this.stopPlayer();
    //  TODO: use a map for this;
    const MPV_OPTIONS: Array<string> = [
      `--volume=${this._settings.get_int(SETTINGS_KEYS.VOLUME)}`,
      '--demuxer-lavf-o=extension_picky=0',
      `--input-ipc-server=${this._mpvSocket}`,
      '--loop-playlist=force',
      '--no-video',
      '--ytdl-format=best*[vcodec=none]',
      '--ytdl-raw-options-add=force-ipv4=',
      '--msg-level=all=warn',
      `"${radio.radioUrl}"`,
    ];
    try {
      this._keepReading = true;
      const [, argv] = GLib.shell_parse_argv(`mpv ${MPV_OPTIONS.join(' ')}`);
      this._proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);

      this._stdoutStream = new Gio.DataInputStream({
        base_stream: this._proc.get_stdout_pipe(),
      });

      this._monitorPlayerOutput({
        stream: this._stdoutStream,
        onLine: (line) => {
          if (line.trim().startsWith('Failed')) {
            this.stopPlayer();
            Main.notifyError(`Error while playing: ${radio.radioName}`, line.trim());
            return false; // stops loop
          }
        },
      });
    } catch (e) {
      this._keepReading = false;
      this.stopPlayer();
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
      const byteArray = new TextEncoder().encode(mpvCommand);

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
