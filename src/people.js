import { validateRecord } from './schema.js';

export function editPerson(person, name) {
  return validateRecord('people', { ...person, name: name.trim() });
}
export function personDeleteDescription(person, entries) {
  const owned = entries.filter(entry => entry.personId === person.id);
  if (!owned.length) return `${person.name} wird dauerhaft gelöscht.`;
  const references = owned.filter(entry => entry.type === 'person-note' && entry.kind === 'reference').length;
  const gifts = owned.filter(entry => entry.type === 'person-note' && entry.kind === 'gift').length;
  const dates = owned.filter(entry => entry.type === 'person-date').length;
  const other = owned.length - references - gifts - dates;
  const counts = [[references, 'Notiz', 'Notizen'], [gifts, 'Geschenkidee', 'Geschenkideen'], [dates, 'wichtiges Datum', 'wichtige Daten'], [other, 'weiterer Eintrag', 'weitere Einträge']]
    .filter(([count]) => count).map(([count, singular, plural]) => `${count} ${count === 1 ? singular : plural}`);
  return `Zu ${person.name} ${owned.length === 1 ? 'gehört' : 'gehören'} ${counts.join(', ')}. Die Person und alle zugehörigen Einträge werden dauerhaft gelöscht.`;
}
