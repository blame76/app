import { completeWaitingEntry, createWaitingEntry, dateLabel, localDateKey, saveWaitingEntry, updateWaitingEntry, validateWaitingEntry, waitingDateLabel, waitingGroups, waitingNowCard } from './model.js';

const dateTime = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

export default {
  id: 'warte-auf',
  label: 'Warte auf',
  category: 'Alltag',
  validateEntry: validateWaitingEntry,
  nowCard: waitingNowCard,
  offlineAssets: ['./src/helpers/warte-auf/model.js', './src/helpers/warte-auf/styles.css'],
  async mount({ root, api, signal }) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = new URL('./styles.css', import.meta.url).href;
    root.append(css);

    let entries = await api.listEntries();
    if (signal.aborted) return () => css.remove();
    entries.forEach(validateWaitingEntry);
    const host = document.createElement('div');
    host.className = 'warte-auf';
    root.append(host);
    let view = 'list';
    let selectedId = null;
    let busy = false;

    function announce(message) {
      const status = host.querySelector('[role="status"]');
      if (status) status.textContent = message;
    }

    function focusTitle() { host.querySelector('h2[tabindex="-1"]')?.focus(); }

    function setView(nextView, id = null) {
      view = nextView;
      selectedId = id;
      render();
    }

    function currentEntry() { return entries.find(entry => entry.id === selectedId); }

    function addGroup(parent, title, values, { completed = false } = {}) {
      if (!values.length) return;
      const section = document.createElement('section');
      section.className = 'warte-auf-group';
      const heading = document.createElement('h3');
      heading.textContent = title;
      section.append(heading);
      const list = document.createElement('ul');
      for (const entry of values) {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'warte-auf-item';
        button.addEventListener('click', () => setView('detail', entry.id));
        const text = document.createElement('strong');
        text.textContent = entry.text;
        button.append(text);
        const metadata = [entry.waitingForText, entry.expectedDate ? waitingDateLabel(entry.expectedDate) : '']
          .filter(Boolean).join(' · ');
        if (metadata) {
          const detail = document.createElement('span');
          detail.className = 'muted';
          detail.textContent = metadata;
          button.append(detail);
        }
        if (completed) {
          const state = document.createElement('span');
          state.className = 'muted';
          state.textContent = 'Erledigt';
          button.append(state);
        }
        item.append(button);
        list.append(item);
      }
      section.append(list);
      parent.append(section);
    }

    function makeForm({ heading, values = {}, dateOnly = false, includeDate = true, submitLabel }) {
      const form = document.createElement('form');
      form.className = 'stack warte-auf-form';
      const title = document.createElement('h2');
      title.tabIndex = -1;
      title.textContent = heading;
      form.append(title);
      const fields = dateOnly
        ? [['expectedDate', 'Wann wieder zeigen?', 'date']]
        : [
          ['text', 'Worauf wartest du?', 'text'],
          ['waitingForText', 'Von wem? (optional)', 'text'],
          ...(includeDate ? [['expectedDate', 'Wann wieder zeigen? (optional)', 'date']] : [])
        ];
      for (const [name, labelText, type] of fields) {
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.name = name;
        input.type = type;
        if (name === 'text') {
          input.required = true;
          input.maxLength = 300;
          input.addEventListener('input', () => input.setCustomValidity(''));
        }
        if (name === 'waitingForText') input.maxLength = 120;
        input.value = values[name] || '';
        label.append(input);
        form.append(label);
      }
      const actions = document.createElement('div');
      actions.className = 'actions';
      const submit = document.createElement('button');
      submit.type = 'submit';
      submit.textContent = submitLabel;
      actions.append(submit);
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'secondary';
      cancel.textContent = 'Abbrechen';
      cancel.addEventListener('click', () => api.goBack());
      actions.append(cancel);
      form.append(actions);
      const status = document.createElement('p');
      status.className = 'muted';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      form.append(status);
      return form;
    }

    async function perform(action, fallback) {
      if (busy || signal.aborted) return;
      busy = true;
      host.setAttribute('aria-busy', 'true');
      const controls = [...host.querySelectorAll('button, input')];
      controls.forEach(control => { control.disabled = true; });
      try {
        await action();
      } catch (error) {
        if (!signal.aborted) api.toast(error.name === 'QuotaExceededError'
          ? 'Browser-Speicher voll. Die Änderung konnte nicht gespeichert werden. Bitte erneut versuchen.'
          : fallback);
      } finally {
        busy = false;
        host.removeAttribute('aria-busy');
        controls.forEach(control => { control.disabled = false; });
      }
    }

    function openList() {
      setView('list');
      announce('Wieder im Blick aktualisiert.');
      focusTitle();
    }

    async function commit(entry, message) {
      const result = await saveWaitingEntry(api, entry);
      if (signal.aborted) return;
      entries = [...entries.filter(item => item.id !== result.entry.id), result.entry];
      view = 'list';
      selectedId = null;
      render();
      announce(message);
      focusTitle();
      if (result.usageError) api.toast('Gespeichert. Der Nutzungszeitpunkt konnte nicht aktualisiert werden.');
    }

    function renderList() {
      const heading = document.createElement('h2');
      heading.id = 'warteAufTitle';
      heading.className = 'section-title';
      heading.tabIndex = -1;
      heading.textContent = 'Warte auf';
      host.append(heading);
      const intro = document.createElement('p');
      intro.className = 'muted';
      intro.textContent = 'Was liegt gerade nicht bei mir – und wann soll es wieder in meinen Blick kommen?';
      host.append(intro);
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.className = 'muted';
      host.append(status);

      const groups = waitingGroups(entries);
      addGroup(host, 'Wieder im Blick', groups.due);
      addGroup(host, 'Später im Blick', groups.later);
      addGroup(host, 'Ohne Wiedervorlage', groups.undated);
      if (!groups.due.length && !groups.later.length && !groups.undated.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = 'Noch keine offenen Einträge.';
        host.append(empty);
      }
      if (groups.done.length) {
        const completed = document.createElement('details');
        completed.className = 'warte-auf-completed';
        const summary = document.createElement('summary');
        summary.textContent = `Erledigt (${groups.done.length})`;
        completed.append(summary);
        addGroup(completed, 'Abgeschlossen', groups.done, { completed: true });
        host.append(completed);
      }

      const form = makeForm({ heading: 'Worauf wartest du?', submitLabel: 'Merken' });
      form.id = 'warteAufCreateForm';
      form.querySelector('h2').className = 'section-title';
      form.addEventListener('submit', event => {
        event.preventDefault();
        form.elements.text.setCustomValidity(form.elements.text.value.trim() ? '' : 'Bitte beschreiben, worauf du wartest.');
        if (!form.reportValidity()) return;
        const values = Object.fromEntries(new FormData(form));
        perform(async () => {
          await commit(createWaitingEntry(values), 'Eintrag gemerkt.');
        }, 'Eintrag konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten.');
      });
      host.append(form);
    }

    function showDetail(entry) {
      const heading = document.createElement('h2');
      heading.className = 'section-title';
      heading.tabIndex = -1;
      heading.textContent = entry.text;
      host.append(heading);
      const metadata = document.createElement('dl');
      metadata.className = 'warte-auf-metadata';
      const fields = [
        ...(entry.waitingForText ? [['Wartet auf', entry.waitingForText]] : []),
        ['Eingetragen', dateTime.format(entry.createdAt)],
        ...(entry.expectedDate ? [['Wieder im Blick', dateLabel(entry.expectedDate)]] : []),
        ...(entry.status === 'done' ? [['Erledigt', dateTime.format(entry.completedAt)]] : [])
      ];
      for (const [label, value] of fields) {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        term.textContent = label;
        const description = document.createElement('dd');
        description.textContent = value;
        row.append(term, description);
        metadata.append(row);
      }
      host.append(metadata);
      const actions = document.createElement('div');
      actions.className = 'stack warte-auf-detail-actions';
      if (entry.status === 'waiting') {
        const done = document.createElement('button');
        done.type = 'button';
        done.textContent = 'Erledigt';
        done.addEventListener('click', () => perform(async () => {
          await commit(completeWaitingEntry(entry), 'Erledigt.');
        }, 'Eintrag konnte nicht abgeschlossen werden. Bitte erneut versuchen.'));
        actions.append(done);
        const wait = document.createElement('button');
        wait.type = 'button';
        wait.className = 'secondary';
        wait.textContent = 'Weiter warten';
        wait.addEventListener('click', () => setView('wait', entry.id));
        actions.append(wait);
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'quiet';
        edit.textContent = 'Bearbeiten';
        edit.addEventListener('click', () => setView('edit', entry.id));
        actions.append(edit);
      }
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'quiet danger-text';
      remove.textContent = 'Löschen';
      remove.addEventListener('click', () => {
        if (!confirm('Eintrag wirklich löschen?')) return;
        perform(async () => {
          await api.deleteEntry(entry.id);
          if (signal.aborted) return;
          entries = entries.filter(item => item.id !== entry.id);
          openList();
        }, 'Eintrag konnte nicht gelöscht werden. Bitte erneut versuchen.');
      });
      actions.append(remove);
      host.append(actions);
    }

    function showEdit(entry) {
      const form = makeForm({ heading: 'Eintrag bearbeiten', values: entry, includeDate: false, submitLabel: 'Änderungen speichern' });
      form.id = 'warteAufEditForm';
      form.addEventListener('submit', event => {
        event.preventDefault();
        form.elements.text.setCustomValidity(form.elements.text.value.trim() ? '' : 'Bitte beschreiben, worauf du wartest.');
        if (!form.reportValidity()) return;
        const values = { ...Object.fromEntries(new FormData(form)), expectedDate: entry.expectedDate || '' };
        perform(async () => {
          const updated = updateWaitingEntry(entry, values);
          const changed = updated.text !== entry.text
            || updated.waitingForText !== entry.waitingForText;
          if (!changed) { setView('detail', entry.id); return; }
          await commit(updated, 'Änderungen gespeichert.');
        }, 'Änderungen konnten nicht gespeichert werden. Deine Eingaben bleiben erhalten.');
      });
      host.append(form);
    }

    function showWait(entry) {
      const form = makeForm({ heading: 'Weiter warten', values: entry, dateOnly: true, submitLabel: 'Wiedervorlage speichern' });
      form.id = 'warteAufWaitForm';
      const dateInput = form.elements.expectedDate;
      const label = form.querySelector('label');
      const help = document.createElement('span');
      help.className = 'muted';
      help.textContent = 'Ohne Datum bleibt der Eintrag offen, wird aber nicht automatisch wieder im Blick angezeigt.';
      label.append(help);
      form.addEventListener('submit', event => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        perform(async () => {
          const updated = updateWaitingEntry(entry, {
            text: entry.text,
            waitingForText: entry.waitingForText,
            expectedDate: dateInput.value
          });
          if (updated.expectedDate === entry.expectedDate) { setView('detail', entry.id); return; }
          await commit(updated, updated.expectedDate ? 'Wiedervorlage geändert.' : 'Wiedervorlagedatum entfernt.');
        }, 'Wiedervorlage konnte nicht gespeichert werden. Bitte erneut versuchen.');
      });
      host.append(form);
    }

    function render() {
      host.replaceChildren();
      if (view === 'list') {
        api.setBackAction(null);
        renderList();
      }
      else {
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'quiet warte-auf-back';
        back.textContent = 'Zurück';
        back.addEventListener('click', () => api.goBack());
        host.append(back);
        const entry = currentEntry();
        if (!entry) {
          view = 'list';
          selectedId = null;
          renderList();
          return;
        }
        if (view === 'detail') showDetail(entry);
        else if (view === 'edit') showEdit(entry);
        else showWait(entry);
        const currentView = view;
        api.setBackAction(() => {
          if (!busy) setView(currentView === 'detail' ? 'list' : 'detail', currentView === 'detail' ? null : entry.id);
        }, currentView === 'detail' ? 'Warte auf' : 'Eintrag');
      }
      focusTitle();
    }

    render();
    return () => css.remove();
  }
};
