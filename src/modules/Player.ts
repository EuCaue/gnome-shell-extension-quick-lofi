import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from '@girs/gnome-shell/ui/main';
import GObject from 'gi://GObject';
import { type Radio } from '@/types';
import { SETTINGS_KEYS } from '@utils/constants';
import { getExtSettings, writeLog } from '@/utils/helpers';
import { MprisController } from './Mpris';

type PlayerCommandString = string;
type PlayerCommand = {
  command: Array<string | boolean>;
};

Gio._promisify(Gio.DataInputStream.prototype, 'read_line_async', 'read_line_finish_utf8');
Gio._promisify(Gio.Subprocess.prototype, 'wait_async', 'wait_finish');

let _instance: Player | null = null;

export default class Player extends GObject.Object {
  static {
    GObject.registerClass(
      {
        Signals: {
          'play-state-changed': { param_types: [GObject.TYPE_BOOLEAN] },
          'playback-stopped': { param_types: [] },
          'radio-changed': { param_types: [GObject.TYPE_STRING] },
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
  private _settings: Gio.Settings;
  private _mpris: MprisController | null = null;

  static getInstance(): Player {
    if (!_instance) {
      _instance = new Player();
      _instance.initVolumeControl();
      _instance._mpris = new MprisController(_instance);
    }
    return _instance;
  }

  constructor() {
    super();
    if (_instance) {
      throw new Error('Use Player.getInstance()');
    }
    this._settings = getExtSettings();
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

  public async stopPlayer(radio?: Partial<Radio>): Promise<void> {
    await writeLog({
      message: `Stopping radio: ID: ${radio?.id} Name: ${radio?.radioName} ${radio?.radioUrl}`,
    }).catch(log);
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

      try {
        proc.force_exit();
        await proc.wait_async(null);
        this.emit('playback-stopped');
        if (GLib.file_test(this._mpvSocket, GLib.FileTest.EXISTS)) {
          GLib.unlink(this._mpvSocket);
        }
        this._settings.set_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING, '');
        if (this._mpris) {
          this._mpris.updateMetadata(null);
        }
        writeLog({
          message: `Radio Stopped: ID: ${radio?.id} Name: ${radio?.radioName} ${radio?.radioUrl}`,
        }).catch(log);
      } catch (e) {
        log(`Error while exiting MPV Process: ${e}`);
      }
    }
  }

  public isPlaying(): boolean {
    return this._proc !== null;
  }

  public playPause(): void {
    const playPauseCommand = this.createCommand({ command: ['cycle', 'pause'] });
    this.sendCommandToMpvSocket(playPauseCommand);
    const result = this.getProperty('pause');
    writeLog({ message: `Toggling the pause state. Paused: ${result?.data}` });
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

  private async _monitorPlayerOutput({
    stream,
    onLine,
  }: {
    stream: Gio.DataInputStream;
    onLine: (line: string) => Promise<boolean | void>;
  }) {
    this._cancellable = new Gio.Cancellable();

    const readLine = async () => {
      if (!this._keepReading || this._proc === null) return;

      const [bytes] = await stream.read_line_async(GLib.PRIORITY_DEFAULT, this._cancellable);
      if (this._cancellable?.is_cancelled()) {
        this._cancellable = null;
        return;
      }

      const line = new TextDecoder('utf-8').decode(bytes);

      if (line !== null) {
        writeLog({ message: `MPV OUTPUT: ${line}`, type: 'INFO' }).catch(log);
        const keep = await onLine(line);
        if (keep === false) {
          this._keepReading = false;
          return;
        }
      }

      if (this._keepReading) await readLine();
    };

    await readLine();
  }
  public async startPlayer(radio: Radio): Promise<void> {
    await this.stopPlayer(radio);
    if (radio.radioUrl.startsWith('~')) {
      radio.radioUrl = GLib.get_home_dir() + radio.radioUrl.slice(1);
    }
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
      await writeLog({ message: `Starting playing: ${radio.radioName} with the ${radio.radioUrl}` }).catch(log);
      this.emit('radio-changed', radio.radioName);

      this._stdoutStream = new Gio.DataInputStream({
        base_stream: this._proc.get_stdout_pipe(),
      });

      // Update MPRIS with new radio metadata
      if (this._mpris) {
        this._mpris.updateMetadata(radio);
      }
      this._monitorPlayerOutput({
        stream: this._stdoutStream,
        onLine: async (line) => {
          if (line.trim().startsWith('Failed')) {
            await this.stopPlayer(radio);
            Main.notifyError(`Error while playing: ${radio.radioName}`, line.trim());
            return false; // stops loop
          }
        },
      }).catch(log);
    } catch (e) {
      this._keepReading = false;
      this.stopPlayer(radio);
      writeLog({ message: 'MPV not found.', type: 'ERROR' }).catch(log);
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
    writeLog({ message: `Sending commando to mpv socket: ${mpvCommand}`, type: 'INFO' });
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

  public destroy(): void {
    if (this._mpris) {
      this._mpris.destroy();
      this._mpris = null;
    }
    this.stopPlayer();
    _instance = null;
  }
}
