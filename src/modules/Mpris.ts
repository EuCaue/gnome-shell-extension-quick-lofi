import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { type Radio } from '@/types';
import { writeLog } from '@/utils/helpers';
import { debug } from '@/utils/debug';
import type Player from './Player';
import { ffmpegFormats } from '@/utils/constants';

// MPRIS D-Bus interface specification
const MPRIS_IFACE_XML = `
<node>
  <interface name="org.mpris.MediaPlayer2">
    <property name="CanQuit" type="b" access="read"/>
    <property name="CanRaise" type="b" access="read"/>
    <property name="HasTrackList" type="b" access="read"/>
    <property name="Identity" type="s" access="read"/>
    <property name="DesktopEntry" type="s" access="read"/>
    <property name="SupportedUriSchemes" type="as" access="read"/>
    <property name="SupportedMimeTypes" type="as" access="read"/>
    <method name="Raise"/>
    <method name="Quit"/>
  </interface>
  
  <interface name="org.mpris.MediaPlayer2.Player">
    <method name="Next"/>
    <method name="Previous"/>
    <method name="Pause"/>
    <method name="PlayPause"/>
    <method name="Stop"/>
    <method name="Play"/>
    
    <property name="PlaybackStatus" type="s" access="read"/>
    <property name="Metadata" type="a{sv}" access="read"/>
    <property name="Volume" type="d" access="readwrite"/>
    <property name="Position" type="x" access="read"/>
    <property name="CanGoNext" type="b" access="read"/>
    <property name="CanGoPrevious" type="b" access="read"/>
    <property name="CanPlay" type="b" access="read"/>
    <property name="CanPause" type="b" access="read"/>
    <property name="CanSeek" type="b" access="read"/>
    <property name="CanControl" type="b" access="read"/>
  </interface>
</node>
`;

export class MprisController {
  private _player: any;
  private _ownerId: number = 0;
  private _mprisImplId: number = 0;
  private _playerImplId: number = 0;
  private _currentRadio: Radio | null = null;
  private _isPaused: boolean = false;
  private _connection: Gio.DBusConnection | null = null;
  private _nodeInfo: Gio.DBusNodeInfo;
  private _mprisPath: string = '/org/mpris/MediaPlayer2';

  constructor(player: Player) {
    this._player = player;
    this._nodeInfo = Gio.DBusNodeInfo.new_for_xml(MPRIS_IFACE_XML);
    this._setupMpris();
    this._connectPlayerSignals();
  }

  private _setupMpris(): void {
    writeLog({ message: 'MPRIS: Initializing MPRIS controller', type: 'INFO' });

    this._ownerId = Gio.bus_own_name(
      Gio.BusType.SESSION,
      'org.mpris.MediaPlayer2.QuickLofi',
      Gio.BusNameOwnerFlags.NONE,
      this._onBusAcquired.bind(this),
      this._onNameAcquired.bind(this),
      this._onNameLost.bind(this),
    );
  }

  private _onBusAcquired(connection: Gio.DBusConnection, name: string): void {
    writeLog({ message: `MPRIS: Bus acquired - ${name}`, type: 'INFO' });
    this._connection = connection;

    try {
      this._mprisImplId = connection.register_object_with_closures2(
        this._mprisPath,
        //@ts-expect-error type error
        this._nodeInfo.interfaces[0],
        this._handleMediaPlayer2MethodCall.bind(this),
        this._handleMediaPlayer2GetProperty.bind(this),
        null, // No writable properties on MediaPlayer2
      );

      this._playerImplId = connection.register_object_with_closures2(
        this._mprisPath,
        //@ts-expect-error type error
        this._nodeInfo.interfaces[1],
        this._handlePlayerMethodCall.bind(this),
        this._handlePlayerGetProperty.bind(this),
        this._handlePlayerSetProperty.bind(this),
      );

      writeLog({ message: 'MPRIS: Interfaces registered successfully', type: 'INFO' });
    } catch (e) {
      writeLog({ message: `MPRIS: Error registering interfaces - ${e}`, type: 'ERROR' });
    }
  }

