import Gtk4 from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import { gettext as _ } from '@girs/gnome-shell/extensions/prefs';
import { writeLog } from '@utils/helpers';

export class ShortcutButton extends Gtk4.Button {
  private _label: Gtk4.ShortcutLabel;
  private _settingsKey: string;
  private _settings: Gio.Settings;

  static {
    GObject.registerClass(
      {
        GTypeName: 'ShortcutButton',
      },
      this,
    );
  }

  constructor(settings: Gio.Settings, settingsKey: string) {
    super();
    writeLog({ message: `[ShortcutButton] Initializing for key: ${settingsKey}`, type: 'INFO' });
    this._settings = settings;
    this._settingsKey = settingsKey;

    const shortcut = settings.get_strv(settingsKey)[0] ?? '';
    writeLog({ message: `[ShortcutButton] Current shortcut for ${settingsKey}: "${shortcut}"`, type: 'INFO' });

    this._label = new Gtk4.ShortcutLabel({
      disabled_text: _('New accelerator…'),
      accelerator: shortcut,
      valign: Gtk4.Align.CENTER,
    });

    this.set_child(this._label);
    this.set_cursor(new Gdk.Cursor({ name: 'pointer' }));

    this._settings.connect(`changed::${this._settingsKey}`, () => {
      const newShortcut = this._settings.get_strv(this._settingsKey)[0] ?? '';
      writeLog({ message: `[ShortcutButton] Shortcut changed for ${settingsKey}: "${newShortcut}"`, type: 'INFO' });
      this._label.set_accelerator(newShortcut);
    });

    this.connect('clicked', this._onClicked.bind(this));
    writeLog({ message: `[ShortcutButton] Shortcut button initialized for ${settingsKey}`, type: 'INFO' });
  }

  private _onClicked() {
    writeLog({ message: `[ShortcutButton] Opening shortcut editor for ${this._settingsKey}`, type: 'INFO' });
    const controllerKey = new Gtk4.EventControllerKey();
    const content = new Adw.StatusPage({
      title: _('New accelerator'),
      icon_name: 'preferences-desktop-keyboard-shortcuts-symbolic',
      description: _('Backspace to clear'),
    });

    const shortcutEditor = new Adw.Window({
      modal: true,
      hideOnClose: true,
      //@ts-expect-error root doesn't exist
      transient_for: this.get_root(),
      widthRequest: 480,
      heightRequest: 320,
      content,
    });

    const updateLabel = () => {
      const newShortcut = this._settings.get_strv(this._settingsKey)[0] ?? '';
      writeLog({ message: `[ShortcutButton] Updating label for ${this._settingsKey}: "${newShortcut}"`, type: 'INFO' });
      this._label.set_accelerator(newShortcut);
    };

    shortcutEditor.add_controller(controllerKey);
    controllerKey.connect('key-pressed', (_source, keyval, keycode, state) => {
      let mask = state & Gtk4.accelerator_get_default_mod_mask();
      mask &= ~Gdk.ModifierType.LOCK_MASK;

      const isValid = Gtk4.accelerator_valid(keyval, mask) || (keyval === Gdk.KEY_Tab && mask !== 0);
      const isForbidden = [
        Gdk.KEY_Home,
        Gdk.KEY_Left,
        Gdk.KEY_Up,
        Gdk.KEY_Right,
        Gdk.KEY_Down,
        Gdk.KEY_Page_Up,
        Gdk.KEY_Page_Down,
        Gdk.KEY_End,
        Gdk.KEY_Tab,
        Gdk.KEY_KP_Enter,
        Gdk.KEY_Return,
        Gdk.KEY_Mode_switch,
      ].includes(keyval);

      if (!mask && keyval === Gdk.KEY_Escape) {
        writeLog({
          message: `[ShortcutButton] User cancelled shortcut editing for ${this._settingsKey}`,
          type: 'INFO',
        });
        shortcutEditor.close();
        return Gdk.EVENT_STOP;
      }

      if (keyval === Gdk.KEY_BackSpace) {
        writeLog({ message: `[ShortcutButton] Clearing shortcut for ${this._settingsKey}`, type: 'INFO' });
        this._settings.set_strv(this._settingsKey, ['']);
        updateLabel();
        shortcutEditor.close();
        return Gdk.EVENT_STOP;
      }

      if (!isValid || isForbidden || (!keyval && !keycode)) {
        writeLog({
          message: `[ShortcutButton] Invalid shortcut combination ignored for ${this._settingsKey}`,
          type: 'WARN',
        });
        return Gdk.EVENT_STOP;
      }

      const val = Gtk4.accelerator_name_with_keycode(null, keyval, keycode, mask);
      writeLog({ message: `[ShortcutButton] Setting new shortcut for ${this._settingsKey}: "${val}"`, type: 'INFO' });
      this._settings.set_strv(this._settingsKey, [val]);
      updateLabel();
      shortcutEditor.close();
      return Gdk.EVENT_STOP;
    });

    shortcutEditor.present();
  }
  public createRow(title: string, subtitle?: string): Adw.ActionRow {
    writeLog({ message: `[ShortcutButton] Creating row for shortcut: ${title}`, type: 'INFO' });
    const row = new Adw.ActionRow({
      title: _(title),
      subtitle: subtitle ? _(subtitle) : '',
      activatable: true,
      activatableWidget: this,
    });
    row.add_suffix(this);
    writeLog({ message: `[ShortcutButton] Row created for shortcut: ${title}`, type: 'INFO' });
    return row;
  }
}
