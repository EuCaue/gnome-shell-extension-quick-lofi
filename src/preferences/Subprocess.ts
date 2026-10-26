import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async', 'communicate_utf8_finish');

export type RunResult = { stdout: string; stderr: string; succeeded: boolean; timedOut: boolean };

// Main loop sources must be removed when the preferences window closes, even mid-run.
const pendingRuns = new Set<{ proc: Gio.Subprocess; timer: number }>();

// Removes pending timers and kills their processes. Call this on window close.
export function cancelPendingRuns(): void {
  for (const { proc, timer } of pendingRuns) {
    GLib.Source.remove(timer);
    proc.force_exit();
  }
  pendingRuns.clear();
}

export async function run(argv: string[], timeoutSeconds: number): Promise<RunResult> {
  const proc: Gio.Subprocess = Gio.Subprocess.new(
    argv,
    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
  );
  let timedOut: boolean = false;
  const pending = { proc, timer: 0 };
  pendingRuns.add(pending);
  pending.timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, timeoutSeconds, () => {
    timedOut = true;
    pendingRuns.delete(pending);
    proc.force_exit();
    return GLib.SOURCE_REMOVE;
  });
  try {
    const [stdout, stderr] = await proc.communicate_utf8_async(null, null);
    return { stdout: stdout ?? '', stderr: stderr ?? '', succeeded: proc.get_successful(), timedOut };
  } finally {
    // The set entry doubles as a "timer still live" flag: the timeout and cancelPendingRuns()
    // delete it themselves, so a second remove here would log a "Source ID not found" critical.
    if (pendingRuns.delete(pending) && !timedOut) GLib.Source.remove(pending.timer);
  }
}
