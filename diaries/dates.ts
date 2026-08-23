const DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{1,4})$/;

export function parseDiaryDate(input: string): string | null {
  const match = DATE_PATTERN.exec(input.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = match[3].length <= 2 ? 2000 + rawYear : rawYear;
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1) return null;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatDiaryDate(value: string | null): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date);
}

export function formatDiaryDateInput(value: string | null): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${Number(match[3])}/${Number(match[2])}/${match[1]}` : '';
}

export function diaryDateRange(startDate: string | null, endDate: string | null): string[] {
  if (!startDate && !endDate) return [];
  const start = startDate ?? endDate!;
  const end = endDate ?? startDate!;
  if (start > end) return [];
  const values: string[] = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const final = new Date(`${end}T00:00:00.000Z`);
  while (cursor <= final) {
    values.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return values;
}

export function validateDiaryDateRange(startDate: string | null, endDate: string | null): string | null {
  return startDate && endDate && startDate > endDate ? 'End date must not be before start date.' : null;
}

export function adjacentDiaryDate(dates: string[], current: string, offset: -1 | 1): string | null {
  const index = dates.indexOf(current);
  return index < 0 ? null : dates[index + offset] ?? null;
}

export function offsetDiaryDate(current: string, offset: -1 | 1): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(current)) return null;
  const value = new Date(`${current}T00:00:00.000Z`);
  if (Number.isNaN(value.valueOf())) return null;
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

export function outsideDiaryRange(date: string, startDate: string | null, endDate: string | null): boolean {
  return Boolean((startDate && date < startDate) || (endDate && date > endDate));
}

export function instantiatedDiaryIndex<T extends { date: string }>(days: T[]): T[] {
  return [...days].sort((left, right) => left.date.localeCompare(right.date));
}
