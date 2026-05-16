import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from '@girs/gtk-4.0';
import { SETTINGS_KEYS, SHORTCUTS } from '@utils/constants';
import { handleErrorRow, writeLog } from '@utils/helpers';
import { ShortcutButton } from '@/preferences/ShortcutButton';
import type { Shortcut } from '@/types';
import { debug } from '@/utils/debug';

const BROWSER_YTDLP: Array<string> = [
  'brave',
  'chrome',
  'chromium',
  'edge',
  'firefox',
  'opera',
  'safari',
  'vivaldi',
  'whale',
];

const BROWSER_YTDLP_MAP: Record<string, string> = {
  // Chrome-based
  'google-chrome': 'chrome',
  'google-chrome-stable': 'chrome',
  chromium: 'chromium',
  'chromium-browser': 'chromium',
  'brave-browser': 'brave',
  'microsoft-edge': 'edge',
  'vivaldi-stable': 'vivaldi',
  opera: 'opera',
  // Firefox-based
  firefox: 'firefox',
  'firefox-esr': 'firefox',
  'zen-browser': 'firefox',
  waterfox: 'firefox',
  // Flatpak App IDs
  'com.google.Chrome': 'chrome',
  'org.chromium.Chromium': 'chromium',
  'com.brave.Browser': 'brave',
  'com.microsoft.Edge': 'edge',
  'org.mozilla.firefox': 'firefox',
  'net.waterfox.waterfox': 'firefox',
  'io.gitlab.librewolf-community': 'firefox',
  'io.filo.zen': 'firefox',
};

const FLATPAK_COOKIES_CANDIDATES: Record<string, string[]> = {
  'org.mozilla.firefox': ['~/.var/app/org.mozilla.firefox/.mozilla/firefox'],
  'net.waterfox.waterfox': ['~/.var/app/net.waterfox.waterfox/.waterfox'],
  'io.gitlab.librewolf-community': ['~/.var/app/io.gitlab.librewolf-community/.librewolf'],
  'io.filo.zen': ['~/.var/app/io.filo.zen/.zen'],
  'com.google.Chrome': ['~/.var/app/com.google.Chrome/config/google-chrome'],
  'org.chromium.Chromium': ['~/.var/app/org.chromium.Chromium/config/chromium'],
  'com.brave.Browser': ['~/.var/app/com.brave.Browser/config/BraveSoftware/Brave-Browser'],
  'com.microsoft.Edge': ['~/.var/app/com.microsoft.Edge/config/microsoft-edge'],
};

const NATIVE_BROWSERS_COOKIES_CANDIDATES: Record<string, string[]> = {
  firefox: ['~/.mozilla/firefox'],
  'firefox-esr': ['~/.mozilla/firefox'],
  'zen-browser': ['~/.zen'],
  waterfox: ['~/.waterfox'],
  librewolf: ['~/.librewolf'],
  chrome: ['~/.config/google-chrome'],
  'google-chrome': ['~/.config/google-chrome'],
  chromium: ['~/.config/chromium'],
  'chromium-browser': ['~/.config/chromium'],
  brave: ['~/.config/BraveSoftware/Brave-Browser'],
  'brave-browser': ['~/.config/BraveSoftware/Brave-Browser'],
  'microsoft-edge': ['~/.config/microsoft-edge'],
  opera: ['~/.config/opera'],
  vivaldi: ['~/.config/vivaldi'],
  'vivaldi-stable': ['~/.config/vivaldi'],
};

const FIREFOX_ENGINES: Array<string> = ['firefox', 'firefox-esr', 'zen-browser', 'waterfox', 'librewolf'];

const CHROMIUM_ENGINES: Array<string> = [
  'chrome',
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
  'brave',
  'brave-browser',
  'microsoft-edge',
  'opera',
  'vivaldi',
  'vivaldi-stable',
];

function getFirefoxDefaultProfile(basePath: string): string | null {
  try {
    const installsPath = GLib.build_filenamev([basePath, 'installs.ini']);

    if (GLib.file_test(installsPath, GLib.FileTest.EXISTS)) {
      const [, contents] = GLib.file_get_contents(installsPath);
      const text = new TextDecoder().decode(contents);

      const match = text.match(/^Default=(.+)$/m);

      if (match?.[1]) {
        return GLib.build_filenamev([basePath, match[1].trim()]);
      }
    }

    const profilesPath = GLib.build_filenamev([basePath, 'profiles.ini']);

    if (GLib.file_test(profilesPath, GLib.FileTest.EXISTS)) {
      const [, contents] = GLib.file_get_contents(profilesPath);
      const text = new TextDecoder().decode(contents);

      const profileBlocks = text.split(/\[Profile\d+\]/);

      for (const block of profileBlocks) {
        if (block.includes('Default=1')) {
          const pathMatch = block.match(/^Path=(.+)$/m);

          if (pathMatch?.[1]) {
            return GLib.build_filenamev([basePath, pathMatch[1].trim()]);
          }
        }
      }
    }
  } catch (e) {
    log(`[ QUICK LOFI ] Failed to resolve Firefox profile: ${e}`);
  }
  return null;
}

