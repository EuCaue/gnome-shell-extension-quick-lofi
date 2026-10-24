import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk4 from 'gi://Gtk';
import { gettext as _, ngettext } from '@girs/gnome-shell/extensions/prefs';
import { handleErrorRow, setEntryRowText } from '@/preferences/EntryRow';
import { detectRadioName } from '@/preferences/RadioNameProbe';
import { expandHome, isPlayable, isUri } from '@/preferences/RadioSource';
import { mergeSearchResults, type YouTubeSearchResult } from '@/preferences/YouTubeResults';
import { searchYouTube } from '@/preferences/YouTubeSearch';
import { SETTINGS_KEYS } from '@/shared/constants';
import { writeLog } from '@/shared/log';
import { createRadio, findRadioById, formatRadios, parseRadios, sanitizeRadioName } from '@/shared/radios';
import type { Radio } from '@/types';

const SEARCH_RESULTS_LIMIT = 10;

type MoreResultsControl = { button: Gtk4.Button; spinner: Gtk4.Spinner; label: Gtk4.Label };

Gio._promisify(Gtk4.FileDialog.prototype, 'open', 'open_finish');

export class RadiosPage extends Adw.PreferencesPage {
  private _radios: Array<Radio> = [];
  private _isDetectingName = false;
  private _searchResultRows: Adw.ActionRow[] = [];
  private _searchResults: YouTubeSearchResult[] = [];
  private _searchQuery = '';
  private _searchLimit = SEARCH_RESULTS_LIMIT;
  private _searchGeneration = 0;
  private _isLoadingMore = false;
  private _moreResults: MoreResultsControl | null = null;
  private _isSearching = false;
  static {
    GObject.registerClass(
      {
        GTypeName: 'RadiosPage',
        Template: 'resource:///org/gnome/Shell/Extensions/quick-lofi/preferences/RadiosPage.ui',
        InternalChildren: [
          'radiosGroup',
          'nameRadioRow',
          'urlRadioRow',
          'defaultRadioRow',
          'playDefaultRadioOnStartupRow',
          'playDefaultRadioOnUnlockRow',
          'searchQueryRow',
          'searchButton',
          'searchResultsGroup',
          'searchResultsList',
          'searchSpinner',
        ],
      },
      this,
    );
  }
  declare private _radiosGroup: Adw.PreferencesGroup;
  declare private _nameRadioRow: Adw.EntryRow;
  declare private _urlRadioRow: Adw.EntryRow;
  declare private _defaultRadioRow: Adw.ComboRow;
  declare private _playDefaultRadioOnStartupRow: Adw.SwitchRow;
  declare private _playDefaultRadioOnUnlockRow: Adw.SwitchRow;
  declare private _searchQueryRow: Adw.EntryRow;
  declare private _searchButton: Gtk4.Button;
  declare private _searchResultsGroup: Adw.PreferencesGroup;
  declare private _searchResultsList: Gtk4.ListBox;
  declare private _searchSpinner: Gtk4.Spinner;
  private _isSyncingDefaultRadio = false;

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
  private _removeRadio(radioID: string) {
    const index: number = this._radioIndex(radioID);
    if (index === -1) return;
    const [removedRadio] = this._radios.splice(index, 1);
    writeLog({ message: `[RadiosPage] Removed radio at index ${index}: ${removedRadio?.radioName}`, type: 'INFO' });

    if (radioID === this._settings.get_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING)) {
      writeLog({ message: `[RadiosPage] Stopped playback of removed radio: ${radioID}`, type: 'INFO' });
      this._settings?.set_string(SETTINGS_KEYS.CURRENT_RADIO_PLAYING, '');
    }
    this._saveRadios();
  }

  private _radioIndex(radioID: string): number {
    return this._radios.findIndex((radio) => radio.id === radioID);
  }

  private _confirmRemoveRadio(radioName: string, radioID: string, radiosGroup: Adw.PreferencesGroup): void {
    const heading = _(`Are you sure you want to delete ${radioName} ?`);
    const onResponse = (response: string) => {
      if (response === 'ok') {
        writeLog({ message: `[RadiosPage] User confirmed removal of radio: ${radioName}`, type: 'INFO' });
        this._removeRadio(radioID);
        this._reloadRadios(radiosGroup);
      } else {
        writeLog({ message: `[RadiosPage] User cancelled removal of radio: ${radioName}`, type: 'INFO' });
      }
    };

    // GNOME 45 ships libadwaita 1.4, which has no AdwAlertDialog.
    if (typeof Adw.AlertDialog === 'undefined') {
      const dialog = new Adw.MessageDialog({ transientFor: this._window, heading, closeResponse: 'cancel' });
      dialog.add_response('cancel', 'Cancel');
      dialog.add_response('ok', 'Ok');
      dialog.set_response_appearance('ok', Adw.ResponseAppearance.DESTRUCTIVE);
      dialog.connect('response', (_dialog, response) => {
        onResponse(response);
        dialog.close();
      });
      dialog.present();
      return;
    }

    const dialog = new Adw.AlertDialog({ heading, closeResponse: 'cancel' });
    dialog.add_response('cancel', 'Cancel');
    dialog.add_response('ok', 'Ok');
    dialog.set_response_appearance('ok', Adw.ResponseAppearance.DESTRUCTIVE);
    dialog.choose(this._window, null, () => {});
    dialog.connect('response', (_dialog, response) => {
      onResponse(response);
      dialog.close();
    });
  }

  private _saveRadios(): void {
    this._settings?.set_strv(SETTINGS_KEYS.RADIOS_LIST, formatRadios(this._radios));
    // a removed default radio must not linger in settings
    this._clearStaleDefaultRadio();
    this._syncDefaultRadioRow();
  }

  private _syncDefaultRadioRow(): void {
    this._isSyncingDefaultRadio = true;
    this._defaultRadioRow.set_model(Gtk4.StringList.new([_('None'), ...this._radios.map((radio) => radio.radioName)]));
    this._isSyncingDefaultRadio = false;
    this._selectDefaultRadio();
  }

  private _selectDefaultRadio(): void {
    const defaultId = this._settings.get_string(SETTINGS_KEYS.DEFAULT_RADIO);
    const position = this._radioIndex(defaultId) + 1;
    if (this._defaultRadioRow.get_selected() !== position) {
      this._isSyncingDefaultRadio = true;
      this._defaultRadioRow.set_selected(position);
      this._isSyncingDefaultRadio = false;
    }
    this._playDefaultRadioOnStartupRow.set_sensitive(position > 0);
    this._playDefaultRadioOnUnlockRow.set_sensitive(position > 0);
  }

  private _clearStaleDefaultRadio(): void {
    const defaultId = this._settings.get_string(SETTINGS_KEYS.DEFAULT_RADIO);
    if (defaultId && !findRadioById(this._radios, defaultId))
      this._settings.set_string(SETTINGS_KEYS.DEFAULT_RADIO, '');
  }

  private _bindDefaultRadio(): void {
    this._settings.bind(
      SETTINGS_KEYS.PLAY_DEFAULT_RADIO_ON_STARTUP,
      this._playDefaultRadioOnStartupRow,
      'active',
      Gio.SettingsBindFlags.DEFAULT | Gio.SettingsBindFlags.NO_SENSITIVITY,
    );
    this._settings.bind(
      SETTINGS_KEYS.PLAY_DEFAULT_RADIO_ON_UNLOCK,
      this._playDefaultRadioOnUnlockRow,
      'active',
      Gio.SettingsBindFlags.DEFAULT | Gio.SettingsBindFlags.NO_SENSITIVITY,
    );
    this._defaultRadioRow.connect('notify::selected', () => {
      if (this._isSyncingDefaultRadio || !this._settings || !this._radios) return;
      const radio = this._radios[this._defaultRadioRow.get_selected() - 1];
      writeLog({ message: `[RadiosPage] Default radio set to: ${radio?.radioName ?? 'None'}`, type: 'INFO' });
      this._settings.set_string(SETTINGS_KEYS.DEFAULT_RADIO, radio?.id ?? '');
    });
    const changedId = this._settings.connect(`changed::${SETTINGS_KEYS.DEFAULT_RADIO}`, () =>
      this._selectDefaultRadio(),
    );
    this._window.connect('close-request', () => {
      this._settings?.disconnect(changedId);
    });
    this._clearStaleDefaultRadio();
    this._syncDefaultRadioRow();
  }

  private _populateRadios(radiosGroup: Adw.PreferencesGroup): void {
    writeLog({ message: `[RadiosPage] Populating ${this._radios.length} radios in UI`, type: 'INFO' });
    const listBox = radiosGroup.get_last_child().get_last_child().get_first_child() as Gtk4.ListBox;
    const dropTarget = Gtk4.DropTarget.new(Gtk4.ListBoxRow.$gtype, Gdk.DragAction.MOVE);
    let dragIndex: number = -1;
    listBox.add_controller(dropTarget);
    for (let i = 0; i < this._radios.length; i++) {
      const { radioName, radioUrl, id: radioID } = this._radios[i];
      // Rows outlive edits and drag reorders, so handlers read the radio by id, never from this loop.
      const currentRadio = (): Radio | undefined => this._radios[this._radioIndex(radioID)];
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
      const chooseFileButton = new Gtk4.Button({
        tooltipText: _('Choose a file'),
        iconName: 'folder-open-symbolic',
        cursor: new Gdk.Cursor({ name: 'pointer' }),
        valign: Gtk4.Align.CENTER,
        cssClasses: ['flat'],
      });
      chooseFileButton.connect('clicked', () => this._chooseFileInto(urlRadioRow));
      urlRadioRow.add_suffix(chooseFileButton);
      const removeButton = new Gtk4.Button({
        tooltipMarkup: `Remove <b>${GLib.markup_escape_text(radioName, -1)}</b>`,
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
        tooltipMarkup: `Open <b>${GLib.markup_escape_text(radioName, -1)}</b>`,
        iconName: isUri(radioUrl) ? 'folder-globe-symbolic' : 'folder-open-symbolic',
        cursor: new Gdk.Cursor({ name: 'pointer' }),
        halign: Gtk4.Align.CENTER,
        valign: Gtk4.Align.CENTER,
      });
      removeButton.connect('clicked', () => {
        const radioName: string = currentRadio()?.radioName ?? '';
        writeLog({ message: `[RadiosPage] Remove button clicked for radio: ${radioName}`, type: 'INFO' });
        this._confirmRemoveRadio(radioName, radioID, radiosGroup);
      });
      openButton.connect('clicked', () => {
        const uri: string = currentRadio()?.radioUrl ?? '';
        writeLog({ message: `[RadiosPage] Opening radio location: ${uri}`, type: 'INFO' });

        if (!isUri(uri)) {
          writeLog({ message: `[RadiosPage] Opening file path with file manager: ${uri}`, type: 'INFO' });
          const file = Gio.file_new_for_path(expandHome(uri));
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
        const index: number = this._radioIndex(radioID);
        const newName: string = sanitizeRadioName(w.text);
        if (newName.length < 2) {
          writeLog({ message: '[RadiosPage] Radio name too short (min 2 characters)', type: 'WARN' });
          handleErrorRow(w, 'Name must be at least 2 characters');
          setEntryRowText(w, this._radios[index].radioName);
          return;
        }
        this._updateRadio(index, 'radioName', newName);
        setEntryRowText(w, newName);
        radiosExpander.set_title(newName);
        const escapedName: string = GLib.markup_escape_text(newName, -1);
        removeButton.set_tooltip_markup(`Remove <b>${escapedName}</b>`);
        openButton.set_tooltip_markup(`Open <b>${escapedName}</b>`);
      });
      urlRadioRow.connect('apply', (w) => {
        const index: number = this._radioIndex(radioID);
        if (!isPlayable(w.text)) {
          writeLog({ message: `[RadiosPage] Invalid URL or PATH for radio update: ${w.text}`, type: 'WARN' });
          handleErrorRow(urlRadioRow, 'Invalid URL or PATH.');
          setEntryRowText(w, this._radios[index].radioUrl);
          return;
        }
        const newUrl: string = w.text.trim();
        this._updateRadio(index, 'radioUrl', newUrl);
        setEntryRowText(w, newUrl);
        openButton.set_icon_name(isUri(newUrl) ? 'folder-globe-symbolic' : 'folder-open-symbolic');
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
  async _handleSearchYouTube(): Promise<void> {
    const query = this._searchQueryRow.text.trim();
    if (this._isSearching || !query) return;
    this._isSearching = true;
    this._searchQueryRow.set_sensitive(false);
    this._searchButton.set_sensitive(false);
    this._searchQueryRow.set_title(_('Searching…'));
    this._searchSpinner.set_visible(true);
    this._searchSpinner.set_spinning(true);
    this._clearSearchResults();
    this._searchQuery = query;
    this._searchLimit = SEARCH_RESULTS_LIMIT;
    this._searchGeneration++;
    let results: YouTubeSearchResult[] = [];
    let error = '';
    try {
      results = await searchYouTube(
        query,
        SEARCH_RESULTS_LIMIT,
        this._settings.get_string(SETTINGS_KEYS.COOKIES_FROM_BROWSER),
      );
      if (results.length === 0) error = _('No results found');
    } catch (e) {
      writeLog({ message: `[RadiosPage] YouTube search failed: ${e}`, type: 'ERROR' });
      error = e instanceof Error ? e.message : String(e);
    }
    this._isSearching = false;
    // The window may have closed while yt-dlp was running.
    if (!this._settings) return;
    this._searchSpinner.set_spinning(false);
    this._searchSpinner.set_visible(false);
    this._searchQueryRow.set_title(_('Search'));
    this._searchQueryRow.set_sensitive(true);
    this._searchButton.set_sensitive(true);
    if (error) handleErrorRow(this._searchQueryRow, error);
    this._showSearchResults(results);
  }

  private _clearSearchResults(): void {
    for (const row of this._searchResultRows) {
      this._searchResultsList.remove(row);
    }
    this._searchResultRows = [];
    this._searchResults = [];
    this._removeMoreResultsControl();
    this._searchResultsGroup.set_visible(false);
  }

  private _showSearchResults(results: YouTubeSearchResult[]): void {
    const merged = mergeSearchResults([], results);
    if (merged.added.length === 0) return;
    this._searchResults = merged.results;
    for (const result of merged.added) {
      const row = this._buildResultRow(result);
      this._searchResultRows.push(row);
      this._searchResultsList.append(row);
    }
    this._updateResultsDescription();
    this._addMoreResultsControl();
    this._searchResultsGroup.set_visible(true);
  }

  private _updateResultsDescription(): void {
    const count = this._searchResults.length;
    // ngettext picks the plural form but does not fill in the number.
    this._searchResultsGroup.set_description(ngettext('%d result', '%d results', count).replace('%d', String(count)));
  }

  private _buildMoreResultsControl(): MoreResultsControl {
    const spinner = new Gtk4.Spinner({ visible: false, valign: Gtk4.Align.CENTER });
    const label = new Gtk4.Label({ label: _('Show More Results') });
    const box = new Gtk4.Box({ spacing: 8, halign: Gtk4.Align.CENTER });
    box.append(spinner);
    box.append(label);
    const button = new Gtk4.Button({
      child: box,
      halign: Gtk4.Align.CENTER,
      marginTop: 10,
      marginBottom: 10,
      cursor: new Gdk.Cursor({ name: 'pointer' }),
    });
    button.connect('clicked', () => this._handleShowMoreResults());
    return { button, spinner, label };
  }

  private _addMoreResultsControl(): void {
    if (this._moreResults) return;
    this._moreResults = this._buildMoreResultsControl();
    this._searchResultsGroup.add(this._moreResults.button);
  }

  private _removeMoreResultsControl(): void {
    if (!this._moreResults) return;
    this._searchResultsGroup.remove(this._moreResults.button);
    this._moreResults = null;
  }

  private async _handleShowMoreResults(): Promise<void> {
    if (this._isLoadingMore || !this._moreResults) return;
    const query = this._searchQuery;
    const generation = this._searchGeneration;
    if (!query) return;
    this._isLoadingMore = true;
    const { button, spinner, label } = this._moreResults;
    button.set_sensitive(false);
    spinner.set_visible(true);
    spinner.set_spinning(true);
    label.set_label(_('Loading…'));
    let incoming: YouTubeSearchResult[] = [];
    let error = '';
    const limit = this._searchLimit + SEARCH_RESULTS_LIMIT;
    try {
      incoming = await searchYouTube(query, limit, this._settings.get_string(SETTINGS_KEYS.COOKIES_FROM_BROWSER));
    } catch (e) {
      writeLog({ message: `[RadiosPage] YouTube search failed: ${e}`, type: 'ERROR' });
      error = e instanceof Error ? e.message : String(e);
    }
    this._isLoadingMore = false;
    // The window may have closed, or a new search may have replaced the list.
    if (!this._settings || generation !== this._searchGeneration) return;
    spinner.set_spinning(false);
    spinner.set_visible(false);
    label.set_label(_('Show More Results'));
    button.set_sensitive(true);
    if (error) {
      this._window.add_toast(new Adw.Toast({ title: _('Could not load more results'), use_markup: false }));
      return;
    }
    const merged = mergeSearchResults(this._searchResults, incoming);
    if (merged.added.length === 0) {
      this._removeMoreResultsControl();
      this._window.add_toast(new Adw.Toast({ title: _('No more results'), use_markup: false }));
      return;
    }
    this._searchResults = merged.results;
    this._searchLimit = limit;
    for (const result of merged.added) {
      const row = this._buildResultRow(result);
      this._searchResultRows.push(row);
      this._searchResultsList.append(row);
    }
    this._updateResultsDescription();
  }

  private _buildResultRow(result: YouTubeSearchResult): Adw.ActionRow {
    const row = new Adw.ActionRow({
      title: result.title,
      subtitle: result.url,
      subtitleLines: 1,
      useMarkup: false,
      cursor: new Gdk.Cursor({ name: 'pointer' }),
    });
    // The title comes from YouTube, so it must never be parsed as markup.
    row.set_tooltip_text(result.title);

    const addButton = new Gtk4.Button({
      iconName: 'list-add-symbolic',
      tooltipText: _('Add to Radios'),
      valign: Gtk4.Align.CENTER,
      cssClasses: ['flat'],
      cursor: new Gdk.Cursor({ name: 'pointer' }),
    });
    addButton.connect('clicked', () => this._addSearchResult(result, addButton));
    addButton.update_property([Gtk4.AccessibleProperty.LABEL], [_('Add to Radios')]);
    row.add_suffix(addButton);
    row.set_activatable_widget(addButton);

    const actions = new Gio.SimpleActionGroup();
    const copyAction = new Gio.SimpleAction({ name: 'copy' });
    copyAction.connect('activate', () => this._copySearchResultUrl(result));
    actions.add_action(copyAction);
    const openAction = new Gio.SimpleAction({ name: 'open' });
    openAction.connect('activate', () => this._openSearchResultUrl(result));
    actions.add_action(openAction);
    const menu = new Gio.Menu();
    menu.append(_('Copy Link'), 'result.copy');
    menu.append(_('Open in Browser'), 'result.open');
    const menuButton = new Gtk4.MenuButton({
      iconName: 'view-more-symbolic',
      tooltipText: _('More Actions'),
      menuModel: menu,
      valign: Gtk4.Align.CENTER,
      cssClasses: ['flat'],
      cursor: new Gdk.Cursor({ name: 'pointer' }),
    });
    menuButton.insert_action_group('result', actions);
    menuButton.update_property([Gtk4.AccessibleProperty.LABEL], [_('More Actions')]);
    row.add_suffix(menuButton);
    return row;
  }

  private _addSearchResult(result: YouTubeSearchResult, addButton: Gtk4.Button): void {
    const name = sanitizeRadioName(result.title);
    if (this._radios.some((radio) => radio.radioUrl === result.url)) {
      this._window.add_toast(new Adw.Toast({ title: `${_('Already in your radios:')} ${name}`, use_markup: false }));
    } else {
      this._addRadio(name, result.url);
      writeLog({ message: `[RadiosPage] Added radio from YouTube search: ${name}`, type: 'INFO' });
      this._reloadRadios(this._radiosGroup);
      this._window.add_toast(new Adw.Toast({ title: `${_('Added')} ${name}`, use_markup: false }));
    }
    addButton.set_icon_name('object-select-symbolic');
    addButton.set_tooltip_text(_('Added'));
    addButton.update_property([Gtk4.AccessibleProperty.LABEL], [_('Added')]);
    addButton.set_sensitive(false);
  }

  private _copySearchResultUrl(result: YouTubeSearchResult): void {
    Gdk.Display.get_default()?.get_clipboard().set(result.url);
    this._window.add_toast(new Adw.Toast({ title: _('Link copied') }));
  }

  private _openSearchResultUrl(result: YouTubeSearchResult): void {
    try {
      Gio.AppInfo.launch_default_for_uri(result.url, null);
    } catch (e) {
      writeLog({ message: `[RadiosPage] Failed to open ${result.url}: ${e}`, type: 'ERROR' });
      logError(e, '[RadiosPage] Failed to open URL');
    }
  }

  // Template callback (RadiosPage.ui), so not private: Biome would flag it unused.
  async _handleSelectFile(): Promise<void> {
    await this._chooseFileInto(this._urlRadioRow);
  }

  // Puts the chosen file's path in `row`; the user still confirms it with the apply button.
  private async _chooseFileInto(row: Adw.EntryRow): Promise<void> {
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
      const path: string | null | undefined = file?.get_path();
      if (!path) return;
      // EntryRow only shows its apply button for text changed while it has focus.
      row.grab_focus();
      row.set_text(path);
      row.set_position(-1);
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
    this._bindDefaultRadio();
    this._window.connect('close-request', () => {
      writeLog({ message: '[RadiosPage] Cleaning up on window close', type: 'INFO' });
      this._settings = null;
      this._radios = null;
    });
    writeLog({ message: '[RadiosPage] Radios preferences page initialized', type: 'INFO' });
  }
}
