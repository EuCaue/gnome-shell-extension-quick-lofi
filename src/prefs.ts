import Gtk from 'gi://Gtk';
import Gtk4 from '@girs/gtk-4.0';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
const TIMEOUT_SECONDS = 5 as const;

export default class GnomeRectanglePreferences extends ExtensionPreferences {
  private _settings?: Gio.Settings;
  private _radios: string[] = [];

  private addRadio(radioName: string, radioUrl: string): void {
    this._radios.push(`${radioName} - ${radioUrl}`);
    this._settings!.set_strv('radios', this._radios);
  }

  private populateRadios(radiosGroup: Adw.PreferencesGroup): void {
    for (let i = 0; i < this._radios.length; i++) {
      const [radioName, radioUrl] = this._radios[i].split(' - ');
      const radiosExpander = new Adw.ExpanderRow({ title: _(radioName) });
      const nameRadioRow = new Adw.EntryRow({
        title: _('Radio Name'),
        text: _(radioName),
        showApplyButton: true,
      });
      const urlRadioRow = new Adw.EntryRow({ title: _('Radio Name'), text: _(radioUrl), showApplyButton: true });
      const removeButton = new Gtk4.Button({
        label: `Remove ${radioName}`,
        iconName: 'user-trash-symbolic',
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
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
            this.removeRadio(i);
            this.reloadRadios(radiosGroup);
          }
          messsageDialog.destroy();
        });
      });

      nameRadioRow.connect('apply', (w) => {
        if (w.text.length >= 2) {
          const index = this._radios.findIndex((entry) => entry.startsWith(radioName));
          this.updateRadio(index, 'radioName', w.text);
          radiosExpander.set_title(w.text);
        }
      });
      // check if it's a way to prevent to apply
      // TODO: do a better error handling.
      urlRadioRow.connect('apply', (w) => {
        try {
          GLib.uri_is_valid(w.text, GLib.UriFlags.NONE);
          const index = this._radios.findIndex((entry) => entry.startsWith(radioName));
          this.updateRadio(index, 'radioUrl', w.text);
        } catch (e) {
          const currentTitleUrl = urlRadioRow.get_title();
          urlRadioRow.set_title('Invalid URL');
          urlRadioRow.add_css_class('error');
          GLib.timeout_add_seconds(GLib.PRIORITY_HIGH, TIMEOUT_SECONDS, () => {
            urlRadioRow.set_title(currentTitleUrl);
            urlRadioRow.remove_css_class('error');
            return GLib.SOURCE_REMOVE;
          });
          w.set_text(radioUrl);
        }
      });
      radiosExpander.add_row(nameRadioRow);
      radiosExpander.add_row(urlRadioRow);
      radiosExpander.add_row(removeButton);
      radiosGroup.add(radiosExpander);
    }
  }

  private reloadRadios(radiosGroup: Adw.PreferencesGroup) {
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
    this.populateRadios(radiosGroup);
  }

  private removeRadio(index: number) {
    this._radios.splice(index, 1);
    this._settings!.set_strv('radios', this._radios);
  }

  private updateRadio(index: number, field: 'radioUrl' | 'radioName', content: string): boolean {
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

    const paddingGroup = new Adw.PreferencesGroup({
      title: _('Player Settings'),
      description: _('Configure the player settings'),
    });
    page.add(paddingGroup);

    const paddingInner = new Adw.SpinRow({
      title: _('Volume'),
      subtitle: _('Volume to set when playing lofi'),
      adjustment: new Gtk.Adjustment({
        lower: 0,
        upper: 100,
        step_increment: 1,
      }),
    });
    paddingGroup.add(paddingInner);

    const radiosGroup = new Adw.PreferencesGroup({
      title: _('Radios Settings'),
      description: _('Configure the radio list'),
    });

    this.populateRadios(radiosGroup);

    const addRadioGroup = new Adw.PreferencesGroup({
      title: _('Add Radio to the list'),
    });

    const nameRadioRow = new Adw.EntryRow({ title: _('Radio Name') });
    const urlRadioRow = new Adw.EntryRow({ title: _('Radio URL') });
    const addButton = new Gtk4.Button({
      label: _('Add Radio'),
      iconName: 'list-add-symbolic',
      halign: Gtk.Align.CENTER,
      valign: Gtk.Align.CENTER,
      marginTop: 10,
    });

    addButton.connect('clicked', () => {
      try {
        GLib.uri_is_valid(urlRadioRow.text, GLib.UriFlags.NONE); // test if it's a valid URL
        if (nameRadioRow.text.length >= 2) {
          this.addRadio(nameRadioRow.text, urlRadioRow.text);
          nameRadioRow.set_text('');
          urlRadioRow.set_text('');
          this.reloadRadios(radiosGroup);
        } else {
          const currentTitleName = nameRadioRow.get_title();
          nameRadioRow.add_css_class('error');
          nameRadioRow.set_title('Name must be at least 2 characters');
          GLib.timeout_add_seconds(GLib.PRIORITY_HIGH, TIMEOUT_SECONDS, () => {
            nameRadioRow.set_title(currentTitleName);
            nameRadioRow.remove_css_class('error');
            return GLib.SOURCE_REMOVE;
          });
        }
      } catch (e) {
        const currentTitleUrl = urlRadioRow.get_title();
        //  TODO: write the css style for error
        urlRadioRow.set_title('Invalid URL');
        urlRadioRow.add_css_class('error');
        GLib.timeout_add_seconds(GLib.PRIORITY_HIGH, TIMEOUT_SECONDS, () => {
          urlRadioRow.set_title(currentTitleUrl);
          urlRadioRow.remove_css_class('error');
          return GLib.SOURCE_REMOVE;
        });
        if (nameRadioRow.text.length < 2) {
          const currentTitleName = nameRadioRow.get_title();
          nameRadioRow.set_title('Name must be at least 2 characters');
          nameRadioRow.add_css_class('error');
          GLib.timeout_add_seconds(GLib.PRIORITY_HIGH, TIMEOUT_SECONDS, () => {
            nameRadioRow.set_title(currentTitleName);
            nameRadioRow.remove_css_class('error');
            return GLib.SOURCE_REMOVE;
          });
        }
      }
    });
    addRadioGroup.add(nameRadioRow);
    addRadioGroup.add(urlRadioRow);
    addRadioGroup.add(addButton);
    page.add(radiosGroup);
    page.add(addRadioGroup);

    window.add(page);
    this._settings!.bind('volume', paddingInner, 'value', Gio.SettingsBindFlags.DEFAULT);
  }
}
