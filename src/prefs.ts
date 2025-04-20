import Gtk4 from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import { ExtensionPreferences, gettext as _ } from '@girs/gnome-shell/extensions/prefs';
import Utils from './Utils';

type Shortcut = { settingsKey: string; title: string; subtitle?: string };

export default class GnomeRectanglePreferences extends ExtensionPreferences {
  private _settings?: Gio.Settings;
  private _radios: string[] = [];

  private _addRadio(radioName: string, radioUrl: string): void {
    const radioID = Utils.generateNanoIdWithSymbols(10);
    this._radios.push(`${radioName} - ${radioUrl} - ${radioID}`);
    this._settings!.set_strv('radios', this._radios);
  }

  private _handleErrorRadioRow(radioRow: Adw.EntryRow, errorMessage: string): void {
    const TIMEOUT_SECONDS = 3 as const;
    const currentRadioRowTitle = radioRow.get_title();
    radioRow.add_css_class('error');
    radioRow.set_title(errorMessage);
    GLib.timeout_add_seconds(GLib.PRIORITY_HIGH, TIMEOUT_SECONDS, () => {
      radioRow.set_title(currentRadioRowTitle);
      radioRow.remove_css_class('error');
      return GLib.SOURCE_REMOVE;
    });
  }

  private _populateRadios(radiosGroup: Adw.PreferencesGroup, window: Adw.PreferencesWindow): void {
    const listBox = radiosGroup.get_last_child().get_last_child().get_first_child() as Gtk4.ListBox;
    const dropTarget = Gtk4.DropTarget.new(Gtk4.ListBoxRow as unknown, Gdk.DragAction.MOVE);
    let dragIndex: number = -1;
    listBox.add_controller(dropTarget);
    for (let i = 0; i < this._radios.length; i++) {
      const [radioName, radioUrl, radioID] = this._radios[i].split(' - ');
      const radiosExpander = new Adw.ExpanderRow({
        title: _(radioName),
        cursor: new Gdk.Cursor({ name: 'pointer' }),
      });
      const nameRadioRow = new Adw.EntryRow({
        title: _('Radio Name'),
        text: _(radioName),
        showApplyButton: true,
      });
      const urlRadioRow = new Adw.EntryRow({ title: _('Radio URL'), text: _(radioUrl), showApplyButton: true });
      const removeButton = new Gtk4.Button({
        label: `Remove ${radioName}`,
        iconName: 'user-trash-symbolic',
        cursor: new Gdk.Cursor({ name: 'pointer' }),
        halign: Gtk4.Align.CENTER,
        valign: Gtk4.Align.CENTER,
      });

      removeButton.connect('clicked', () => {
        const dialog = new Adw.AlertDialog({
          heading: _(`Are you sure you want to delete ${radioName} ?`),
          closeResponse: 'cancel',
        });
        dialog.add_response('cancel', 'Cancel');
        dialog.add_response('ok', 'Ok');
        dialog.set_response_appearance('ok', Adw.ResponseAppearance.DESTRUCTIVE);
        dialog.choose(window, null, () => {});
        dialog.connect('response', (dialog, response) => {
          if (response === 'ok') {
            this._removeRadio(i, radioID);
            this._reloadRadios(radiosGroup, window);
          }
          dialog.close();
        });
      });

      nameRadioRow.connect('apply', (w) => {
        if (w.text.length < 2) {
          this._handleErrorRadioRow(w, 'Name must be at least 2 characters');
          w.set_text(radioName);
          return;
        }
        const index = this._radios.findIndex((entry) => entry.startsWith(radioName));
        this._updateRadio(index, 'radioName', w.text);
        radiosExpander.set_title(w.text);
      });
      urlRadioRow.connect('apply', (w) => {
        try {
          GLib.uri_is_valid(w.text, GLib.UriFlags.NONE);
          const index = this._radios.findIndex((entry) => entry.startsWith(radioName));
          this._updateRadio(index, 'radioUrl', w.text);
        } catch (e) {
          this._handleErrorRadioRow(w, 'Invalid URL');
          w.set_text(radioUrl);
        }
      });
      radiosExpander.add_row(nameRadioRow);
      radiosExpander.add_row(urlRadioRow);
      radiosExpander.add_row(removeButton);
      let dragX: number;
      let dragY: number;
      const dropController = new Gtk4.DropControllerMotion();

      const dragSource = new Gtk4.DragSource({
        actions: Gdk.DragAction.MOVE,
      });

      // adding controllers
      radiosExpander.add_controller(dragSource);
      radiosExpander.add_controller(dropController);

      // Drag handling
      dragSource.connect('prepare', (_source, x, y) => {
        dragX = x;
        dragY = y;

        const value = new GObject.Value();
        value.init(Gtk4.ListBoxRow);
        value.set_object(radiosExpander);
        dragIndex = radiosExpander.get_index();

        return Gdk.ContentProvider.new_for_value(value);
      });

      dragSource.connect('drag-begin', (_source, drag) => {
        const dragWidget = new Gtk4.ListBox();

        dragWidget.set_size_request(radiosExpander.get_width(), radiosExpander.get_height());
        dragWidget.add_css_class('boxed-list');

        const dragRow = new Adw.ActionRow({ title: radiosExpander.title });
        dragRow.add_prefix(
          new Gtk4.Image({
            icon_name: 'list-drag-handle-symbolic',
            css_classes: ['dim-label'],
          }),
        );

        dragWidget.append(dragRow);
        dragWidget.drag_highlight_row(dragRow);

        const icon = Gtk4.DragIcon.get_for_drag(drag) as Gtk4.DragIcon;
        icon.child = dragWidget;

        drag.set_hotspot(dragX, dragY);
      });

      dropController.connect('enter', () => {
        listBox.drag_highlight_row(radiosExpander);
      });

      dropController.connect('leave', () => {
        listBox.drag_unhighlight_row();
      });
      radiosGroup.add(radiosExpander);
    }

    // Drop Handling
    dropTarget.connect('drop', (_drop, dragedExpanderRow, _x, y) => {
      const targetRow = listBox.get_row_at_y(y);
      const targetIndex = targetRow.get_index();

      if (!dragedExpanderRow || !targetRow) {
        return false;
      }

      const [movedRadio] = this._radios.splice(dragIndex, 1);
      this._radios.splice(targetIndex, 0, movedRadio);
      targetRow.set_state_flags(Gtk4.StateFlags.NORMAL, true);
      listBox.remove(dragedExpanderRow);
      listBox.insert(dragedExpanderRow, targetIndex);
      this._settings!.set_strv('radios', this._radios);
      return true;
    });
  }

