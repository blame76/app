// Shell read views: existing records only, no storage or capture logic.
const dateFormat = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'long', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('de', { hour: '2-digit', minute: '2-digit' });
const newestFirst = (a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id);
const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function noteDays(entries, now = new Date()) {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const days = new Map();
  for (const entry of entries.filter(entry => entry.type === 'note').sort(newestFirst)) {
    const date = new Date(entry.createdAt);
    const key = dayKey(date);
    if (!days.has(key)) days.set(key, {
      key,
      label: key === dayKey(now) ? 'Heute' : key === dayKey(yesterday) ? 'Gestern' : dateFormat.format(date),
      entries: []
    });
    days.get(key).entries.push(entry);
  }
  return [...days.values()];
}

export function sortedPeople(people) {
  return [...people].sort((a, b) => a.name.localeCompare(b.name, 'de') || a.id.localeCompare(b.id));
}

export function personEntries(entries, personId, kind) {
  return entries.filter(entry => entry.type === 'person-note' && entry.personId === personId && entry.kind === kind).sort(newestFirst);
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function empty(root, text) { root.append(element('p', text, 'muted')); }

function entryList(entries, includeDate = false) {
  const list = element('ol', undefined, 'read-list');
  for (const entry of entries) {
    const item = element('li');
    const time = element('time', includeDate ? dateFormat.format(entry.createdAt) : timeFormat.format(entry.createdAt), 'muted');
    time.dateTime = new Date(entry.createdAt).toISOString();
    time.title = `${dateFormat.format(entry.createdAt)} · ${timeFormat.format(entry.createdAt)}`;
    if (includeDate) time.setAttribute('aria-label', time.title);
    const text = element('p', entry.text, 'read-text');
    if (includeDate) item.append(text, time);
    else item.append(time, text);
    list.append(item);
  }
  return list;
}

function group(root, id, label, entries) {
  const section = element('section', undefined, 'read-group');
  const personGroup = id === 'read-references' || id === 'read-gifts';
  if (personGroup) section.classList.add('read-person-group', id);
  const heading = element('h2', label, 'section-title');
  heading.id = id;
  section.setAttribute('aria-labelledby', id);
  section.append(heading, entryList(entries, personGroup));
  root.append(section);
}

export function renderNotes(root, entries) {
  const days = noteDays(entries);
  if (!days.length) { empty(root, 'Noch keine Notizen.'); return; }
  for (const day of days) group(root, `read-day-${day.key}`, day.label, day.entries);
}

export function renderPeople(root, people) {
  if (!people.length) { empty(root, 'Noch keine Personen.'); return; }
  const list = element('ul', undefined, 'read-people');
  for (const person of sortedPeople(people)) {
    const item = element('li');
    const button = element('button', undefined, 'helper-list-item');
    button.type = 'button';
    button.dataset.person = person.id;
    const arrow = element('span', '›');
    arrow.setAttribute('aria-hidden', 'true');
    button.append(element('span', person.name), arrow);
    item.append(button);
    list.append(item);
  }
  root.append(list);
}

export function renderPerson(root, person, entries) {
  const references = personEntries(entries, person.id, 'reference');
  const gifts = personEntries(entries, person.id, 'gift');
  if (!references.length && !gifts.length) { empty(root, 'Noch keine Einträge.'); return; }
  if (references.length) group(root, 'read-references', 'Referenzen', references);
  if (gifts.length) group(root, 'read-gifts', 'Geschenkideen', gifts);
}
