import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { ffmpegFormats } from '@/shared/constants';

// A radio source is either a URI (stream, website) or a local file path.
export function isUri(source: string): boolean {
  return Boolean(GLib.uri_parse_scheme(source));
}

export function expandHome(source: string): string {
  return source.startsWith('~') ? GLib.get_home_dir() + source.slice(1) : source;
}

export function isPlayable(source: string): boolean {
  if (source.trim() === '') return false;
  if (isUri(source)) return true;
  const filepath: Gio.File = Gio.File.new_for_path(expandHome(source));
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
  } catch (_e) {
    return false;
  }
  return false;
}