  private _reloadRadios(radiosGroup: Adw.PreferencesGroup, window: Adw.PreferencesWindow) {
    let index = 0;
    const l = this._radios.length;
    while (l >= index) {
      const child = radiosGroup
        .get_first_child()
        .get_first_child()
        .get_next_sibling()
        .get_first_child()
        .get_first_child();
      if (child === null) break;
      radiosGroup.remove(child);
      index++;
    }
    this._populateRadios(radiosGroup, window);
  }

  private _removeRadio(index: number, radioID: string) {
    this._radios.splice(index, 1);
    if (radioID === this._settings.get_string('current-radio-playing')) {
      this._settings!.set_string('current-radio-playing', '');
    }
    this._settings!.set_strv('radios', this._radios);
  }

  private _updateRadio(index: number, field: 'radioUrl' | 'radioName', content: string): boolean {
    if (index !== -1) {
      const radio = this._radios[index];
      const [radioName, radioUrl, radioID] = radio.split(' - ');
      if (field === 'radioUrl') {
        this._radios[index] = `${radioName} - ${content} - ${radioID}`;
      }
      if (field === 'radioName') {
        this._radios[index] = `${content} - ${radioUrl} - ${radioID}`;
      }
      this._settings.set_strv('radios', this._radios);
      return true;
    }

    return false;
  }

