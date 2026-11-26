import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { buildPreviewArgv } from '@/preferences/PreviewArgs';
import { SETTINGS_KEYS } from '@/shared/constants';
import { writeLog } from '@/shared/log';
import { cookiesFromBrowserValue, getExtSettings } from '@/shared/settings';

const MPRIS_NAME = 'org.mpris.MediaPlayer2.QuickLofi';
const MPRIS_PATH = '/org/mpris/MediaPlayer2';
const MPRIS_IFACE = 'org.mpris.MediaPlayer2.Player';

let _proc: Gio.Subprocess | null = null;
let _onFinished: ((error?: string) => void) | null = null;
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

export function isPreviewing(): boolean {
  return _proc !== null;
}

export function startPreview(url: string, cookiesFromBrowser: string, onFinished: (error?: string) => void): void {
  if (_proc) stopPreview();

  const settings = getExtSettings();
  const cookiesValue = cookiesFromBrowserValue(cookiesFromBrowser);
  const jsRuntime = GLib.find_program_in_path('node') ? 'node' : GLib.find_program_in_path('deno') ? 'deno' : null;
  const argv = buildPreviewArgv(url, cookiesValue, jsRuntime, settings.get_int(SETTINGS_KEYS.VOLUME));

  _onFinished = onFinished;
  pauseShell();

  let proc: Gio.Subprocess;
  try {
    proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
  } catch (e) {
    writeLog({ message: `[PreviewPlayer] failed to start mpv: ${e}`, type: 'ERROR' });
    resumeShell();
    finish(String(e));
    return;
  }
  _proc = proc;

  proc.wait_async(null, (_source, res) => {
    try {
      proc.wait_finish(res);
    } catch (e) {
      writeLog({ message: `[PreviewPlayer] mpv exited with error: ${e}`, type: 'WARN' });
    }
    if (_proc !== proc) return;
    _proc = null;
    resumeShell();
    finish();
  });
}

export function stopPreview(): void {
  _onFinished = null;
  const proc = _proc;
  _proc = null;
  if (proc) proc.force_exit();
  resumeShell();
}
