import { renderPersonDates, renderPersonActions } from './people-views.js';
// Shell read views: existing records only, no storage or capture logic.
import { noteLinks } from './notes.js';
import { noteTextClass } from './note-presentation.js';
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

function entryList(entries, includeDate = false, places = []) {
  const list = element('ol', undefined, 'read-list');
  for (const entry of entries) {
    const item = element('li');
    const time = element('time', includeDate ? dateFormat.format(entry.createdAt) : timeFormat.format(entry.createdAt), 'muted');
    time.dateTime = new Date(entry.createdAt).toISOString();
    time.title = `${dateFormat.format(entry.createdAt)} · ${timeFormat.format(entry.createdAt)}`;
    if (includeDate) time.setAttribute('aria-label', time.title);
    const text = element(includeDate ? 'span' : 'p', entry.text, `read-text ${noteTextClass(entry.text)}`);
    if (includeDate) {
      const button = element('button', undefined, 'person-note-button');
      button.type = 'button';
      button.dataset.note = entry.id;
      button.append(text, time);
      const links = noteLinks(entry, places);
      if (links.length) button.append(element('span', links.map(link => link.label).join(' · '), 'note-read-context muted'));
      item.append(button);
    }
    else item.append(time, text);
    list.append(item);
  }
  return list;
}

function group(root, id, label, entries, places = []) {
  const section = element('section', undefined, 'read-group');
  const personGroup = id === 'read-references' || id === 'read-gifts';
  if (personGroup) section.classList.add('read-person-group', id);
  const heading = element('h2', label, 'section-title');
  heading.id = id;
  section.setAttribute('aria-labelledby', id);
  section.append(heading, entryList(entries, personGroup, places));
  root.append(section);
}

export function renderNotes(root, entries, places = []) {
  const days = noteDays(entries);
  if (!days.length) { empty(root, 'Noch keine Notizen.'); return; }
  for (const day of days) {
    const section = element('section', undefined, 'read-group notes-day');
    const heading = element('h2', day.label, 'section-title');
    heading.id = `read-day-${day.key}`;
    section.setAttribute('aria-labelledby', heading.id);
    const list = element('ol', undefined, 'read-list');
    for (const note of day.entries) {
      const item = element('li');
      const button = element('button', undefined, 'note-read-button');
      button.type = 'button';
      button.dataset.note = note.id;
      const time = element('time', timeFormat.format(note.createdAt), 'muted');
      time.dateTime = new Date(note.createdAt).toISOString();
      time.title = `${dateFormat.format(note.createdAt)} · ${timeFormat.format(note.createdAt)}`;
      const content = element('span', undefined, 'note-read-content');
      content.append(element('span', note.text, `read-text ${noteTextClass(note.text)}`));
      const links = noteLinks(note, places);
      if (links.length) content.append(element('span', links.map(link => link.label).join(' · '), 'note-read-context muted'));
      button.append(time, content);
      item.append(button);
      list.append(item);
    }
    section.append(heading, list);
    root.append(section);
  }
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

export function renderPerson(root, person, entries, places = []) {
  const references = personEntries(entries, person.id, 'reference');
  const gifts = personEntries(entries, person.id, 'gift');
  renderPersonDates(root, person, entries);
  if (references.length) group(root, 'read-references', 'Notizen', references, places);
  if (gifts.length) group(root, 'read-gifts', 'Geschenkideen', gifts, places);
  renderPersonActions(root, person);
}
