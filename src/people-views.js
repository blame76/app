import { personDateLabel, leadLabel } from './person-dates.js';

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text, id, action, className = 'quiet') {
  const node = element('button', text, className);
  node.type = 'button'; node.id = id;
  node.addEventListener('click', action);
  return node;
}
function field(form, label, name, type, value, attributes = {}) {
  const wrapper = element('label', label);
  const input = element('input');
  Object.assign(input, { name, type, value, required: true, ...attributes });
  wrapper.append(input); form.append(wrapper);
  return input;
}
export function renderPersonEdit(root, person, cancel) {
  const form = element('form', undefined, 'stack');
  form.id = 'personEditForm';
  field(form, 'Name', 'name', 'text', person.name);
  const save = element('button', 'Speichern'); save.type = 'submit';
  form.append(save, button('Abbrechen', 'personEditCancel', cancel));
  root.append(form);
  return form;
}
export function renderPersonDates(root, person, entries) {
  const section = element('section', undefined, 'read-group read-person-group');
  const heading = element('h2', 'Wichtige Daten', 'section-title');
  heading.id = 'read-dates'; section.setAttribute('aria-labelledby', heading.id);
  section.append(heading);
  const list = element('ul', undefined, 'read-list');
  for (const entry of entries.filter(entry => entry.type === 'person-date' && entry.personId === person.id)) {
    const item = element('li');
    const open = element('button', undefined, 'person-note-button');
    open.type = 'button'; open.dataset.personDate = entry.id;
    open.append(element('strong', entry.label), element('span', personDateLabel(entry)), element('span', `${entry.recurrence === 'once' ? 'Einmal' : 'Jährlich'} · ${leadLabel(entry.showBeforeDays)}`, 'muted'));
    item.append(open); list.append(item);
  }
  section.append(list);
  const add = element('button', 'Wichtiges Datum hinzufügen', 'quiet');
  add.type = 'button'; add.id = 'personDateAdd'; add.dataset.addPersonDate = person.id;
  section.append(add); root.append(section);
}
export function renderPersonActions(root, person) {
  const actions = element('div', undefined, 'stack person-actions');
  for (const [text, id, key, className] of [['Person bearbeiten', 'personEdit', 'editPerson', 'quiet'], ['Person löschen', 'personDelete', 'deletePerson', 'quiet danger-text']]) {
    const control = element('button', text, className);
    control.type = 'button'; control.id = id; control.dataset[key] = person.id;
    actions.append(control);
  }
  root.append(actions);
}
export function renderPersonDate(root, entry, person, actions) {
  const article = element('article', undefined, 'stack');
  article.append(element('p', person.name, 'note-person-name'), element('h2', entry.label, 'section-title'), element('p', personDateLabel(entry)),
    element('p', `${entry.recurrence === 'once' ? 'Einmal' : 'Jährlich'} · ${leadLabel(entry.showBeforeDays)}`));
  if (entry.recurrence === 'yearly' && entry.month === 2 && entry.day === 29) article.append(element('p', 'Nur in Schaltjahren.', 'muted'));
  article.append(button('Bearbeiten', 'personDateEdit', actions.edit), button('Wichtiges Datum löschen', 'personDateDelete', actions.remove, 'quiet danger-text'));
  root.append(article);
}
export function renderPersonDateEdit(root, entry, actions) {
  const form = element('form', undefined, 'stack'); form.id = 'personDateForm';
  field(form, 'Anlass', 'label', 'text', entry.label || '', { maxLength: 100 });
  const repetition = element('fieldset'); repetition.append(element('legend', 'Wiederholung'));
  for (const [value, text] of [['once', 'Einmal'], ['yearly', 'Jährlich']]) {
    const label = element('label', undefined, 'check-row');
    const input = element('input');
    Object.assign(input, { type: 'radio', name: 'recurrence', value, checked: entry.recurrence === value, required: true });
    label.append(input, element('span', text)); repetition.append(label);
  }
  form.append(repetition);
  const once = element('div', undefined, 'stack');
  field(once, 'Datum', 'date', 'date', entry.date || '', { min: '0001-01-01', max: '9999-12-31' });
  const yearly = element('div', undefined, 'form-grid two');
  field(yearly, 'Tag', 'day', 'number', entry.day || '', { min: 1, max: 31, step: 1, inputMode: 'numeric' });
  const monthField = element('div', undefined, 'stack');
  const monthLabel = element('label', 'Monat'); monthLabel.htmlFor = 'personDateMonth';
  const month = element('select'); month.id = 'personDateMonth'; month.name = 'month'; month.required = true;
  for (let i = 1; i <= 12; i++) {
    const option = element('option', new Intl.DateTimeFormat('de', { month: 'long' }).format(new Date(2000, i - 1, 1)));
    option.value = i; month.append(option);
  }
  month.value = entry.month || 1; monthField.append(monthLabel, month); yearly.append(monthField);
  form.append(once, yearly);
  const leapHint = element('p', 'Der 29. Februar erscheint nur in Schaltjahren.', 'muted'); form.append(leapHint);
  const update = () => {
    const annual = form.elements.namedItem('recurrence').value === 'yearly';
    once.hidden = annual; yearly.hidden = !annual; leapHint.hidden = !annual;
    for (const input of once.querySelectorAll('input')) input.disabled = annual;
    for (const input of yearly.querySelectorAll('input, select')) input.disabled = !annual;
  };
  repetition.addEventListener('change', update); update();
  field(form, 'Vorher zeigen (Tage)', 'showBeforeDays', 'number', entry.showBeforeDays ?? 7, { min: 0, max: 365, step: 1, inputMode: 'numeric' });
  const save = element('button', 'Speichern'); save.type = 'submit'; form.append(save);
  if (actions.remove) form.append(button('Wichtiges Datum löschen', 'personDateDelete', actions.remove, 'quiet danger-text'));
  form.append(button('Abbrechen', 'personDateCancel', actions.cancel));
  root.append(form); return form;
}
