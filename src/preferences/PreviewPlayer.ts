import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { gettext as _ } from '@girs/gnome-shell/extensions/prefs';
import { buildPreviewArgv, parsePreviewStatus, PREVIEW_SECONDS, previewFailed } from '@/preferences/PreviewArgs';
import { SETTINGS_KEYS } from '@/shared/constants';
import { writeLog } from '@/shared/log';
import { cookiesFromBrowserValue, getExtSettings } from '@/shared/settings';

const MPRIS_NAME = 'org.mpris.MediaPlayer2.QuickLofi';
const MPRIS_PATH = '/org/mpris/MediaPlayer2';
const MPRIS_IFACE = 'org.mpris.MediaPlayer2.Player';

let _proc: Gio.Subprocess | null = null;
let _stream: Gio.DataInputStream | null = null;
let _cancellable: Gio.Cancellable | null = null;
let _timeoutId: number | null = null;
let _onFinished: ((error?: string) => void) | null = null;
let _onProgress: ((elapsed: number, duration: number | null) => void) | null = null;
let _wasPlaying = false;
let _proxy: Gio.DBusProxy | null = null;

function mprisProxy(): Gio.DBusProxy | null {
  if (_proxy) return _proxy;
  try {
    _proxy = Gio.DBusProxy.new_sync(
      Gio.bus_get_sync(Gio.BusType.SESSION, null),
      Gio.DBusProxyFlags.NONE,
      null,
      MPRIS_NAME,
      MPRIS_PATH,
      MPRIS_IFACE,
      null,
    );
    return _proxy;
  } catch {
    return null;
  }
}

function callMpris(method: string): void {
  const proxy = mprisProxy();
  if (!proxy) return;
  try {
    proxy.call_sync(method, null, Gio.DBusCallFlags.NONE, -1, null);
  } catch {
    // The Shell extension may go away while Preferences is open.
  }
}

function pauseShell(): void {
  if (!getExtSettings().get_boolean(SETTINGS_KEYS.ENABLE_MPRIS)) return;
  const proxy = mprisProxy();
  if (!proxy) return;
  try {
    const reply = proxy.call_sync(
      'org.freedesktop.DBus.Properties.Get',
      new GLib.Variant('(ss)', [MPRIS_IFACE, 'PlaybackStatus']),
      Gio.DBusCallFlags.NONE,
      -1,
      null,
    );
    const [status] = reply.deepUnpack() as [string];
    if (status !== 'Playing') return;
    callMpris('Pause');
    _wasPlaying = true;
  } catch {
    // No PlaybackStatus: preview plays independently instead of blocking.
  }
}

function resumeShell(): void {
  if (!_wasPlaying) return;
  _wasPlaying = false;
  callMpris('Play');
}

function finish(error?: string): void {
  const callback = _onFinished;
  _onFinished = null;
  callback?.(error);
}

function clearPreviewTimeout(): void {
  if (_timeoutId === null) return;
  GLib.Source.remove(_timeoutId);
  _timeoutId = null;
}

export function isPreviewing(): boolean {
  return _proc !== null;
}

function closeStream(stream: Gio.DataInputStream | null): void {
  if (!stream || _stream !== stream) return;
  _stream = null;
  try {
    stream.close(null);
  } catch {
    // The pipe may already be closed by mpv exiting.
  }
}

function readStatus(stream: Gio.DataInputStream, proc: Gio.Subprocess, cancellable: Gio.Cancellable): void {
  stream.read_line_async(GLib.PRIORITY_DEFAULT, cancellable, (_source, res) => {
    let line: string | null;
    try {
      [line] = stream.read_line_finish_utf8(res);
    } catch {
      // Cancelled on stop or the pipe closed at EOF.
      closeStream(stream);
      return;
    }
    if (line === null) {
      closeStream(stream);
      return;
    }
    if (_proc !== proc) return;
    const status = parsePreviewStatus(line);
    if (status) _onProgress?.(status.elapsed, status.duration);
    readStatus(stream, proc, cancellable);
  });
}

export function startPreview(
  url: string,
  cookiesFromBrowser: string,
  onProgress: (elapsed: number, duration: number | null) => void,
  onFinished: (error?: string) => void,
): void {
  if (_proc) stopPreview();

  const settings = getExtSettings();
  const cookiesValue = cookiesFromBrowserValue(cookiesFromBrowser);
  const jsRuntime = GLib.find_program_in_path('node') ? 'node' : GLib.find_program_in_path('deno') ? 'deno' : null;
  const argv = buildPreviewArgv(url, cookiesValue, jsRuntime, settings.get_int(SETTINGS_KEYS.VOLUME));

  _onFinished = onFinished;
  _onProgress = onProgress;
  _cancellable = new Gio.Cancellable();
  pauseShell();

  let proc: Gio.Subprocess;
  try {
    proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE);
  } catch (e) {
    writeLog({ message: `[PreviewPlayer] failed to start mpv: ${e}`, type: 'ERROR' });
    _cancellable.cancel();
    _cancellable = null;
    _onProgress = null;
    resumeShell();
    finish(_('Preview failed'));
    return;
  }
  _proc = proc;

  const stream = new Gio.DataInputStream({
    base_stream: proc.get_stdout_pipe(),
    newlineType: Gio.DataStreamNewlineType.ANY,
  });
  _stream = stream;
  readStatus(stream, proc, _cancellable);
  _timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, PREVIEW_SECONDS, () => {
    _timeoutId = null;
    finish();
    stopPreview();
    return GLib.SOURCE_REMOVE;
  });

  proc.wait_async(null, (_source, res) => {
    try {
      proc.wait_finish(res);
    } catch (e) {
      writeLog({ message: `[PreviewPlayer] mpv exited with error: ${e}`, type: 'WARN' });
    }
    if (_proc !== proc) return;
    const failed = previewFailed(proc.get_exit_status(), proc.get_if_signaled());
    _proc = null;
    clearPreviewTimeout();
    _cancellable?.cancel();
    _cancellable = null;
    _onProgress = null;
    closeStream(_stream);
    resumeShell();
    finish(failed ? _('Preview failed') : undefined);
  });
}

export function stopPreview(): void {
  clearPreviewTimeout();
  _onFinished = null;
  _onProgress = null;
  _cancellable?.cancel();
  _cancellable = null;
  closeStream(_stream);
  const proc = _proc;
  _proc = null;
  if (proc) proc.force_exit();
  resumeShell();
}
