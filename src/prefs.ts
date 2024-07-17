import Gtk4 from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import { ExtensionPreferences, gettext as _ } from '@girs/gnome-shell/extensions/prefs';

export default class GnomeRectanglePreferences extends ExtensionPreferences {
  private _settings?: Gio.Settings;
  private _radios: string[] = [];

  private _addRadio(radioName: string, radioUrl: string): void {
    this._radios.push(`${radioName} - ${radioUrl}`);
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

  private _populateRadios(radiosGroup: Adw.PreferencesGroup): void {
    for (let i = 0; i < this._radios.length; i++) {
      const [radioName, radioUrl] = this._radios[i].split(' - ');
      const radiosExpander = new Adw.ExpanderRow({ title: _(radioName), cursor: new Gdk.Cursor({ name: 'pointer' }) });
      const nameRadioRow = new Adw.EntryRow({
        title: _('Radio Name'),
        text: _(radioName),
        showApplyButton: true,
      });
      const urlRadioRow = new Adw.EntryRow({ title: _('Radio Name'), text: _(radioUrl), showApplyButton: true });
      const removeButton = new Gtk4.Button({
        label: `Remove ${radioName}`,
        iconName: 'user-trash-symbolic',
        cursor: new Gdk.Cursor({ name: 'pointer' }),
        halign: Gtk4.Align.CENTER,
        valign: Gtk4.Align.CENTER,
      });

      removeButton.connect('clicked', () => {
        const messsageDialog = new Gtk4.MessageDialog({
          text: _(`Are you sure you want to delete ${radioName} ?`),
          destroyWithParent: true,
          modal: true,
          visible: true,
          buttons: Gtk4.ButtonsType.OK_CANCEL,
        });
        messsageDialog.connect('response', (_, response) => {
          if (response === Gtk4.ResponseType.OK) {
            this._removeRadio(i);
            this._reloadRadios(radiosGroup);
          }
          messsageDialog.destroy();
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
      radiosGroup.add(radiosExpander);
    }
  }

  private _reloadRadios(radiosGroup: Adw.PreferencesGroup) {
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
    this._populateRadios(radiosGroup);
  }

  private _removeRadio(index: number) {
    this._radios.splice(index, 1);
    this._settings!.set_strv('radios', this._radios);
  }

  private _updateRadio(index: number, field: 'radioUrl' | 'radioName', content: string): boolean {
    if (index !== -1) {
      const radio = this._radios[index];
      const [radioName, radioUrl] = radio.split(' - ');
      if (field === 'radioUrl') {
        this._radios[index] = `${radioName} - ${content}`;
      }
      if (field === 'radioName') {
        this._radios[index] = `${content} - ${radioUrl}`;
      }
      this._settings.set_strv('radios', this._radios);
      return true;
    }

    return false;
  }

  fillPreferencesWindow(window: Adw.PreferencesWindow) {
    this._settings = this.getSettings();
    this._radios = this._settings.get_strv('radios');

    const page = new Adw.PreferencesPage({
      title: _('General'),
      icon_name: 'dialog-information-symbolic',
    });

    const volumeGroup = new Adw.PreferencesGroup({
      title: _('Player Settings'),
      description: _('Configure the player settings'),
    });

    page.add(volumeGroup);

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

    volumeGroup.add(volumeLevel);

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

    this._populateRadios(radiosGroup);

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
        this._reloadRadios(radiosGroup);
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
