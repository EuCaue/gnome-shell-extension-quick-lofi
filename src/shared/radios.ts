// No gi:// imports: tests load this file directly with Node.
import type { Radio } from '@/types';

// The `radios` setting stores each radio as "name - url - id".
const SEPARATOR = ' - ';
const ID_SIZE = 10;
const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';

// Names must not contain the separator; ids never contain spaces, so they can't either.
export function sanitizeRadioName(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ -(?= |$)/g, ' –');
}

// Generating NanoIDs
export function newRadioId(): string {
  return Array.from({ length: ID_SIZE }, () => ID_CHARS.charAt(Math.floor(Math.random() * ID_CHARS.length))).join('');
}

export function createRadio(radioName: string, radioUrl: string): Radio {
  return { radioName: sanitizeRadioName(radioName), radioUrl: radioUrl.trim(), id: newRadioId() };
}

// The url sits between the first and the last separator, so a path like "~/A - B.mp3" survives.
export function parseRadio(entry: string): Radio {
  const parts: string[] = entry.split(SEPARATOR);
  if (parts.length < 3) {
    return { radioName: (parts[0] ?? '').trim(), radioUrl: parts.slice(1).join(SEPARATOR).trim(), id: '' };
  }
  return {
    radioName: parts[0].trim(),
    radioUrl: parts.slice(1, -1).join(SEPARATOR).trim(),
    id: parts[parts.length - 1].trim(),
  };
}

export function formatRadio(radio: Radio): string {
  return [sanitizeRadioName(radio.radioName), radio.radioUrl.trim(), radio.id].join(SEPARATOR);
}

export const parseRadios = (entries: string[]): Radio[] => entries.map(parseRadio);
export const formatRadios = (radios: Radio[]): string[] => radios.map(formatRadio);

// Entries saved before ids existed are "name - url".
export function migrateRadios(entries: string[]): string[] {
  return entries.map((entry) => {
    const parts: string[] = entry.split(SEPARATOR);
    return parts.length === 2 ? formatRadio({ radioName: parts[0], radioUrl: parts[1], id: newRadioId() }) : entry;
  });
}

export function findRadioById(radios: Radio[], id: string): Radio | undefined {
  if (!id) return undefined;
  return radios.find((radio) => radio.id === id);
}

// The radio `step` places after (or before, when negative) the one with `id`, wrapping around.
export function neighborRadio(radios: Radio[], id: string, step: number): Radio | undefined {
  const index: number = id ? radios.findIndex((radio) => radio.id === id) : -1;
  if (index === -1) return undefined;
  return radios[(index + step + radios.length) % radios.length];
}