function getChromiumDefaultProfile(baseDir: string): string | null {
  const localState = GLib.build_filenamev([baseDir, 'Local State']);

  if (!GLib.file_test(localState, GLib.FileTest.EXISTS)) {
    return null;
  }

  try {
    const [ok, contents] = GLib.file_get_contents(localState);

    if (!ok) return null;

    const text = new TextDecoder().decode(contents);
    const json = JSON.parse(text);
    const profileName = json.profile?.last_used ?? 'Default';
    const profilePath = GLib.build_filenamev([baseDir, profileName]);

    if (GLib.file_test(profilePath, GLib.FileTest.IS_DIR)) {
      return profilePath;
    }
  } catch (error) {
    debug('ERROR PARSING CHROMIUM PROFILE:', error);
  }

  return null;
}

function resolveBrowserProfile(baseDir: string, browserId: string): string | null {
  if (FIREFOX_ENGINES.includes(browserId)) {
    return getFirefoxDefaultProfile(baseDir);
  }

  if (CHROMIUM_ENGINES.includes(browserId)) {
    return getChromiumDefaultProfile(baseDir);
  }

  return null;
}

function resolveFlatpakCookiesPath(appId: string): string | null {
  const candidates = FLATPAK_COOKIES_CANDIDATES[appId];
  if (!candidates) return null;

  for (const candidate of candidates) {
    const expanded = candidate.replace('~', GLib.get_home_dir());
    if (!GLib.file_test(expanded, GLib.FileTest.IS_DIR)) {
      continue;
    }
    const profile = resolveBrowserProfile(expanded, appId);
    if (profile) {
      return profile;
    }
    return expanded;
  }
  return null;
}

function resolveNativeCookiesPath(exeName: string): string | null {
  const candidates = NATIVE_BROWSERS_COOKIES_CANDIDATES[exeName];
  if (!candidates) return null;
  for (const candidate of candidates) {
    const expanded = candidate.replace('~', GLib.get_home_dir());
    if (!GLib.file_test(expanded, GLib.FileTest.IS_DIR)) {
      continue;
    }
    const profile = resolveBrowserProfile(expanded, exeName);
    if (profile) {
      return profile;
    }
    return expanded;
  }
  return null;
}

type Browser = {
  name: string;
  ytdlp: string;
};

export class PlayerPage extends Adw.PreferencesPage {
  static {
    GObject.registerClass(
      {
        GTypeName: 'PlayerPage',
        Template: 'resource:///org/gnome/Shell/Extensions/quick-lofi/preferences/PlayerPage.ui',
        InternalChildren: [
          'volumeLevel',
          'playerGroup',
          'enableMpris',
          'mpvArguments',
          'enableMiniPlayer',
          'cookiesFromBrowser',
          'browsers',
          'customCookiesFromBrowser',
          'cookiesFromBrowserInfo',
        ],
      },
      this,
    );
  }
  private declare _playerGroup: Adw.PreferencesGroup;
  private declare _volumeLevel: Adw.SpinRow;
  private declare _enableMpris: Adw.SwitchRow;
  private declare _enableMiniPlayer: Adw.SwitchRow;
  private declare _mpvArguments: Adw.EntryRow;
  private declare _cookiesFromBrowser: Adw.ComboRow;
  private declare _browsers: Gtk.StringList;
  private declare _customCookiesFromBrowser: Adw.EntryRow;
  private declare _cookiesFromBrowserInfo: Gtk.Button;

