export const INTERVAL_UNITS = ['minute', 'hour', 'day', 'week', 'month', 'year'];

export const INTERVAL_UNIT_LABELS = {
  minute: 'Minuten',
  hour: 'Stunden',
  day: 'Tage',
  week: 'Wochen',
  month: 'Monate',
  year: 'Jahre'
};
const INTERVAL_UNIT_SINGULAR = {
  minute: 'Minute',
  hour: 'Stunde',
  day: 'Tag',
  week: 'Woche',
  month: 'Monat',
  year: 'Jahr'
};

const MINUTES_PER_UNIT = { minute: 1, hour: 60, day: 1440, week: 10080, month: 43200, year: 525600 };
const LEGACY_UNITS = ['week', 'day', 'hour', 'minute'];
const MAX_DATE = 8640000000000000;

export function validateIntervalValue(interval, { allowZero = false } = {}) {
  if (!interval || typeof interval !== 'object' || Array.isArray(interval)
    || Object.keys(interval).some(key => !['value', 'unit'].includes(key))) {
    throw new Error('Ungültige Intervallangabe.');
  }
  const { value, unit } = interval;
  if (!Number.isInteger(value) || value < (allowZero ? 0 : 1) || value > 1000 || !INTERVAL_UNITS.includes(unit)) {
    throw new Error('Ungültige Intervalllänge.');
  }
  return { value, unit };
}

export function validateIntervalPair(interval, earlyBy) {
  if (interval == null) {
    if (earlyBy != null) throw new Error('Eine frühere Anzeige benötigt ein Intervall.');
    return;
  }
  validateIntervalValue(interval);
  if (earlyBy == null) return;
  validateIntervalValue(earlyBy, { allowZero: true });
  const approximateInterval = interval.value * MINUTES_PER_UNIT[interval.unit];
  const approximateEarlyBy = earlyBy.value * MINUTES_PER_UNIT[earlyBy.unit];
  if (approximateEarlyBy >= approximateInterval) throw new Error('Die frühere Anzeige muss kürzer als das Intervall sein.');
}

export function fromLegacyMinutes(minutes, { allowZero = false } = {}) {
  if (minutes == null) return null;
  if (allowZero && minutes === 0) return { value: 0, unit: 'minute' };
  if (!Number.isSafeInteger(minutes) || minutes < 1) throw new Error('Ungültiger Minutenwert.');
  for (const unit of LEGACY_UNITS) {
    const size = MINUTES_PER_UNIT[unit];
    if (minutes % size === 0) return { value: minutes / size, unit };
  }
  return { value: minutes, unit: 'minute' };
}

function addMonths(date, count) {
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + count);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
}

function addInterval(date, interval, multiplier) {
  const result = new Date(date);
  const count = interval.value * multiplier;
  if (interval.unit === 'minute') result.setTime(result.getTime() + count * 60000);
  else if (interval.unit === 'hour') result.setTime(result.getTime() + count * 3600000);
  else if (interval.unit === 'day') result.setDate(result.getDate() + count);
  else if (interval.unit === 'week') result.setDate(result.getDate() + count * 7);
  else if (interval.unit === 'month') addMonths(result, count);
  else if (interval.unit === 'year') addMonths(result, count * 12);
  if (!Number.isFinite(result.getTime()) || result.getTime() < 0 || result.getTime() > MAX_DATE) {
    throw new Error('Das Intervall liegt außerhalb des unterstützten Zeitraums.');
  }
  return result;
}

export function intervalDueAt(lastUsedAt, interval, earlyBy = null) {
  validateIntervalPair(interval, earlyBy);
  if (!Number.isFinite(lastUsedAt) || lastUsedAt < 0 || interval == null) return null;
  const due = addInterval(new Date(lastUsedAt), interval, 1);
  const earliest = earlyBy ? addInterval(due, earlyBy, -1) : due;
  return Math.max(lastUsedAt, earliest.getTime());
}

export function intervalLabel(interval) {
  if (interval == null) return '';
  const unit = intervalUnitLabel(interval.unit, interval.value);
  return `${interval.value} ${unit}`;
}

export function intervalUnitLabel(unit, value) {
  return value === 1 ? INTERVAL_UNIT_SINGULAR[unit] : INTERVAL_UNIT_LABELS[unit];
}
