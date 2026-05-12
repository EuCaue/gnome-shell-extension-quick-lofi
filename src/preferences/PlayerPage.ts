import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import { SETTINGS_KEYS, SHORTCUTS } from '@utils/constants';
import { Shortcut } from '@/types';
import { ShortcutButton } from '@/preferences/ShortcutButton';
import { handleErrorRow, writeLog } from '@utils/helpers';
import Gtk from '@girs/gtk-4.0';
import { debug } from '@/utils/debug';

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
  'org.mozilla.firefox': ['~/.var/app/org.mozilla.firefox/.mozilla'],
  'net.waterfox.waterfox': ['~/.var/app/net.waterfox.waterfox/.waterfox'],
  'io.gitlab.librewolf-community': ['~/.var/app/io.gitlab.librewolf-community/.librewolf'],
  'io.filo.zen': ['~/.var/app/io.filo.zen/.zen'],
  'com.google.Chrome': ['~/.var/app/com.google.Chrome/config/google-chrome'],
  'org.chromium.Chromium': ['~/.var/app/org.chromium.Chromium/config/chromium'],
  'com.brave.Browser': ['~/.var/app/com.brave.Browser/config/BraveSoftware/Brave-Browser'],
  'com.microsoft.Edge': ['~/.var/app/com.microsoft.Edge/config/microsoft-edge'],
};

function resolveFlatpakCookiesPath(appId: string): string | null {
  const candidates = FLATPAK_COOKIES_CANDIDATES[appId];
  if (!candidates) return null;
  for (const candidate of candidates) {
    const expanded = candidate.replace('~', GLib.get_home_dir());
    if (GLib.file_test(expanded, GLib.FileTest.IS_DIR)) {
      return candidate;
    }
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
        ],
      },
      this,
    );
  }
  declare private _playerGroup: Adw.PreferencesGroup;
  declare private _volumeLevel: Adw.SpinRow;
  declare private _enableMpris: Adw.SwitchRow;
  declare private _enableMiniPlayer: Adw.SwitchRow;
  declare private _mpvArguments: Adw.EntryRow;
  declare private _cookiesFromBrowser: Adw.ComboRow;
  declare private _browsers: Gtk.StringList;
  declare private _customCookiesFromBrowser: Adw.EntryRow;

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
    const currentBrowser = this._settings.get_string(SETTINGS_KEYS.COOKIES_FROM_BROWSER).split(' - ')[0];
    debug('CURRENTBROWSER', currentBrowser);

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
          const ytdlp = cookiesPath ? `${engine}:${cookiesPath}` : '';
          return { name: `${name} (Flatpak)`, ytdlp };
        }

        const exeName = (app.get_executable() ?? '').split('/').pop() ?? '';
        const ytdlp = BROWSER_YTDLP_MAP[exeName] ?? '';
        return { name, ytdlp };
      });
    availableBrowsers.unshift({ name: 'Other', ytdlp: 'other' });
    availableBrowsers.unshift({ name: 'None', ytdlp: '' });
    debug('AVAIL: ', availableBrowsers);

    for (const browser of availableBrowsers) {
      this._browsers.append(browser.name);
    }

    if (currentBrowser !== 'None') {
      for (const index in availableBrowsers) {
        const browser = availableBrowsers[index];
        if (currentBrowser === browser.name) {
          debug('Found Browser: ', currentBrowser);
          this._cookiesFromBrowser.set_selected(parseInt(index));
          break;
        }
      }
    } else {
      debug('HERE INSIDE NONE');
      this._cookiesFromBrowser.set_selected(Gtk.INVALID_LIST_POSITION);
    }

    this._cookiesFromBrowser.connect('notify::selected', (row) => {
      const browserIdx = row.get_selected();
      const selectedBrowser = availableBrowsers[browserIdx];
      debug('BROWSER SELECTED:', selectedBrowser);
      const value = `${selectedBrowser.name} - ${selectedBrowser.ytdlp}`;
      debug('VALUE :', value);
      if (selectedBrowser.name === 'Other') {
        debug('OTHER: ', selectedBrowser);
        this._customCookiesFromBrowser.set_visible(true);
        this._customCookiesFromBrowser.connect('apply', (row) => {
          const customBrowser = row.get_text();
          debug('CUSTOM BROWSER:', customBrowser);
          const customValue = `${selectedBrowser.name} - ${customBrowser}`;
          debug('CUSTOM VALUE:', customValue);
          this._settings.set_string(SETTINGS_KEYS.COOKIES_FROM_BROWSER, customValue);
        });
        return;
      }
      this._settings.set_string(SETTINGS_KEYS.COOKIES_FROM_BROWSER, value);
      this._customCookiesFromBrowser.set_visible(false);
    });
  }

  constructor(private _settings: Gio.Settings) {
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
