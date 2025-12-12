import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk4 from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import { gettext as _ } from '@girs/gnome-shell/extensions/prefs';
import { ffmpegFormats, SETTINGS_KEYS } from '@utils/constants';
import { generateNanoIdWithSymbols, handleErrorRow, isUri } from '@utils/helpers';

export class RadiosPage extends Adw.PreferencesPage {
  private _radios: Array<string> = [];
  static {
    GObject.registerClass(
      {
        GTypeName: 'RadiosPage',
        Template: 'resource:///org/gnome/Shell/Extensions/quick-lofi/preferences/RadiosPage.ui',
        InternalChildren: ['radiosGroup', 'nameRadioRow', 'urlRadioRow'],
      },
      this,
    );
  }
  declare private _radiosGroup: Adw.PreferencesGroup;
  declare private _nameRadioRow: Adw.EntryRow;
  declare private _urlRadioRow: Adw.EntryRow;

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
      this._settings.set_strv(SETTINGS_KEYS.RADIOS_LIST, this._radios);
      return true;
    }

    return false;
  }
  private _removeRadio(index: number, radioID: string) {
    this._radios.splice(index, 1);
    if (radioID === this._settings.get_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING)) {
      this._settings!.set_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING, '');
    }
    this._settings!.set_strv(SETTINGS_KEYS.RADIOS_LIST, this._radios);
  }

  private _populateRadios(radiosGroup: Adw.PreferencesGroup): void {
    const listBox = radiosGroup.get_last_child().get_last_child().get_first_child() as Gtk4.ListBox;
    const dropTarget = Gtk4.DropTarget.new(Gtk4.ListBoxRow.$gtype, Gdk.DragAction.MOVE);
    let dragIndex: number = -1;
    listBox.add_controller(dropTarget);
    for (let i = 0; i < this._radios.length; i++) {
      const [radioName, radioUrl, radioID] = this._radios[i].split(' - ');
      const radiosExpander = new Adw.ExpanderRow({
        title: _(radioName),
        use_markup: false,
        cursor: new Gdk.Cursor({ name: 'pointer' }),
      });
      const nameRadioRow = new Adw.EntryRow({
        title: _('Name'),
        text: _(radioName),
        showApplyButton: true,
      });
      const urlRadioRow = new Adw.EntryRow({
        title: _('Source'),
        text: _(radioUrl),
        showApplyButton: true,
        inputPurpose: Gtk4.InputPurpose.URL,
      });
      const removeButton = new Gtk4.Button({
        tooltipMarkup: `Remove <b>${radioName}</b>`,
        iconName: 'user-trash-symbolic',
        cursor: new Gdk.Cursor({ name: 'pointer' }),
        halign: Gtk4.Align.CENTER,
        valign: Gtk4.Align.CENTER,
      });
      const buttonsRow = new Gtk4.Box({
        halign: Gtk4.Align.CENTER,
        valign: Gtk4.Align.CENTER,
        marginTop: 10,
        marginBottom: 10,
        spacing: 4,
      });
      const openButton = new Gtk4.Button({
        tooltipMarkup: `Open <b>${radioName}</b>`,
        iconName: isUri(radioUrl) ? 'folder-globe-symbolic' : 'folder-open-symbolic',
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
        dialog.choose(this._window, null, () => {});
        dialog.connect('response', (dialog, response) => {
          if (response === 'ok') {
            this._removeRadio(i, radioID);
            this._reloadRadios(radiosGroup);
          }
          dialog.close();
        });
      });
      openButton.connect('clicked', () => {
        const uri = radioUrl;
        if (!isUri(uri)) {
          const file = Gio.file_new_for_path(uri);
          const fileUri = file.get_uri();
          const uris = [fileUri];
          const startupId = '';
          Gio.DBus.session.call(
            'org.freedesktop.FileManager1', // Bus Name
            '/org/freedesktop/FileManager1', // Object Path
            'org.freedesktop.FileManager1', // Interface Name
            'ShowItems',
            new GLib.Variant('(ass)', [uris, startupId]), // Parameters
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (connection, res) => {
              try {
                connection.call_finish(res);
              } catch (e) {
                logError(e, 'Failed to open FileManager');
              }
            },
          );
          return;
        }
        try {
          Gio.AppInfo.launch_default_for_uri(uri, null);
        } catch (err) {
          logError(err, 'Error while launching URI.');
        }
      });

      nameRadioRow.connect('apply', (w) => {
        const index: number = this._radios.findIndex((entry) => entry.endsWith(radioID));
        if (w.text.length < 2) {
          handleErrorRow(w, 'Name must be at least 2 characters');
          const originalRadioName: string = this._radios[index].split(' - ')[0].trim();
          w.set_text(originalRadioName);
          return;
        }
        this._updateRadio(index, 'radioName', w.text);
        radiosExpander.set_title(w.text);
      });
      urlRadioRow.connect('apply', (w) => {
        const index: number = this._radios.findIndex((entry) => entry.endsWith(radioID));
        if (this._isPlayable({ uri: w.text }) === false) {
          handleErrorRow(urlRadioRow, 'Invalid URL or PATH.');
          const originalRadioUrl: string = this._radios[index].split(' - ')[1].trim();
          w.set_text(originalRadioUrl);
          return;
        }
        this._updateRadio(index, 'radioUrl', w.text);
      });
      buttonsRow.append(removeButton);
      buttonsRow.append(openButton);
      radiosExpander.add_row(nameRadioRow);
      radiosExpander.add_row(urlRadioRow);
      radiosExpander.add_row(buttonsRow);

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
        value.init(Gtk4.ListBoxRow as unknown as GObject.GType);
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
      listBox.remove(dragedExpanderRow as unknown as Gtk4.Widget);
      listBox.insert(dragedExpanderRow as unknown as Gtk4.Widget, targetIndex);
      this._settings!.set_strv(SETTINGS_KEYS.RADIOS_LIST, this._radios);
      return true;
    });
  }
  private _reloadRadios(radiosGroup: Adw.PreferencesGroup) {
    for (let i = 0; i <= this._radios.length; i++) {
      const child = radiosGroup
        .get_first_child()
        .get_first_child()
        .get_next_sibling()
        .get_first_child()
        .get_first_child();
      if (child === null) break;
      radiosGroup.remove(child);
    }
    this._populateRadios(radiosGroup);
  }
  private _addRadio(radioName: string, radioUrl: string): void {
    const radioID = generateNanoIdWithSymbols(10);
    this._radios.push(`${radioName} - ${radioUrl} - ${radioID}`);
    this._settings!.set_strv(SETTINGS_KEYS.RADIOS_LIST, this._radios);
  }
  private _isPlayable({ uri }: { uri: string }): boolean {
    if (uri.trim() === '') return false;
    if (isUri(uri)) return true;
    let path: string = uri;
    if (path.startsWith('~')) {
      path = GLib.get_home_dir() + path.slice(1);
    }
    const filepath: Gio.File = Gio.File.new_for_path(path);
    if (!filepath) return false;
    const basename: string[] = filepath.get_basename().split('.');
    const ext: string = basename[basename.length - 1];
    const filepathUri: string = filepath.get_uri();

    try {
      const fileUri: Gio.File = Gio.File.new_for_uri(filepathUri);
      const fileInfo: Gio.FileInfo = fileUri.query_info('standard::*,access::*', Gio.FileQueryInfoFlags.NONE, null);

      if (!ffmpegFormats.has(ext) && !fileInfo.get_content_type().match(/^video|^audio/)) {
        return false;
      }
      const fileType: Gio.FileType = fileInfo.get_file_type();
      const isFileReadable: boolean = fileInfo.get_attribute_boolean('access::can-read');

      if (
        isFileReadable &&
        (fileType === Gio.FileType.REGULAR ||
          fileType === Gio.FileType.SYMBOLIC_LINK ||
          fileType === Gio.FileType.SPECIAL)
      ) {
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }
  private _handleAddRadio(): void {
    if (this._nameRadioRow.text.length < 2) {
      handleErrorRow(this._nameRadioRow, 'Name must be at least 2 characters');
      return;
    }
    if (this._urlRadioRow.text.length <= 0) {
      handleErrorRow(this._urlRadioRow, 'URL cannot be empty.');
      return;
    }
    if (this._isPlayable({ uri: this._urlRadioRow.text }) === false) {
      handleErrorRow(this._urlRadioRow, 'Invalid URL or PATH.');
      return;
    }
    this._addRadio(this._nameRadioRow.text, this._urlRadioRow.text);
    this._nameRadioRow.set_text('');
    this._urlRadioRow.set_text('');
    this._reloadRadios(this._radiosGroup);
  }

  private _enableAddRadioOnEnter(): void {
    const controllerCallback = (_source: Gtk4.Widget, keyVal: number, _keyCode: number, _state: Gdk.ModifierType) => {
      if (keyVal === Gdk.KEY_Return || keyVal === Gdk.KEY_KP_Enter) {
        this._handleAddRadio();
      }
      return Gdk.EVENT_PROPAGATE;
    };
    const nameRadioController: Gtk4.EventControllerKey = new Gtk4.EventControllerKey({
      propagationPhase: Gtk4.PropagationPhase.CAPTURE,
    });
    const urlRadioController: Gtk4.EventControllerKey = new Gtk4.EventControllerKey({
      propagationPhase: Gtk4.PropagationPhase.CAPTURE,
    });
    nameRadioController.connect('key-pressed', controllerCallback);
    urlRadioController.connect('key-pressed', controllerCallback);
    this._nameRadioRow.add_controller(nameRadioController);
    this._urlRadioRow.add_controller(urlRadioController);
  }

  constructor(
    private _settings: Gio.Settings,
    private _window: Adw.PreferencesWindow,
  ) {
    super();
    this._radios = this._settings.get_strv(SETTINGS_KEYS.RADIOS_LIST);
    this._populateRadios(this._radiosGroup);
    this._enableAddRadioOnEnter();
    this._window.connect('close-request', () => {
      this._settings = null;
      this._radios = null;
    });
  }
}
