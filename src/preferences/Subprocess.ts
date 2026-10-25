import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async', 'communicate_utf8_finish');

export type RunResult = { stdout: string; stderr: string; succeeded: boolean; timedOut: boolean };

export async function run(argv: string[], timeoutSeconds: number): Promise<RunResult> {
  const proc: Gio.Subprocess = Gio.Subprocess.new(
    argv,
    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
  );
  let timedOut: boolean = false;
  const timer: number = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, timeoutSeconds, () => {
    timedOut = true;
    proc.force_exit();
    return GLib.SOURCE_REMOVE;
  });
  try {
    const [stdout, stderr] = await proc.communicate_utf8_async(null, null);
    return { stdout: stdout ?? '', stderr: stderr ?? '', succeeded: proc.get_successful(), timedOut };
  } finally {
    if (!timedOut) GLib.Source.remove(timer);
  }
}