  private _onNameAcquired(connection: Gio.DBusConnection, name: string): void {
    writeLog({ message: `MPRIS: Name acquired - ${name}`, type: 'INFO' });
  }

  private _onNameLost(connection: Gio.DBusConnection, name: string): void {
    writeLog({ message: `MPRIS: Name lost - ${name}`, type: 'ERROR' });
  }

  private _handleMediaPlayer2MethodCall(
    connection: Gio.DBusConnection,
    sender: string,
    objectPath: string,
    interfaceName: string,
    methodName: string,
    parameters: GLib.Variant,
    invocation: Gio.DBusMethodInvocation,
  ): void {
    writeLog({ message: `MPRIS: Method called - ${methodName}`, type: 'INFO' });

    if (methodName === 'Raise' || methodName === 'Quit') {
      invocation.return_value(null);
    } else {
      invocation.return_error_literal(0, Gio.DBusError.UNKNOWN_METHOD, `Method ${methodName} not implemented`);
    }
  }

  private _handleMediaPlayer2GetProperty(
    connection: Gio.DBusConnection,
    sender: string,
    objectPath: string,
    interfaceName: string,
    propertyName: string,
  ): GLib.Variant | null {
    switch (propertyName) {
      case 'CanQuit':
        return new GLib.Variant('b', false);
      case 'CanRaise':
        return new GLib.Variant('b', false);
      case 'HasTrackList':
        return new GLib.Variant('b', false);
      case 'Identity':
        return new GLib.Variant('s', 'Quick Lofi');
      case 'DesktopEntry':
        return new GLib.Variant('s', 'gnome-shell-extension-quick-lofi');
      case 'SupportedUriSchemes':
        return new GLib.Variant('as', ['http', 'https', 'file']);
      case 'SupportedMimeTypes':
        const mimeTypes = Array.from(ffmpegFormats).map((format) => `audio/${format}`);
        return new GLib.Variant('as', mimeTypes);
    }
    return null;
  }

  private _handlePlayerMethodCall(
    connection: Gio.DBusConnection,
    sender: string,
    objectPath: string,
    interfaceName: string,
    methodName: string,
    parameters: GLib.Variant,
    invocation: Gio.DBusMethodInvocation,
  ): void {
    writeLog({ message: `MPRIS: Player method called - ${methodName}`, type: 'INFO' });

    switch (methodName) {
      case 'PlayPause':
        this._player.playPause();
        invocation.return_value(null);
        break;

      case 'Play':
        if (!this._player.isPlaying() && this._currentRadio) {
          this._player.startPlayer(this._currentRadio);
        } else if (this._isPaused) {
          this._player.playPause();
        }
        invocation.return_value(null);
        break;

      case 'Pause':
        if (this._player.isPlaying() && !this._isPaused) {
          this._player.playPause();
        }
        invocation.return_value(null);
        break;

      case 'Stop':
        this._player.stopPlayer(this._currentRadio);
        invocation.return_value(null);
        break;

      case 'Next':
      case 'Previous':
        // Not implemented - would need playlist
        invocation.return_value(null);
        break;

      default:
        invocation.return_error_literal(22, Gio.DBusError.UNKNOWN_METHOD, `Method ${methodName} not implemented`);
    }
  }

  private _handlePlayerGetProperty(
    connection: Gio.DBusConnection,
    sender: string,
    objectPath: string,
    interfaceName: string,
    propertyName: string,
  ): GLib.Variant | null {
    switch (propertyName) {
      case 'PlaybackStatus':
        if (!this._player.isPlaying()) {
          return new GLib.Variant('s', 'Stopped');
        }
        return new GLib.Variant('s', this._isPaused ? 'Paused' : 'Playing');

      case 'Metadata':
        return this._buildMetadata();

      case 'Volume':
        const volume = this._player._settings.get_int('volume') / 100.0;
        return new GLib.Variant('d', volume);

      case 'Position':
        return new GLib.Variant('x', 0); // Radio streams have no position

      case 'CanGoNext':
        return new GLib.Variant('b', false);

      case 'CanGoPrevious':
        return new GLib.Variant('b', false);

      case 'CanPlay':
        return new GLib.Variant('b', true);

      case 'CanPause':
        return new GLib.Variant('b', true);

      case 'CanSeek':
        return new GLib.Variant('b', false);

      case 'CanControl':
        return new GLib.Variant('b', true);
    }
    return null;
  }

