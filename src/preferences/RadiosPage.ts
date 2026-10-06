import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk4 from 'gi://Gtk';
import { gettext as _ } from '@girs/gnome-shell/extensions/prefs';
import { detectRadioName } from '@/preferences/RadioNameProbe';
import { isPlayable, isUri } from '@/preferences/RadioSource';
import { handleErrorRow } from '@/preferences/RowError';
import { SETTINGS_KEYS } from '@/shared/constants';
import { writeLog } from '@/shared/log';
import { createRadio, formatRadios, parseRadios, sanitizeRadioName } from '@/shared/radios';
import type { Radio } from '@/types';

Gio._promisify(Gtk4.FileDialog.prototype, 'open', 'open_finish');

export class RadiosPage extends Adw.PreferencesPage {
  private _radios: Array<Radio> = [];
  private _isDetectingName = false;
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
  private declare _radiosGroup: Adw.PreferencesGroup;
  private declare _nameRadioRow: Adw.EntryRow;
  private declare _urlRadioRow: Adw.EntryRow;

  private _updateRadio(index: number, field: 'radioUrl' | 'radioName', content: string): boolean {
    if (index !== -1) {
      const radio = this._radios[index];
      writeLog({ message: `[RadiosPage] Updating radio ${field}: ${radio.radioName} -> ${content}`, type: 'INFO' });
      this._radios[index] = { ...radio, [field]: content };
      this._saveRadios();
      return true;
    }

    writeLog({ message: `[RadiosPage] Failed to update radio - index not found: ${index}`, type: 'ERROR' });
    return false;
  }
  private _removeRadio(index: number, radioID: string) {
    const [removedRadio] = this._radios.splice(index, 1);
    writeLog({ message: `[RadiosPage] Removed radio at index ${index}: ${removedRadio?.radioName}`, type: 'INFO' });

    if (radioID === this._settings.get_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING)) {
      writeLog({ message: `[RadiosPage] Stopped playback of removed radio: ${radioID}`, type: 'INFO' });
      this._settings?.set_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING, '');
    }
    this._saveRadios();
  }

  private _saveRadios(): void {
    this._settings?.set_strv(SETTINGS_KEYS.RADIOS_LIST, formatRadios(this._radios));
  }

  private _populateRadios(radiosGroup: Adw.PreferencesGroup): void {
    writeLog({ message: `[RadiosPage] Populating ${this._radios.length} radios in UI`, type: 'INFO' });
    const listBox = radiosGroup.get_last_child().get_last_child().get_first_child() as Gtk4.ListBox;
    const dropTarget = Gtk4.DropTarget.new(Gtk4.ListBoxRow.$gtype, Gdk.DragAction.MOVE);
    let dragIndex: number = -1;
    listBox.add_controller(dropTarget);
    for (let i = 0; i < this._radios.length; i++) {
      const { radioName, radioUrl, id: radioID } = this._radios[i];
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
        writeLog({ message: `[RadiosPage] Remove button clicked for radio: ${radioName}`, type: 'INFO' });
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
            writeLog({ message: `[RadiosPage] User confirmed removal of radio: ${radioName}`, type: 'INFO' });
            this._removeRadio(i, radioID);
            this._reloadRadios(radiosGroup);
          } else {
            writeLog({ message: `[RadiosPage] User cancelled removal of radio: ${radioName}`, type: 'INFO' });
          }
          dialog.close();
        });
      });
      openButton.connect('clicked', () => {
        const uri = radioUrl;
        writeLog({ message: `[RadiosPage] Opening radio location: ${uri}`, type: 'INFO' });

        if (!isUri(uri)) {
          writeLog({ message: `[RadiosPage] Opening file path with file manager: ${uri}`, type: 'INFO' });
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
                writeLog({ message: `[RadiosPage] Successfully opened file manager for: ${uri}`, type: 'INFO' });
              } catch (e) {
                writeLog({ message: `[RadiosPage] Failed to open file manager for: ${uri} - ${e}`, type: 'ERROR' });
                logError(e, 'Failed to open FileManager');
              }
            },
          );
          return;
        }
        try {
          Gio.AppInfo.launch_default_for_uri(uri, null);
          writeLog({ message: `[RadiosPage] Successfully opened URI: ${uri}`, type: 'INFO' });
        } catch (err) {
          writeLog({ message: `[RadiosPage] Error launching URI: ${uri} - ${err}`, type: 'ERROR' });
          logError(err, 'Error while launching URI.');
        }
      });

      nameRadioRow.connect('apply', (w) => {
        const index: number = this._radios.findIndex((radio) => radio.id === radioID);
        const newName = sanitizeRadioName(w.text);
        if (newName.length < 2) {
          writeLog({ message: '[RadiosPage] Radio name too short (min 2 characters)', type: 'WARN' });
          handleErrorRow(w, 'Name must be at least 2 characters');
          w.set_text(this._radios[index].radioName);
          return;
        }
        this._updateRadio(index, 'radioName', newName);
        w.set_text(newName);
        radiosExpander.set_title(newName);
      });
      urlRadioRow.connect('apply', (w) => {
        const index: number = this._radios.findIndex((radio) => radio.id === radioID);
        if (!isPlayable(w.text)) {
          writeLog({ message: `[RadiosPage] Invalid URL or PATH for radio update: ${w.text}`, type: 'WARN' });
          handleErrorRow(urlRadioRow, 'Invalid URL or PATH.');
          w.set_text(this._radios[index].radioUrl);
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
      this._saveRadios();
      return true;
    });
  }
  private _reloadRadios(radiosGroup: Adw.PreferencesGroup) {
    writeLog({ message: '[RadiosPage] Reloading radios list', type: 'INFO' });
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
    writeLog({ message: '[RadiosPage] Radios list reloaded', type: 'INFO' });
  }
  private _addRadio(radioName: string, radioUrl: string): void {
    const radio: Radio = createRadio(radioName, radioUrl);
    writeLog({ message: `[RadiosPage] Generated radio ID: ${radio.id} for ${radio.radioName}`, type: 'INFO' });
    this._radios.push(radio);
    this._saveRadios();
  }
  private async _handleAddRadio(): Promise<void> {
    // Called from a GtkBuilder signal and a key controller, which both drop the promise.
    try {
      await this._addRadioFromForm();
    } catch (e) {
      logError(e, '[RadiosPage] Failed to add radio');
    }
  }

  private async _addRadioFromForm(): Promise<void> {
    if (this._isDetectingName) return;
    writeLog({ message: `[RadiosPage] Attempting to add radio: ${this._nameRadioRow.text}`, type: 'INFO' });

    const typedName = sanitizeRadioName(this._nameRadioRow.text);
    if (typedName.length === 1) {
      writeLog({ message: '[RadiosPage] Radio name too short (min 2 characters)', type: 'WARN' });
      handleErrorRow(this._nameRadioRow, 'Name must be at least 2 characters');
      return;
    }
    if (this._urlRadioRow.text.length <= 0) {
      writeLog({ message: '[RadiosPage] Radio URL cannot be empty', type: 'WARN' });
      handleErrorRow(this._urlRadioRow, 'URL cannot be empty.');
      return;
    }
    if (!isPlayable(this._urlRadioRow.text)) {
      writeLog({ message: `[RadiosPage] Invalid radio URL or path: ${this._urlRadioRow.text}`, type: 'WARN' });
      handleErrorRow(this._urlRadioRow, 'Invalid URL or PATH.');
      return;
    }

    let name = typedName;
    if (!name) {
      this._isDetectingName = true;
      this._nameRadioRow.set_sensitive(false);
      this._urlRadioRow.set_sensitive(false);
      this._nameRadioRow.set_title(_('Detecting name…'));
      try {
        name = await detectRadioName(
          this._urlRadioRow.text,
          this._settings.get_string(SETTINGS_KEYS.COOKIES_FROM_BROWSER),
        );
      } finally {
        this._nameRadioRow.set_title(_('Name (optional)'));
        this._nameRadioRow.set_sensitive(true);
        this._urlRadioRow.set_sensitive(true);
        this._isDetectingName = false;
      }
    }

    this._addRadio(name, this._urlRadioRow.text);
    writeLog({ message: `[RadiosPage] Successfully added radio: ${name}`, type: 'INFO' });
    this._nameRadioRow.set_text('');
    this._urlRadioRow.set_text('');
    this._reloadRadios(this._radiosGroup);
  }

  // Template callback (RadiosPage.ui), so not private: Biome would flag it unused.
  async _handleSelectFile(): Promise<void> {
    const mediaFilter = new Gtk4.FileFilter({ name: _('Audio and video') });
    mediaFilter.add_mime_type('audio/*');
    mediaFilter.add_mime_type('video/*');
    const allFilter = new Gtk4.FileFilter({ name: _('All files') });
    allFilter.add_pattern('*');
    const filters = new Gio.ListStore({ item_type: Gtk4.FileFilter.$gtype });
    filters.append(mediaFilter);
    filters.append(allFilter);

    const dialog = new Gtk4.FileDialog({ title: _('Choose a file'), filters, default_filter: mediaFilter });
    try {
      // The cast works around duplicate @girs Gtk types; at runtime this is a Gtk.Window.
      const file = await dialog.open(this._window as unknown as Gtk4.Window, null);
      const path = file?.get_path();
      if (path) this._urlRadioRow.set_text(path);
    } catch (e) {
      if (!(e instanceof GLib.Error && e.matches(Gtk4.DialogError, Gtk4.DialogError.DISMISSED))) {
        logError(e, '[RadiosPage] Failed to choose a file');
      }
    }
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
    writeLog({ message: '[RadiosPage] Initializing radios preferences page', type: 'INFO' });
    this._radios = parseRadios(this._settings.get_strv(SETTINGS_KEYS.RADIOS_LIST));
    writeLog({ message: `[RadiosPage] Loaded ${this._radios.length} radios from settings`, type: 'INFO' });
    this._populateRadios(this._radiosGroup);
    this._enableAddRadioOnEnter();
    this._window.connect('close-request', () => {
      writeLog({ message: '[RadiosPage] Cleaning up on window close', type: 'INFO' });
      this._settings = null;
      this._radios = null;
    });
    writeLog({ message: '[RadiosPage] Radios preferences page initialized', type: 'INFO' });
  }
}
