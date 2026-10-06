export function formatTime(time: string | number | undefined): string {
  const parsed = parseInt(String(time), 10);

  if (Number.isNaN(parsed)) return '00:00';

  const hours = Math.floor(parsed / 3600);
  const minutes = String(Math.floor((parsed % 3600) / 60)).padStart(2, '0');
  const seconds = String(Math.floor(parsed % 60)).padStart(2, '0');

  return `${hours > 0 ? `${hours}:` : ''}${minutes}:${seconds}`;
}

export type IndicatorStatus = {
  radioName: string | null;
  paused: boolean;
  position: number;
  duration: number;
};

export function buildIndicatorStatus({ radioName, paused, position, duration }: IndicatorStatus): string {
  if (radioName === null) return 'Stopped';
  // live streams report no duration, so there is no end to show
  const time = duration > 0 ? `${formatTime(position)} / ${formatTime(duration)}` : formatTime(position);
  return `${radioName} - ${paused ? 'Paused' : 'Playing'} - ${time}`;
}