  private _handlePlayerSetProperty(
    connection: Gio.DBusConnection,
    sender: string,
    objectPath: string,
    interfaceName: string,
    propertyName: string,
    value: GLib.Variant,
  ): boolean {
    debug('Handling _handlePlayerSetProperty: ', value, propertyName);
    switch (propertyName) {
      case 'Volume':
        const volume = Math.round(value.get_double() * 100);
        this._player._settings.set_int('volume', volume);
        return true;
    }
    return false;
  }

  private _buildMetadata(): GLib.Variant {
    writeLog({
      message: `MPRIS: Building metadata for: ${JSON.stringify(this._currentRadio)}`,
      type: 'INFO',
    });

    const builder = new GLib.VariantBuilder(new GLib.VariantType('a{sv}')) as GLib.VariantBuilder<'a{sv}'> & {
      add_value(value: GLib.Variant): void;
    };

    debug('CURRENTRADIO', this._currentRadio);
    if (this._currentRadio) {
      const sanitizedId = (this._currentRadio.id || '0').replace(/[^A-Za-z0-9_]/g, '_');
      debug('INSIDE IF CURRENT RADIO');

      // REQUIRED: mpris:trackid
      builder.add_value(
        GLib.Variant.new_dict_entry(
          new GLib.Variant('s', 'mpris:trackid'),
          new GLib.Variant('v', new GLib.Variant('o', `/org/quicklofi/Radio/${sanitizedId}`)),
        ),
      );

      // xesam:title radio name
      builder.add_value(
        GLib.Variant.new_dict_entry(
          new GLib.Variant('s', 'xesam:title'),
          new GLib.Variant('v', new GLib.Variant('s', this._currentRadio.radioName)),
        ),
      );

      // xesam:artist string array
      builder.add_value(
        GLib.Variant.new_dict_entry(
          new GLib.Variant('s', 'xesam:artist'),
          new GLib.Variant('v', new GLib.Variant('as', ['Quick Lofi'])),
        ),
      );

      // xesam:album
      builder.add_value(
        GLib.Variant.new_dict_entry(
          new GLib.Variant('s', 'xesam:album'),
          new GLib.Variant('v', new GLib.Variant('s', 'Lofi Radio Stream')),
        ),
      );

      // mpris:length in microseconds (0 for streams)
      builder.add_value(
        GLib.Variant.new_dict_entry(
          new GLib.Variant('s', 'mpris:length'),
          new GLib.Variant('v', new GLib.Variant('x', 0)),
        ),
      );

      writeLog({
        message: `MPRIS: Metadata built - Title: ${this._currentRadio.radioName}`,
        type: 'INFO',
      });
    } else {
      debug('INSIDE IF ELSE CURRENT RADIO');

      builder.add_value(
        GLib.Variant.new_dict_entry(
          new GLib.Variant('s', 'mpris:trackid'),
          new GLib.Variant('v', new GLib.Variant('o', '/org/quicklofi/NoRadio')),
        ),
      );

      builder.add_value(
        GLib.Variant.new_dict_entry(
          new GLib.Variant('s', 'xesam:title'),
          new GLib.Variant('v', new GLib.Variant('s', 'No Radio Playing')),
        ),
      );

      builder.add_value(
        GLib.Variant.new_dict_entry(
          new GLib.Variant('s', 'xesam:artist'),
          new GLib.Variant('v', new GLib.Variant('as', ['Quick Lofi'])),
        ),
      );

      builder.add_value(
        GLib.Variant.new_dict_entry(
          new GLib.Variant('s', 'xesam:album'),
          new GLib.Variant('v', new GLib.Variant('s', '')),
        ),
      );

      builder.add_value(
        GLib.Variant.new_dict_entry(
          new GLib.Variant('s', 'mpris:length'),
          new GLib.Variant('v', new GLib.Variant('x', 0)),
        ),
      );
    }

    return builder.end();
  }