  private _createShortcutButton(settingsKey: string) {
    function isValidAccel(mask: number, keyval: number) {
      return Gtk4.accelerator_valid(keyval, mask) || (keyval === Gdk.KEY_Tab && mask !== 0);
    }
    function keyvalIsForbidden(keyval: number) {
      return [
        // Navigation keys
        Gdk.KEY_Home,
        Gdk.KEY_Left,
        Gdk.KEY_Up,
        Gdk.KEY_Right,
        Gdk.KEY_Down,
        Gdk.KEY_Page_Up,
        Gdk.KEY_Page_Down,
        Gdk.KEY_End,
        Gdk.KEY_Tab,

        // Return
        Gdk.KEY_KP_Enter,
        Gdk.KEY_Return,

        Gdk.KEY_Mode_switch,
      ].includes(keyval);
    }
    function isValidBinding(mask: number, keycode: number, keyval: number) {
      return !(
        mask === 0 ||
        // @ts-expect-error "Gdk has SHIFT_MASK"
        (mask === Gdk.SHIFT_MASK &&
          keycode !== 0 &&
          ((keyval >= Gdk.KEY_a && keyval <= Gdk.KEY_z) ||
            (keyval >= Gdk.KEY_A && keyval <= Gdk.KEY_Z) ||
            (keyval >= Gdk.KEY_0 && keyval <= Gdk.KEY_9) ||
            (keyval >= Gdk.KEY_kana_fullstop && keyval <= Gdk.KEY_semivoicedsound) ||
            (keyval >= Gdk.KEY_Arabic_comma && keyval <= Gdk.KEY_Arabic_sukun) ||
            (keyval >= Gdk.KEY_Serbian_dje && keyval <= Gdk.KEY_Cyrillic_HARDSIGN) ||
            (keyval >= Gdk.KEY_Greek_ALPHAaccent && keyval <= Gdk.KEY_Greek_omega) ||
            (keyval >= Gdk.KEY_hebrew_doublelowline && keyval <= Gdk.KEY_hebrew_taf) ||
            (keyval >= Gdk.KEY_Thai_kokai && keyval <= Gdk.KEY_Thai_lekkao) ||
            (keyval >= Gdk.KEY_Hangul_Kiyeog && keyval <= Gdk.KEY_Hangul_J_YeorinHieuh) ||
            (keyval === Gdk.KEY_space && mask === 0) ||
            keyvalIsForbidden(keyval)))
      );
    }

    const shortcut = this._settings.get_strv(settingsKey)[0] ?? '';
    const shortcutLabel = new Gtk4.ShortcutLabel({
      disabled_text: _('New accelerator…'),
      accelerator: shortcut,
      valign: Gtk4.Align.CENTER,
      hexpand: false,
      vexpand: false,
    });
    const btn = new Gtk4.Button({ child: shortcutLabel, cursor: new Gdk.Cursor({ name: 'pointer' }) });
    function updateLabel() {
      shortcutLabel.set_accelerator(this._settings.get_strv(settingsKey)[0] ?? '');
    }

    btn.connect('clicked', (_source) => {
      const controllerKey = new Gtk4.EventControllerKey();
      const content = new Adw.StatusPage({
        title: _('New accelerator'),
        icon_name: 'preferences-desktop-keyboard-shortcuts-symbolic',
        description: _('Backspace to clear'),
      });

      const shortcutEditor = new Adw.Window({
        modal: true,
        hideOnClose: true,
        // @ts-expect-error "widget has get_root function"
        transient_for: _source.get_root(),
        widthRequest: 480,
        heightRequest: 320,
        content,
      });
      shortcutEditor.add_controller(controllerKey);
      controllerKey.connect('key-pressed', (_source, keyval, keycode, state) => {
        let mask = state & Gtk4.accelerator_get_default_mod_mask();
        mask &= ~Gdk.ModifierType.LOCK_MASK;

        if (!mask && keyval === Gdk.KEY_Escape) {
          shortcutEditor?.close();
          return Gdk.EVENT_STOP;
        }

        if (keyval === Gdk.KEY_BackSpace) {
          this._settings.set_strv(settingsKey, ['']);
          updateLabel.bind(this);
          shortcutEditor?.close();
          return Gdk.EVENT_STOP;
        }

        if (!isValidBinding(mask, keycode, keyval) || !isValidAccel(mask, keyval)) return Gdk.EVENT_STOP;

        if (!keyval && !keycode) {
          shortcutEditor?.destroy();
          return Gdk.EVENT_STOP;
        } else {
          const val = Gtk4.accelerator_name_with_keycode(null, keyval, keycode, mask);
          this._settings.set_strv(settingsKey, [val]);
          updateLabel.bind(this);
        }

        shortcutEditor?.destroy();
        return Gdk.EVENT_STOP;
      });
      shortcutEditor.present();
    });

    this._settings.connect(`changed::${settingsKey}`, () => {
      shortcutLabel.set_accelerator(this._settings.get_strv(settingsKey)[0] ?? '');
    });
    return btn;
  }

  private _createShorcutRow({ settingsKey, title, subtitle }: Shortcut) {
    const shortcutButton = this._createShortcutButton(settingsKey);
    const shortcutRow = new Adw.ActionRow({
      title: _(title),
      subtitle: subtitle ? _(subtitle) : '',
      activatable: true,
      activatableWidget: shortcutButton,
    });
    shortcutRow.add_suffix(shortcutButton);
    return shortcutRow;
  }

  private _handleShortcuts(adwGroup: Adw.PreferencesGroup) {
    const shortcuts: Array<Shortcut> = [
      {
        settingsKey: Utils.SHORTCUTS.PLAY_PAUSE_SHORTCUT,
        title: 'Play/Pause Quick Lofi',
        subtitle: 'Toggle between playing and pausing Quick Lofi.',
      },
      {
        settingsKey: Utils.SHORTCUTS.STOP_SHORTCUT,
        title: 'Stop Quick Lofi',
        subtitle: 'Stop Quick Lofi playback entirely.',
      },
    ];
    shortcuts.forEach((shortcut) => {
      const shortcutRow = this._createShorcutRow(shortcut);
      adwGroup.add(shortcutRow);
    });
  }

