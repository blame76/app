// Calendar-only core entries. February 29 occurs only in leap years.
function calendarDate(year, month, day) {
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}
function validDay(year, month, day) {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1) return false;
  const date = calendarDate(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
export function validatePersonDate(entry) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  check(typeof entry.personId === 'string' && entry.personId.trim(), 'Bitte eine Person zuordnen.');
  check(typeof entry.label === 'string' && entry.label.trim() && entry.label.length <= 100, 'Bitte einen Anlass mit höchstens 100 Zeichen eingeben.');
  check(['once', 'yearly'].includes(entry.recurrence), 'Bitte Einmal oder Jährlich wählen.');
  check(Number.isInteger(entry.showBeforeDays) && entry.showBeforeDays >= 0 && entry.showBeforeDays <= 365, 'Bitte 0 bis 365 ganze Tage als Vorlauf eingeben.');
  const fields = ['id', 'type', 'personId', 'label', 'recurrence', 'showBeforeDays', 'createdAt'];
  if (entry.recurrence === 'once') {
    check(typeof entry.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date), 'Bitte ein gültiges Datum eingeben.');
    const [year, month, day] = entry.date.split('-').map(Number);
    check(year >= 1 && validDay(year, month, day), 'Bitte ein gültiges Datum eingeben.');
    fields.push('date');
  } else {
    check(validDay(2000, entry.month, entry.day), 'Bitte einen gültigen Tag und Monat eingeben.');
    fields.push('month', 'day');
  }
  check(Object.keys(entry).every(key => fields.includes(key)), 'Unzulässiges Feld für ein wichtiges Datum.');
  return entry;
}
export function editPersonDate(original, values) {
  const { date, month, day, ...base } = original;
  return validatePersonDate({ ...base, label: values.label.trim(), recurrence: values.recurrence,
    showBeforeDays: values.showBeforeDays,
    ...(values.recurrence === 'once' ? { date: values.date } : { month: values.month, day: values.day }) });
}
export function personDateLabel(entry, { year = entry.recurrence === 'once' } = {}) {
  const date = entry.recurrence === 'once' ? calendarDate(...entry.date.split('-').map(Number)) : calendarDate(2000, entry.month, entry.day);
  return new Intl.DateTimeFormat('de', { day: 'numeric', month: 'long', ...(year ? { year: 'numeric' } : {}) }).format(date);
}
export function leadLabel(days) { return `${days} ${days === 1 ? 'Tag' : 'Tage'} vorher`; }
// UTC is used only to number local calendar components, never to divide local elapsed time.
function dayNumber(date) {
  const utc = new Date(0);
  utc.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  utc.setUTCHours(0, 0, 0, 0);
  return utc.getTime() / 86400000;
}
export function relevantPersonDates(entries, people, now = Date.now()) {
  const today = new Date(now);
  const todayNumber = dayNumber(today);
  let nextChangeAt = Infinity;
  const items = [];
  for (const entry of entries) {
    if (entry.type !== 'person-date') continue;
    const person = people.find(person => person.id === entry.personId);
    if (!person) continue;
    let occurrence;
    if (entry.recurrence === 'once') occurrence = calendarDate(...entry.date.split('-').map(Number));
    else {
      // Eight years also covers the skipped leap year at a century boundary (2100).
      for (let year = today.getFullYear(); year <= today.getFullYear() + 8; year++) {
        if (!validDay(year, entry.month, entry.day)) continue;
        const candidate = calendarDate(year, entry.month, entry.day);
        if (dayNumber(candidate) >= todayNumber) { occurrence = candidate; break; }
      }
    }
    if (!occurrence) continue;
    const days = dayNumber(occurrence) - todayNumber;
    if (days < 0) continue;
    const active = days <= entry.showBeforeDays;
    const boundary = active ? calendarDate(today.getFullYear(), today.getMonth() + 1, today.getDate() + 1) : new Date(occurrence);
    if (!active) boundary.setDate(boundary.getDate() - entry.showBeforeDays);
    const nextAt = boundary.getTime();
    nextChangeAt = Math.min(nextChangeAt, nextAt);
    if (active) items.push({ entry, person, primary: `${entry.label} ${days === 0 ? 'heute' : days === 1 ? 'morgen' : `in ${days} Tagen`}`,
      secondary: personDateLabel(entry, { year: false }), nextChangeAt: nextAt, days });
  }
  items.sort((a, b) => a.days - b.days || a.entry.id.localeCompare(b.entry.id));
  return { items, nextChangeAt: Number.isFinite(nextChangeAt) ? nextChangeAt : null };
}
