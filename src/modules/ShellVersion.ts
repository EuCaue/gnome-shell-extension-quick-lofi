import * as Config from '@girs/gnome-shell/misc/config';

// Major version of the running GNOME Shell, for the few APIs that differ between supported versions.
export const shellMajor = Number.parseInt(Config.PACKAGE_VERSION, 10);
