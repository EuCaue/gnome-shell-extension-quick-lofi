import Gio from 'gi://Gio';

export default class Utils {
  public static tempFile;
  public static consssts readonly tempFilePath = '/tmp/current-radio-playing';


  public static deleteTempFile(): void {
    if (this.tempFile) {
      this.tempFile.delete(null);
      this.tempFile = null;
    }
  }

  public static createTempFile(currentRadioName: string): void {
    this.tempFile = Gio.File.new_for_uri(`file://${this.tempFilePath}`);
    const outputStream = this.tempFile.create(Gio.FileCreateFlags.NONE, null);
    const data = new TextEncoder().encode(currentRadioName);
    outputStream.write(data, null);
    outputStream.close(null);
  }

  public static readTempFile(): string | null {
    try {
      const tempFile = Gio.File.new_for_uri(`file://${this.tempFilePath}`);
      const [_, contents] = tempFile.load_contents(null);
      const currentRadioPlaying = new TextDecoder().decode(contents);
      return currentRadioPlaying.trim();
    } catch (error) {
      return null;
    }
  }
}
