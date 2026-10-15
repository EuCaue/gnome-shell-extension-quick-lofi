import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Registers the gresource when this module loads. The pages' GObject templates are read when their
// modules load, so this import must come before theirs.
const uri = GLib.Uri.resolve_relative(import.meta.url, '../resources/quick-lofi.gresource', GLib.UriFlags.NONE);
Gio.resources_register(Gio.Resource.load(Gio.File.new_for_uri(uri).get_path()));
