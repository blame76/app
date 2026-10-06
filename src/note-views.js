import { noteContext, noteLinks, noteLabel } from './notes.js';
import { timeBucketLabel } from './context.js';
import { DEFAULT_TIME_WINDOWS, findTimeWindow } from './time-windows.js';
import { noteTextClass } from './note-presentation.js';
import { formatDistance, getLocationDebugInfo } from './debug.js';

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text, id, action, className = 'quiet') {
  const node = element('button', text, className);
  node.type = 'button';
  node.id = id;
  node.addEventListener('click', action);
  return node;
}
function timestamp(at, compact = false) {
  const full = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(at);
  const time = element('time', compact ? new Intl.DateTimeFormat('de', { hour: '2-digit', minute: '2-digit' }).format(at) : full);
  time.dateTime = new Date(at).toISOString();
  if (compact) { time.title = full; time.setAttribute('aria-label', full); }
  return time;
}

export function renderNote(root, note, places, actions, person = null, { debugMode = false, position = null, timeWindows = DEFAULT_TIME_WINDOWS } = {}) {
  const article = element('article', undefined, 'note-detail');
  if (note.type === 'person-note') article.append(element('p', person?.name || 'Person nicht mehr gespeichert', 'note-person-name'));
  article.append(element('p', note.text, `note-text ${noteTextClass(note.text)}`));
  const dates = element('div', undefined, 'note-dates muted');
  dates.append(timestamp(note.createdAt));
  if (note.updatedAt !== undefined) {
    const edited = element('p', 'Bearbeitet ', 'note-edited');
    edited.append(timestamp(note.updatedAt, true));
    dates.append(edited);
  }
  
  // Add debug distance info if debug mode is enabled
  if (debugMode && position) {
    const context = noteContext(note);
    if (context.placeIds && context.placeIds.length > 0) {
      const debugInfo = getLocationDebugInfo(position, places, context);
      const debugLine = element('p', undefined, 'note-debug-distance muted');
      const distance = formatDistance(debugInfo.distance);
      const statusText = debugInfo.status ? ` · ${debugInfo.status}` : '';
      debugLine.textContent = `🔍 Aktueller Abstand zum Ort: ${distance}${statusText}`;
      dates.append(debugLine);
    }
  }
  
  article.append(dates);
  const context = element('section', undefined, 'note-context-summary');
  const heading = element('h2', 'Wieder zeigen', 'note-eyebrow');
  heading.id = 'noteContextTitle';
  context.setAttribute('aria-labelledby', heading.id);
  context.append(heading);
  const links = noteLinks(note, places, timeWindows);
  if (links.length) {
    const list = element('ul', undefined, 'note-links');
    for (const link of links) list.append(element('li', link.label));
    context.append(list);
  } else context.append(element('p', 'Keine Verknüpfung', 'muted'));
  const controls = element('div', undefined, 'note-actions');
  controls.append(button('Bearbeiten', 'noteEdit', actions.edit), button(links.length ? 'Verknüpfung ändern' : 'Verknüpfung hinzufügen', 'noteContext', actions.context));
  article.append(context, controls, button(`${noteLabel(note)} löschen`, 'noteDelete', actions.remove, 'quiet danger-text note-delete'));
  root.append(article);
}

export function renderNoteEdit(root, note, cancel) {
  const form = element('form', undefined, 'stack note-edit');
  form.id = 'noteEditForm';
  const label = element('label', noteLabel(note), 'visually-hidden');
  label.htmlFor = 'noteEditText';
  const text = element('textarea', undefined, noteTextClass(note.text || ''));
  text.id = 'noteEditText';
  text.name = 'text';
  text.rows = 7;
  text.required = true;
  text.value = note.text || '';
  const save = element('button', 'Speichern', 'note-save quiet');
  save.type = 'submit';
  form.append(label, text, save, button('Abbrechen', 'noteEditCancel', cancel));
  root.append(form);
  return form;
}

export function renderNoteContext(root, note, places, actions, { capture = false, timeWindows = DEFAULT_TIME_WINDOWS } = {}) {
  const prefix = capture ? 'quickNote' : 'note';
  const section = element('div', undefined, 'note-context');
  if (capture) {
    const heading = element('h2', `Wann soll ${noteLabel(note) === 'Geschenkidee' ? 'diese Geschenkidee' : 'diese Notiz'} wieder auftauchen?`, 'note-context-question');
    heading.id = 'noteFollowupTitle';
    heading.tabIndex = -1;
    section.append(heading);
  }
  const links = noteLinks(note, places, timeWindows);
  if (links.length) {
    const list = element('ul', undefined, 'note-context-links');
    for (const [index, link] of links.entries()) {
      const item = element('li');
      const name = element('span', link.label);
      const remove = button('Entfernen', `${prefix}Unlink${index}`, () => actions.remove(link));
      remove.setAttribute('aria-label', `${link.label} entfernen`);
      item.append(name, remove);
      list.append(item);
    }
    section.append(list);
  }
  const choices = element('div', undefined, 'note-context-choices');
  choices.append(button('Ort', `${prefix}ChoosePlace`, () => actions.choose('placeIds'), 'secondary'), button('Zeitfenster', `${prefix}ChooseTime`, () => actions.choose('timeBuckets'), 'secondary'));
  section.append(choices, element('p', 'Eine passende Bedingung reicht.', 'muted'), button('Fertig', `${prefix}ContextDone`, actions.done));
  root.append(section);
}

export function renderNoteContextPicker(root, note, places, kind, cancel, { capture = false, timeWindows = DEFAULT_TIME_WINDOWS } = {}) {
  const prefix = capture ? 'quickNote' : 'note';
  const context = noteContext(note);
  const options = kind === 'placeIds'
    ? [...places.map(place => ({ id: place.id, label: place.name })), ...context.placeIds.filter(id => !places.some(place => place.id === id)).map(id => ({ id, label: 'Ort nicht mehr gespeichert' }))]
    : [
      ...timeWindows.map(window => ({ id: window.id, label: timeBucketLabel(window.id, { capitalize: true, timeWindows }) })),
      ...context.timeBuckets
        .filter(id => !findTimeWindow(id, timeWindows))
        .map(id => ({ id, label: 'Zeitfenster nicht mehr vorhanden' }))
    ];
  const form = element('form', undefined, 'stack note-context-picker');
  form.id = `${prefix}ContextForm`;
  const fieldset = element('fieldset');
  fieldset.append(element('legend', kind === 'placeIds' ? 'An einem Ort' : 'In einem Zeitfenster', 'note-eyebrow'));
  if (!options.length) fieldset.append(element('p', kind === 'placeIds' ? 'Noch kein Ort gespeichert.' : 'Noch kein Zeitfenster verfügbar.', 'muted'));
  for (const option of options) {
    const label = element('label', undefined, 'note-context-option');
    const input = element('input');
    input.type = 'checkbox';
    input.name = 'context';
    input.value = option.id;
    input.checked = context[kind].includes(option.id);
    label.append(input, element('span', option.label));
    fieldset.append(label);
  }
  const save = element('button', 'Speichern');
  save.type = 'submit';
  save.disabled = !options.length;
  form.append(fieldset, save, button('Abbrechen', `${prefix}ContextCancel`, cancel));
  root.append(form);
  return form;
}
