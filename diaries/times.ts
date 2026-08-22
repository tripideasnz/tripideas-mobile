export function parseDiaryTopicTime(value: string): string | null {
  const compact = value.trim().toLowerCase().replace(/\s+/g, '');
  if (!compact) return null;
  const suffix = compact.endsWith('am') || compact.endsWith('pm') ? compact.slice(-2) : null;
  const time = suffix ? compact.slice(0, -2) : compact;
  let hourText: string; let minuteText: string;
  const separated = time.match(/^(\d{1,2})[:.](\d{2})$/);
  if (separated) [, hourText, minuteText] = separated;
  // A bare hour is intentionally treated as that hour on the 24-hour clock;
  // therefore `9` is 09:00, while explicit am/pm remains authoritative.
  else if (/^\d{1,2}$/.test(time)) { hourText = time; minuteText = '00'; }
  else if (/^\d{3,4}$/.test(time)) { hourText = time.slice(0, -2); minuteText = time.slice(-2); }
  else return null;
  let hour = Number(hourText); const minute = Number(minuteText);
  if (minute > 59) return null;
  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    if (suffix === 'am') hour = hour === 12 ? 0 : hour;
    else hour = hour === 12 ? 12 : hour + 12;
  } else if (hour > 23) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function formatDiaryTopicTime(value: string): string {
  const canonical = parseDiaryTopicTime(value);
  if (!canonical) return '';
  const [hourText, minute] = canonical.split(':'); const hour = Number(hourText);
  return `${hour % 12 || 12}:${minute} ${hour < 12 ? 'am' : 'pm'}`;
}
