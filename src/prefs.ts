import Gtk from 'gi://Gtk';
import Gtk4 from '@girs/gtk-4.0';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
type Radio = { radioName: string; radioUrl: string };
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
            //  TODO: send a notification
            //  TODO: reload the list
            this.removeRadio(i);
          }
          messsageDialog.destroy();
        });
      });

      nameRadioRow.connect('apply', (w) => {
        if (w.text.length >= 2) {
          const index = this._radios.findIndex((entry) => entry.startsWith(radioName));
          this.updateRadio(index, 'radioName', w.text);
        }
        console.log(w.text);
      });
      // check if it's a way to prevent to apply
      // TODO: do a better error handling.
      urlRadioRow.connect('apply', (w) => {
        let isValidUrl: boolean;
        try {
          isValidUrl = GLib.uri_is_valid(w.text, GLib.UriFlags.NONE);
          const index = this._radios.findIndex((entry) => entry.startsWith(radioName));
          this.updateRadio(index, 'radioUrl', w.text);
        } catch (e) {
          // make a box with red borders
          console.log('error >>>>>>>>>>>>>>', e);
          w.set_text(radioUrl);
          // TODO: find a way to notify it's fails
          // main.notify("oops");
        }
      });
      radiosExpander.add_row(nameRadioRow);
      radiosExpander.add_row(urlRadioRow);
      radiosExpander.add_row(removeButton);
      radiosGroup.add(radiosExpander);
    }
  }

  //  TODO: find a way to reload the radios group;
  private reloadRadios(radiosGroup: Adw.PreferencesGroup) {
    console.log('reload radios');
    let child = radiosGroup.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      radiosGroup.remove(next);
      child = next;
    }
    this.populateRadios(radiosGroup);
  }

  private removeRadio(index: number) {
    this._radios.splice(index, 1);
    console.log('remove radio >>>>>>>>>', this._radios);
    this._settings!.set_strv('radios', this._radios);
    console.log('remove radio +++++++++ ', this._radios);
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
      console.log('>>>>>>>>>>>.. radio', radio);
      console.log('>>>>>>>>>>>. radios', this._radios);
      this._settings.set_strv('radios', this._radios);
      return true;
    }

    return false;
  }

  fillPreferencesWindow(window: Adw.PreferencesWindow) {
    this._settings = this.getSettings();
    this._radios = this._settings.get_strv('radios');
    console.log(this._settings.get_strv('radios'));

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
          nameRadioRow.set_title('Name must be at least 2 characters');
          console.log('nameRadioRow error');
          GLib.timeout_add_seconds(GLib.PRIORITY_HIGH, TIMEOUT_SECONDS, () => {
            nameRadioRow.set_title(currentTitleName);
            console.log('nameRadioRow error timeout');
            return GLib.SOURCE_REMOVE;
          });
        }
      } catch (e) {
        //  TODO: send notification error here
        const currentTitleUrl = urlRadioRow.get_title();
        //  TODO: write the css style for error
        console.log('urlRadioRow error');
        urlRadioRow.set_title('Invalid URL');
        GLib.timeout_add_seconds(GLib.PRIORITY_HIGH, TIMEOUT_SECONDS, () => {
          urlRadioRow.set_title(currentTitleUrl);
          console.log('urlRadioRow error timeout');
          return GLib.SOURCE_REMOVE;
        });
        if (nameRadioRow.text.length < 2) {
          const currentTitleName = nameRadioRow.get_title();
          nameRadioRow.set_title('Name must be at least 2 characters');
          console.log('nameRadioRow error');
          GLib.timeout_add_seconds(GLib.PRIORITY_HIGH, TIMEOUT_SECONDS, () => {
            nameRadioRow.set_title(currentTitleName);
            console.log('nameRadioRow error timeout');
            return GLib.SOURCE_REMOVE;
          });
        }
      }
      console.log('bomdia');
    });
    addRadioGroup.add(nameRadioRow);
    addRadioGroup.add(urlRadioRow);
    addRadioGroup.add(addButton);
    radiosGroup.add(addButton);
    page.add(radiosGroup);
    page.add(addRadioGroup);

    window.add(page);
    this._settings!.bind('volume', paddingInner, 'value', Gio.SettingsBindFlags.DEFAULT);
  }
}