  fillPreferencesWindow(window: Adw.PreferencesWindow) {
    this._settings = this.getSettings();
    this._radios = this._settings.get_strv('radios');

    const page = new Adw.PreferencesPage({
      title: _('General'),
      icon_name: 'dialog-information-symbolic',
    });

    const playerGroup = new Adw.PreferencesGroup({
      title: _('Player Settings'),
      description: _('Configure the player settings'),
    });

    page.add(playerGroup);

    const volumeLevel = new Adw.SpinRow({
      title: _('Volume'),
      subtitle: _('Volume to set when playing lofi'),
      cursor: new Gdk.Cursor({ name: 'pointer' }),
      adjustment: new Gtk4.Adjustment({
        lower: 0,
        upper: 100,
        step_increment: 1,
      }),
    });

    playerGroup.add(volumeLevel);
    this._handleShortcuts(playerGroup);

    const popupGroup = new Adw.PreferencesGroup({
      title: _('Popup Settings'),
      description: _('Configure the popup behavior'),
    });

    const setPopupMaxHeightRow = new Adw.SwitchRow({
      title: _('Set Popup Max Height'),
      subtitle: _('Enable to set a maximum height for the popup'),
      cursor: new Gdk.Cursor({ name: 'pointer' }),
    });

    const popupMaxHeight = new Adw.EntryRow({
      title: _('Popup Max Height'),
      text: this._settings.get_string('popup-max-height'),
      visible: this._settings.get_boolean('set-popup-max-height'),
      showApplyButton: true,
    });

    popupMaxHeight.connect('apply', (w) => {
      const VALID_CSS_TYPES: Array<string> = ['px', 'pt', 'em', 'ex', 'rem', 'pc', 'in', 'cm', 'mm'];
      const regex = new RegExp(`^\\d+(\\.\\d+)?(${VALID_CSS_TYPES.join('|')})$`);
      if (!regex.test(w.text)) {
        const defaultValue = this._settings.get_default_value('popup-max-height').get_string()[0];
        this._handleErrorRadioRow(w, 'Invalid CSS value');
        w.set_text(defaultValue);
        this._settings.set_string('popup-max-height', defaultValue);
        return;
      }
      this._settings.set_string('popup-max-height', w.text);
      return;
    });
    popupGroup.add(setPopupMaxHeightRow);
    popupGroup.add(popupMaxHeight);
    page.add(popupGroup);

    const radiosGroup = new Adw.PreferencesGroup({
      title: _('Radios Settings'),
      description: _('Configure the radio list'),
    });

    this._populateRadios(radiosGroup, window);

    const addRadioGroup = new Adw.PreferencesGroup({
      title: _('Add Radio to the list'),
    });

    const nameRadioRow = new Adw.EntryRow({ title: _('Radio Name') });
    const urlRadioRow = new Adw.EntryRow({ title: _('Radio URL') });
    const addButton = new Gtk4.Button({
      label: _('Add Radio'),
      iconName: 'list-add-symbolic',
      cursor: new Gdk.Cursor({ name: 'pointer' }),
      halign: Gtk4.Align.CENTER,
      valign: Gtk4.Align.CENTER,
      marginTop: 10,
    });

    addButton.connect('clicked', () => {
      try {
        GLib.uri_is_valid(urlRadioRow.text, GLib.UriFlags.NONE); // test if it's a valid URL
        if (nameRadioRow.text.length < 2) {
          this._handleErrorRadioRow(nameRadioRow, 'Name must be at least 2 characters');
          return;
        }
        this._addRadio(nameRadioRow.text, urlRadioRow.text);
        nameRadioRow.set_text('');
        urlRadioRow.set_text('');
        this._reloadRadios(radiosGroup, window);
      } catch (e) {
        this._handleErrorRadioRow(urlRadioRow, 'Invalid URL');
        if (nameRadioRow.text.length < 2) {
          this._handleErrorRadioRow(nameRadioRow, 'Name must be at least 2 characters');
        }
      }
    });
    addRadioGroup.add(nameRadioRow);
    addRadioGroup.add(urlRadioRow);
    addRadioGroup.add(addButton);
    page.add(radiosGroup);
    page.add(addRadioGroup);

    window.connect('close-request', () => {
      this._settings = null;
      this._radios = null;
    });

    window.add(page);
    this._settings!.bind('volume', volumeLevel, 'value', Gio.SettingsBindFlags.DEFAULT);
    this._settings.bind('set-popup-max-height', setPopupMaxHeightRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    this._settings.bind('set-popup-max-height', popupMaxHeight, 'visible', Gio.SettingsBindFlags.DEFAULT);
  }
}