  private _handleShortcuts() {
    writeLog({ message: '[PlayerPage] Setting up keyboard shortcuts', type: 'INFO' });
    const shortcuts: Array<Shortcut> = [
      {
        settingsKey: SHORTCUTS.PLAY_PAUSE_SHORTCUT,
        title: 'Play or Pause',
        subtitle: 'Toggle playback of Quick Lofi.',
      },
      {
        settingsKey: SHORTCUTS.STOP_SHORTCUT,
        title: 'Stop Playback',
        subtitle: 'Stop Quick Lofi completely.',
      },
      {
        settingsKey: SHORTCUTS.INCREASE_VOLUME_SHORTCUT,
        title: 'Increase Volume',
        subtitle: 'Raise the volume by the system step.',
      },
      {
        settingsKey: SHORTCUTS.DECREASE_VOLUME_SHORTCUT,
        title: 'Decrease Volume',
        subtitle: 'Lower the volume by the system step.',
      },
      {
        settingsKey: SHORTCUTS.NEXT_SHORTCUT,
        title: 'Next',
        subtitle: 'Go to the next playlist item or radio, following the playback flow.',
      },
      {
        settingsKey: SHORTCUTS.PREVIOUS_SHORTCUT,
        title: 'Previous',
        subtitle: 'Go to the previous playlist item or radio, following the playback flow.',
      },
      {
        settingsKey: SHORTCUTS.NEXT_RADIO_SHORTCUT,
        title: 'Next Radio',
        subtitle: 'Skip to the next radio, ignoring the current playlist.',
      },
      {
        settingsKey: SHORTCUTS.PREVIOUS_RADIO_SHORTCUT,
        title: 'Previous Radio',
        subtitle: 'Go to the previous radio, ignoring the current playlist.',
      },
    ];

    shortcuts.forEach((shortcut) => {
      writeLog({ message: `[PlayerPage] Creating shortcut button for: ${shortcut.title}`, type: 'INFO' });
      const shortcutButton = new ShortcutButton(this._settings, shortcut.settingsKey);
      const shortcutRow = shortcutButton.createRow(shortcut.title, shortcut.subtitle);
      this._playerGroup.add(shortcutRow);
    });

    writeLog({ message: `[PlayerPage] Created ${shortcuts.length} shortcut rows`, type: 'INFO' });
  }

