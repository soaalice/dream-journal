/**
 * Day keys ("YYYY-MM-DD") are calendar days already worked out by the server in the person's time zone, so they are
 * handled as plain UTC dates here: no time zone arithmetic can shift them by a day.
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const parseDay = (key: string): Date => new Date(`${key}T00:00:00Z`);
export const formatKey = (date: Date): string => date.toISOString().slice(0, 10);
export const addDays = (key: string, n: number): string => formatKey(new Date(parseDay(key).getTime() + n * MS_PER_DAY));

/** 0 = Monday ... 6 = Sunday */
export const mondayIndex = (key: string): number => (parseDay(key).getUTCDay() + 6) % 7;

export const formatDay = (key: string): string =>
  parseDay(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const shortMonth = (key: string): string =>
  parseDay(key.length === 7 ? `${key}-01` : key).toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