  private _emitPropertiesChanged(properties: string[]): void {
    if (!this._connection) {
      writeLog({ message: 'MPRIS: Cannot emit - no connection', type: 'ERROR' });
      return;
    }

    try {
      // Array used to store the dictionary entries (dict_entries)
      const changedPropertiesList: GLib.Variant[] = [];

      for (const prop of properties) {
        // 1. Get the value (it is already a GLib.Variant, e.g. Variant<'s'>)
        const value = this._handlePlayerGetProperty(
          this._connection,
          '',
          '/org/mpris/MediaPlayer2',
          'org.mpris.MediaPlayer2.Player',
          prop,
        );

        if (value) {
          // 2. IMPORTANT: for a a{sv} dictionary, the value must be wrapped in a 'v' Variant
          // Even if 'value' is already a Variant, we need to explicitly say it fills the 'v' slot
          const variantValue = new GLib.Variant('v', value);

          // 3. Explicitly create the {sv} dictionary entry
          const dictEntry = GLib.Variant.new_dict_entry(new GLib.Variant('s', prop), variantValue);

          changedPropertiesList.push(dictEntry);
        }
      }

      // 4. Create the final a{sv} array using the explicit type
      const changedProperties = GLib.Variant.new_array(new GLib.VariantType('{sv}'), changedPropertiesList);

      const invalidatedProperties = new GLib.Variant('as', []);

      debug('EMITTING PropertiesChanged:', {
        interface: 'org.mpris.MediaPlayer2.Player',
        changed: properties,
      });

      // 5. Use new_tuple for the signal parameters (sa{sv}as)
      // This prevents GJS from trying to interpret the array as loose arguments
      const signalParameters = GLib.Variant.new_tuple([
        //@ts-expect-error typing error
        new GLib.Variant('s', 'org.mpris.MediaPlayer2.Player'),
        changedProperties,
        invalidatedProperties,
      ]);

      this._connection.emit_signal(
        null,
        '/org/mpris/MediaPlayer2',
        'org.freedesktop.DBus.Properties',
        'PropertiesChanged',
        signalParameters,
      );

      writeLog({
        message: `MPRIS: Emitted PropertiesChanged for ${properties.join(', ')}`,
        type: 'INFO',
      });
    } catch (e) {
      writeLog({ message: `MPRIS: Error emitting signal - ${e}`, type: 'ERROR' });
      debug('EMIT ERROR:', e);
      if (e instanceof Error) {
        logError(e, 'MPRIS Emission Stack');
      }
    }
  }

  public updateMetadata(radio: Radio | null): void {
    this._currentRadio = radio;
    debug('updateMetadata called with:', radio);
    writeLog({
      message: `MPRIS: Updating metadata - ${JSON.stringify(radio)}`,
      type: 'INFO',
    });
    this._emitPropertiesChanged(['Metadata', 'PlaybackStatus']);
  }

  public updatePlaybackStatus(isPaused: boolean): void {
    this._isPaused = isPaused;
    debug('updatePlaybackStatus called:', isPaused);
    this._emitPropertiesChanged(['PlaybackStatus']);
  }

  private _connectPlayerSignals(): void {
    this._player.connect('play-state-changed', (_player: any, isPaused: boolean) => {
      this.updatePlaybackStatus(isPaused);
    });

    this._player.connect('playback-stopped', () => {
      this._isPaused = false;
      this._emitPropertiesChanged(['PlaybackStatus']);
    });
  }

  public destroy(): void {
    writeLog({ message: 'MPRIS: Destroying controller', type: 'INFO' });

    if (this._connection) {
      if (this._mprisImplId > 0) {
        this._connection.unregister_object(this._mprisImplId);
      }
      if (this._playerImplId > 0) {
        this._connection.unregister_object(this._playerImplId);
      }
    }

    if (this._ownerId > 0) {
      Gio.bus_unown_name(this._ownerId);
    }

    this._connection = null;
    this._currentRadio = null;
  }
}