  private _handleMpvArguments(w: Adw.EntryRow) {
    let args = w.text;
    if (args.length === 0) {
      handleErrorRow(w, 'Not recommeded making this empty.');
    }
    if (args.lastIndexOf(',') === args.length - 1) {
      args = args.substring(0, args.length - 1);
    }
    const regex = /^(--[\w-]+(=(("[^"]*")|('[^']*')|[^,\s]+))?,?\s*)*$/;
    if (regex.test(args)) {
      const finalArgs: Array<string> = args.split(/,\s*/);
      this._settings.set_strv(SETTINGS_KEYS.MPV_ARGUMENTS, finalArgs);
      w.set_text(finalArgs.join(', '));
    } else {
      handleErrorRow(w, 'Wrong format (--option=value)');
      return;
    }
  }

  private _handleMpvArgumentsButtons() {
    const tooltipButton = new Gtk.Button({
      iconName: 'help-about',
      cursor: new Gdk.Cursor({ name: 'help' }),
      valign: Gtk.Align.CENTER,
    });
    tooltipButton.tooltipMarkup = `<b>Advanced MPV arguments</b>
These are passed directly to the player on startup.
<span foreground="orange"><b>⚠ Handle with care.</b></span> If playback breaks, use the reset button to restore defaults.`;

    const resetButton = new Gtk.Button({
      iconName: 'folder-backup-symbolic',
      cursor: new Gdk.Cursor({ name: 'pointer' }),
      valign: Gtk.Align.CENTER,
    });
    resetButton.set_tooltip_text('Something went wrong? Reset all arguments back to their default values.');
    resetButton.connect('clicked', () => {
      const defaultValues = this._settings.get_default_value(SETTINGS_KEYS.MPV_ARGUMENTS).get_strv();
      this._settings.set_strv(SETTINGS_KEYS.MPV_ARGUMENTS, defaultValues);
      this._mpvArguments.set_text(defaultValues.join(', '));
    });

    this._mpvArguments.add_suffix(tooltipButton);
    this._mpvArguments.add_suffix(resetButton);
  }

  private _setupMpvArgumentsBehavior() {
    const row = this._mpvArguments;
    const getSaved = () => this._settings.get_strv(SETTINGS_KEYS.MPV_ARGUMENTS).join(', ');
    const updateApplyButton = () => {
      row.set_show_apply_button(row.text !== getSaved());
    };
    row.connect('changed', updateApplyButton);
    row.connect('apply', (w) => {
      this._handleMpvArguments(w);
      updateApplyButton();
    });
    updateApplyButton();
  }

  private _handleCookieFromBrowser() {
    if (GLib.find_program_in_path('node') === null && GLib.find_program_in_path('deno') === null) {
      this._cookiesFromBrowser.set_activatable(false);
      this._cookiesFromBrowserInfo.set_visible(true);
      return;
    }
    const currentBrowser = this._settings.get_string(SETTINGS_KEYS.COOKIES_FROM_BROWSER).split(' - ')[0];

    const availableBrowsers: Array<Browser> = Gio.AppInfo.get_all()
      .filter((app) => {
        const types = app.get_supported_types();
        return types?.includes('x-scheme-handler/http') || types?.includes('x-scheme-handler/https');
      })
      .map((app) => {
        const name = app.get_display_name();
        const cmd = app.get_commandline() ?? '';
        const isFlatpak = cmd.includes('flatpak run');

        if (isFlatpak) {
          const parts = cmd.split(' ');
          const appId = parts.find((part) => /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9._-]+$/.test(part)) ?? '';
          const engine = BROWSER_YTDLP_MAP[appId] ?? '';
          if (!engine) return null;
          const cookiesPath = resolveFlatpakCookiesPath(appId);
          const ytdlp = cookiesPath ? `${engine}:${cookiesPath}` : engine;
          return {
            name: `${name} (Flatpak)`,
            ytdlp,
          };
        }
        const exeName = (app.get_executable() ?? '').split('/').pop() ?? '';
        const engine = BROWSER_YTDLP_MAP[exeName] ?? '';
        if (!engine) return null;
        const cookiesPath = resolveNativeCookiesPath(exeName);
        const ytdlp = cookiesPath ? `${engine}:${cookiesPath}` : engine;
        return {
          name,
          ytdlp,
        };
      })
      .filter((browser): browser is Browser => browser !== null);

    availableBrowsers.unshift({ name: 'Other', ytdlp: 'other' });
    availableBrowsers.unshift({ name: 'None', ytdlp: '' });

    for (const browser of availableBrowsers) {
      this._browsers.append(browser.name);
    }

    if (currentBrowser !== 'None') {
      for (const index in availableBrowsers) {
        const browser = availableBrowsers[index];
        if (currentBrowser === browser.name) {
          this._cookiesFromBrowser.set_selected(parseInt(index, 10));
          if (browser.name === 'Other') {
            this._customCookiesFromBrowser.set_visible(true);
            this._customCookiesFromBrowser.set_text(
              this._settings.get_string(SETTINGS_KEYS.COOKIES_FROM_BROWSER).split(' - ')[1],
            );
          }
          break;
        }
      }
    } else {
      this._cookiesFromBrowser.set_selected(Gtk.INVALID_LIST_POSITION);
    }

    this._cookiesFromBrowser.connect('notify::selected', (row) => {
      const browserIdx = row.get_selected();
      const selectedBrowser = availableBrowsers[browserIdx];
      const value = `${selectedBrowser.name} - ${selectedBrowser.ytdlp}`;
      if (selectedBrowser.name === 'Other') {
        this._customCookiesFromBrowser.set_visible(true);
        this._customCookiesFromBrowser.set_text('');
        this._customCookiesFromBrowser.connect('apply', (row) => {
          const customBrowser = row.get_text().trim();
          const [browser, ..._rest] = customBrowser.split(':');
          const browserKey = browser.toLocaleLowerCase();
          if (!BROWSER_YTDLP.includes(browserKey)) {
            const label = new Gtk.Label({
              label: `"${browser}" is not a supported engine. Supported engines are: ${BROWSER_YTDLP.join(', ')}.`,
              wrap: true,
              max_width_chars: 40,
              justify: Gtk.Justification.CENTER,
            });
            const toast = new Adw.Toast();
            toast.set_custom_title(label);
            this._window.add_toast(toast);
            return;
          }

          const customValue = `${selectedBrowser.name} - ${customBrowser}`;
          this._settings.set_string(SETTINGS_KEYS.COOKIES_FROM_BROWSER, customValue);
        });
        return;
      }
      this._settings.set_string(SETTINGS_KEYS.COOKIES_FROM_BROWSER, value);
      this._customCookiesFromBrowser.set_visible(false);
    });
  }

  constructor(
    private _settings: Gio.Settings,
    private _window: Adw.PreferencesWindow,
  ) {
    super();
    writeLog({ message: '[PlayerPage] Initializing player preferences page', type: 'INFO' });
    this._settings.bind(SETTINGS_KEYS.VOLUME, this._volumeLevel, 'value', Gio.SettingsBindFlags.DEFAULT);
    this._settings.bind(SETTINGS_KEYS.ENABLE_MPRIS, this._enableMpris, 'active', Gio.SettingsBindFlags.DEFAULT);
    this._settings.bind(
      SETTINGS_KEYS.ENABLE_MINI_PLAYER,
      this._enableMiniPlayer,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    );

    this._mpvArguments.set_text(this._settings.get_strv(SETTINGS_KEYS.MPV_ARGUMENTS).join(', '));
    this._handleMpvArgumentsButtons();
    this._setupMpvArgumentsBehavior();
    writeLog({ message: '[PlayerPage] Bound volume level to settings', type: 'INFO' });
    this._handleShortcuts();
    this._handleCookieFromBrowser();
    writeLog({ message: '[PlayerPage] Player preferences page initialized', type: 'INFO' });
  }
}
