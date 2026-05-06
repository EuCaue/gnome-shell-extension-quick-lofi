import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from '@girs/gnome-shell/ui/main';
import GObject from 'gi://GObject';
import { type Radio } from '@/types';
import { SETTINGS_KEYS } from '@utils/constants';
import { findRadio, getExtSettings, writeLog } from '@/utils/helpers';
import { MprisController } from './Mpris';

type PlayerCommandString = string;
type PlayerCommand = {
  command: Array<string | boolean>;
};

type NavigationMode = 'auto' | 'radio';

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
          'playback-started': { param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_STRING] },
          'position-changed': { param_types: [GObject.TYPE_DOUBLE] },
          'duration-changed': { param_types: [GObject.TYPE_DOUBLE] },
          'seekable-changed': { param_types: [GObject.TYPE_BOOLEAN] },
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
  private _positionTimerId: number | null = null;

  static getInstance(): Player {
    if (!_instance) {
      _instance = new Player();
      _instance.initVolumeControl();
      _instance._mpris = MprisController.getInstance(_instance);
      if (_instance._settings.get_boolean(SETTINGS_KEYS.ENABLE_MPRIS)) {
        _instance._mpris.enable();
      }
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

  public seekTo(seconds: number): void {
    const command = this.createCommand({
      command: ['seek', `${seconds}`, 'absolute', 'exact'],
    });

    this.sendCommandToMpvSocket(command);
  }

  public next(mode: NavigationMode = 'auto'): Radio | undefined {
    if (this._proc) {
      if (mode === 'radio') {
        return this._nextRadio();
      }
      return this._nextAuto();
    }
  }

  public prev(mode: NavigationMode = 'auto'): Radio | undefined {
    if (this._proc) {
      if (mode === 'radio') {
        return this._prevRadio();
      }
      return this._prevAuto();
    }
  }

  private _nextAuto(): Radio | undefined {
    const playlistTotal = this.getProperty<number>('playlist-count')?.data ?? 0;
    const playlistPosition = this.getProperty<number>('playlist-pos')?.data ?? 0;

    const hasPlaylist = playlistTotal > 1;
    const isLastItem = playlistPosition >= playlistTotal - 1;
    const shouldLoopPlaylist =
      (this._settings
        .get_strv(SETTINGS_KEYS.MPV_ARGUMENTS)
        .slice()
        .reverse()
        .find((arg) => arg === '--loop-playlist' || arg.startsWith('--loop-playlist=')) || '--loop-playlist=no') !==
      '--loop-playlist=no';

    if (!hasPlaylist) {
      return this._nextRadio();
    }

    if (isLastItem && !shouldLoopPlaylist) {
      return this._nextRadio();
    }

    this.playlistNext();
    return;
  }

  private _nextRadio() {
    const nextRadio = findRadio((_radio, index, radios, currentRadioPlayingID) => {
      if (radios[index].id === currentRadioPlayingID) {
        return radios[(index + 1) % radios.length];
      }
      return undefined;
    });
    this.startPlayer(nextRadio);
    return nextRadio;
  }

  private _prevAuto(): Radio | undefined {
    const playlistTotal = this.getProperty<number>('playlist-count')?.data ?? 0;
    const playlistPosition = this.getProperty<number>('playlist-pos')?.data ?? 0;

    const hasPlaylist = playlistTotal > 1;
    const isFirstItem = playlistPosition <= 0; // zero-based
    const shouldLoopPlaylist =
      (this._settings
        .get_strv(SETTINGS_KEYS.MPV_ARGUMENTS)
        .slice()
        .reverse()
        .find((arg) => arg === '--loop-playlist' || arg.startsWith('--loop-playlist=')) || '--loop-playlist=no') !==
      '--loop-playlist=no';

    if (!hasPlaylist) {
      return this._prevRadio();
    }

    if (isFirstItem && !shouldLoopPlaylist) {
      return this._prevRadio();
    }

    this.playlistPrev();
    return undefined;
  }

  private _prevRadio() {
    const prevRadio = findRadio((_radio, index, radios, currentRadioPlayingID) => {
      if (radios[index].id === currentRadioPlayingID) {
        return radios[(index - 1 + radios.length) % radios.length];
      }
      return undefined;
    });
    this.startPlayer(prevRadio);
    return prevRadio;
  }

  public playlistNext() {
    const command = this.createCommand({ command: ['playlist-next'] });
    this.sendCommandToMpvSocket(command);
  }

  public playlistPrev() {
    const command = this.createCommand({ command: ['playlist-prev'] });
    this.sendCommandToMpvSocket(command);
  }

  public async stopPlayer(radio?: Partial<Radio>): Promise<void> {
    await writeLog({
      message: `Stopping radio: ID: ${radio?.id} Name: ${radio?.radioName} ${radio?.radioUrl}`,
    }).catch(log);
    this._keepReading = false;
    if (this._positionTimerId !== null) {
      GLib.source_remove(this._positionTimerId);
      this._positionTimerId = null;
    }

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

  public getProperty<T>(prop: string): { data: T; request_id: number; error: string } | null {
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
    //  TODO: make something in the UI for this
    //  --ytdl-raw-options-add=cookies-from-browser
    const DEFAULT: Array<string> = [
      '--no-video',
      `--input-ipc-server=${this._mpvSocket}`,
      `--volume=${this._settings.get_int(SETTINGS_KEYS.VOLUME)}`,
      `"${radio.radioUrl}"`,
    ];
    const MPV_OPTIONS: Array<string> = [...this._settings.get_strv(SETTINGS_KEYS.MPV_ARGUMENTS), ...DEFAULT];
    try {
      this._keepReading = true;
      const [_, argv] = GLib.shell_parse_argv(`mpv ${MPV_OPTIONS.join(' ')}`);
      this._proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
      await writeLog({ message: `Starting playing: ${radio.radioName} with the ${radio.radioUrl}` }).catch(log);
      this.emit('playback-started', radio.id, radio.radioName, radio.radioUrl);

      this._stdoutStream = new Gio.DataInputStream({
        base_stream: this._proc.get_stdout_pipe(),
      });

      this._startPositionUpdates();

      // Update MPRIS with new radio metadata
      if (this._mpris) {
        this._mpris.updateMetadata(radio);
      }
      this._monitorPlayerOutput({
        stream: this._stdoutStream,
        onLine: async (line) => {
          if (line.trim().startsWith('Failed') || line.trim().startsWith('Error')) {
            await this.stopPlayer(radio);
            Main.notifyError(`Error while playing: ${radio.radioName}`, line.trim());
            return false; // stops loop
          }
        },
      }).catch(log);
    } catch (e) {
      logError(e, 'QUICK LOFI ERROR');
      this._keepReading = false;
      this.stopPlayer(radio);
      writeLog({ message: 'MPV not found.', type: 'ERROR' }).catch(log);
      Main.notifyError(
        'MPV not found',
        'Did you have mpv installed?\nhttps://github.com/EuCaue/gnome-shell-extension-quick-lofi?tab=readme-ov-file#dependencies',
      );
    }
  }
  private _startPositionUpdates(): void {
    if (this._positionTimerId !== null) return;

    this._positionTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
      if (!this._proc) {
        this._positionTimerId = null;
        return GLib.SOURCE_REMOVE;
      }

      const position = this.getProperty<number>('playback-time')?.data ?? 0;
      const duration = this.getProperty<number>('duration')?.data ?? 0;
      const seekable = this.getProperty<boolean>('seekable')?.data ?? false;

      this.emit('position-changed', position);
      this.emit('duration-changed', duration);
      this.emit('seekable-changed', seekable);

      return GLib.SOURCE_CONTINUE;
    });
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
