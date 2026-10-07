import {
  createTraining, finishTraining, formatActivity, formatDuration, formatSets,
  latestActivityReference, latestSessionAtPlace, latestSession, normalizeActivityName,
  normalizeDisplayName, nextActivityId, orderedSessions, repeatStructure, sessionReference,
  validateTrainingEntry
} from './model.js';
import { intervalLabel } from '../../intervals.js';

const escape = value => String(value).replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[char]);
const dateLabel = value => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(value);
const shortDate = value => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(value);

function elapsed(value, now = Date.now()) {
  const recorded = new Date(value);
  const today = new Date(now);
  const days = Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
    - Date.UTC(recorded.getFullYear(), recorded.getMonth(), recorded.getDate())) / 86400000);
  if (days < 0) return shortDate(value);
  if (days === 0) return 'heute';
  if (days === 1) return 'vor 1 Tag';
  return `vor ${days} Tagen`;
}

function contextPlace(launchContext) {
  if (launchContext == null || launchContext.place == null) return null;
  const place = launchContext.place;
  if (typeof place.id !== 'string' || !place.id.trim() || typeof place.name !== 'string' || !place.name.trim()) {
    throw new Error('Der übergebene Ortskontext ist ungültig.');
  }
  return { id: place.id, name: place.name };
}

function sessionSummary(session) {
  return `<p class="training-session-date"><time datetime="${new Date(session.endedAt).toISOString()}" title="${escape(dateLabel(session.endedAt))}">${escape(shortDate(session.endedAt))}</time></p>
    ${session.title ? `<p class="training-session-title">${escape(session.title)}</p>` : ''}
    <ul class="training-summary-list">${session.activities.filter(activity => activity.mode === 'sets' ? activity.sets.length : activity.mode === 'duration' ? activity.durationSeconds !== undefined : activity.distanceMeters !== undefined).map(activity => `<li><strong>${escape(activity.name)}</strong><span>${escape(formatActivity(activity))}</span></li>`).join('')}</ul>`;
}

function activityDetails(activity) {
  return activity ? `<p class="training-last"><strong>Letztes Mal:</strong> ${escape(formatActivity(activity.activity))} · ${escape(shortDate(activity.session.endedAt))}</p>` : '';
}

export default {
  id: 'training',
  label: 'Training',
  category: 'Wohlbefinden',
  defaultVisible: true,
  contexts: ['place', 'interval'],
  defaults: { interval: { value: 3, unit: 'day' }, earlyBy: { value: 12, unit: 'hour' } },
  retention: { defaultWindow: 'always' },
  validateEntry: validateTrainingEntry,
  nowCard({ entries, now, context }) {
    const active = entries.filter(entry => entry.status === 'active').sort((a, b) => b.startedAt - a.startedAt)[0];
    if (active) return {
      active: true, primary: 'Training läuft',
      secondary: `seit ${dateLabel(active.startedAt)}`, density: 'compact'
    };
    const last = latestSession(entries);
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);
    return {
      active: false,
      primary: last ? `Letztes Training ${elapsed(last.endedAt, now)}` : 'Noch kein Training dokumentiert',
      density: 'standard',
      ...(last && context?.match ? { nextChangeAt: tomorrow.getTime() } : {})
    };
  },
  offlineAssets: ['./src/helpers/training/model.js', './src/helpers/training/styles.css'],
  async mount({ root, api, signal, launchContext }) {
    const place = contextPlace(launchContext);
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = new URL('./styles.css', import.meta.url).href;
    root.append(css);
    const host = document.createElement('div');
    host.className = 'training';
    host.innerHTML = '<p class="training-status" role="status" aria-live="polite"></p><div class="training-content"></div>';
    root.append(host);
    const status = host.querySelector('.training-status');
    const content = host.querySelector('.training-content');
    const entries = await api.listEntries();
    if (signal.aborted) return () => css.remove();
    entries.forEach(validateTrainingEntry);
    let sessions = entries.filter(entry => entry.status === 'ended');
    let active = entries.filter(entry => entry.status === 'active')
      .sort((a, b) => b.startedAt - a.startedAt)[0] || null;
    let screen = 'home';
    let saving = false;

    function notify(message) { status.textContent = message; }
    function focus(selector) { content.querySelector(selector)?.focus(); }
    function showError(error, message) {
      if (!signal.aborted) api.toast(error?.name === 'QuotaExceededError'
        ? `Browser-Speicher voll. ${message}`
        : message);
    }
    function action(task, message) {
      return event => {
        event?.preventDefault();
        if (saving || signal.aborted) return;
        const target = event?.currentTarget || null;
        saving = true;
        host.setAttribute('aria-busy', 'true');
        host.querySelectorAll('button').forEach(button => { button.disabled = true; });
        Promise.resolve().then(() => task(target)).catch(error => showError(error, message)).finally(() => {
          saving = false;
          host.removeAttribute('aria-busy');
          host.querySelectorAll('button').forEach(button => { button.disabled = false; });
        });
      };
    }
    async function persist(next, focusSelector, message) {
      const entry = validateTrainingEntry(next);
      const committed = await api.saveEntry(entry);
      if (signal.aborted) return;
      active = validateTrainingEntry(committed);
      const sessionIndex = sessions.findIndex(item => item.id === active.id);
      if (sessionIndex >= 0) sessions[sessionIndex] = active;
      notify(message);
      render();
      focus(focusSelector);
    }
    function getReference() {
      if (active?.basedOnSessionId) return sessions.find(item => item.id === active.basedOnSessionId) || null;
      return sessionReference(sessions, place);
    }
    function renderHome() {
      const latest = place ? latestSessionAtPlace(sessions, place.id) : latestSession(sessions);
      const detail = place
        ? latest ? `<p class="training-context">Letztes Training hier ${escape(elapsed(latest.endedAt))}</p>` : '<p class="training-context">Hier noch kein Training dokumentiert.</p>'
        : latest ? `<p class="training-context">Letztes Training ${escape(elapsed(latest.endedAt))}</p>` : '';
      content.innerHTML = `<h2 class="section-title" tabindex="-1">Training</h2>${place ? `<p class="training-place">${escape(place.name)}</p>` : ''}${detail}
        ${active ? `<p class="training-open-note">Training ist noch offen.</p><div class="training-actions"><button type="button" data-training="continue">Weiter</button><button class="secondary" type="button" data-training="finish">Beenden</button></div>` : '<button type="button" id="trainingStart">Training starten</button>'}`;
      content.querySelector('#trainingStart')?.addEventListener('click', action(async () => {
        const reference = sessionReference(sessions, place);
        const next = createTraining(Date.now(), place || undefined);
        if (reference) next.awaitingChoice = true;
        active = validateTrainingEntry(await api.saveEntry(next));
        if (signal.aborted) return;
        screen = reference ? 'decision' : 'editor';
        notify('Gut, dass du da bist.');
        render();
        focus(reference ? '.training-reference-heading' : '.training-editor-title');
      }, 'Training konnte nicht gestartet werden. Bitte erneut versuchen.'));
      content.querySelector('[data-training="continue"]')?.addEventListener('click', () => {
        screen = active.awaitingChoice ? 'decision' : 'editor';
        render();
        focus(active.awaitingChoice ? '.training-reference-heading' : '.training-editor-title');
      });
      content.querySelector('[data-training="finish"]')?.addEventListener('click', action(finish, 'Training konnte nicht beendet werden. Bitte erneut versuchen.'));
      focus('.section-title');
    }
    function renderDecision() {
      const reference = getReference();
      if (!reference) {
        active = { ...active };
        delete active.awaitingChoice;
        screen = 'editor';
        render();
        focus('.training-editor-title');
        return;
      }
      content.innerHTML = `<h2 class="section-title training-reference-heading" tabindex="-1">Gut, dass du da bist.</h2>
        <section class="training-reference" aria-labelledby="trainingReferenceTitle">
          <h3 id="trainingReferenceTitle">Beim letzten Mal</h3>
          ${sessionSummary(reference)}
          <div class="training-actions"><button type="button" data-training="repeat">Dieses Training wiederholen</button><button class="secondary" type="button" data-training="new">Neues Training</button></div>
        </section>`;
      content.querySelector('[data-training="repeat"]').addEventListener('click', action(async () => {
        const structure = repeatStructure(reference);
        const next = { ...active, ...structure };
        delete next.awaitingChoice;
        screen = 'editor';
        await persist(next, '.training-editor-title', 'Trainingsstruktur übernommen. Ergebnisse vom letzten Mal bleiben Referenz.');
      }, 'Training konnte nicht vorbereitet werden. Bitte erneut versuchen.'));
      content.querySelector('[data-training="new"]').addEventListener('click', action(async () => {
        const next = { ...active, activities: [] };
        delete next.title;
        delete next.basedOnSessionId;
        delete next.awaitingChoice;
        screen = 'editor';
        await persist(next, '.training-editor-title', 'Neues Training begonnen.');
      }, 'Training konnte nicht vorbereitet werden. Bitte erneut versuchen.'));
      focus('.training-reference-heading');
    }
    function activityCard(activity, index) {
      const reference = latestActivityReference(sessions, activity.name, active.place?.id, active.id);
      const today = activity.mode === 'sets'
        ? activity.sets.length ? `<p class="training-today"><strong>Heute:</strong> ${escape(formatSets(activity))}</p>` : ''
        : activity.mode === 'duration'
          ? activity.durationSeconds === undefined ? '' : `<p class="training-today"><strong>Heute:</strong> ${escape(formatDuration(activity.durationSeconds))}</p>`
          : activity.distanceMeters === undefined ? '' : `<p class="training-today"><strong>Heute:</strong> ${escape(formatActivity(activity))}</p>`;
      let form = '';
      if (activity.mode === 'sets') {
        const latestSet = activity.sets.at(-1);
        form = `<form class="training-entry-form" data-activity-form="${activity.id}">
          <label>Gewicht in kg, optional<input name="weightKg" type="number" min="0" max="1000000" step="any" inputmode="decimal" value="${latestSet?.weightKg ?? ''}"></label>
          <label>Wiederholungen<input name="reps" type="number" min="1" max="1000000000" step="1" inputmode="numeric" value="${latestSet?.reps ?? ''}" required></label>
          <button type="submit">Satz speichern</button></form>`;
      } else if (activity.mode === 'duration') {
        form = `<form class="training-entry-form" data-activity-form="${activity.id}">
          <label>Dauer in Minuten<input name="duration" type="number" min="0.01" max="16666666" step="any" inputmode="decimal" required></label>
          <button type="submit">Dauer speichern</button></form>`;
      } else {
        form = `<form class="training-entry-form" data-activity-form="${activity.id}">
          <label>Distanz in km<input name="distance" type="number" min="0.001" max="1000000" step="any" inputmode="decimal" value="${activity.distanceMeters === undefined ? '' : activity.distanceMeters / 1000}" required></label>
          <label>Dauer in Minuten, optional<input name="duration" type="number" min="0.01" max="16666666" step="any" inputmode="decimal" value="${activity.durationSeconds === undefined ? '' : activity.durationSeconds / 60}"></label>
          <button type="submit">Strecke speichern</button></form>`;
      }
      return `<li class="training-activity"><div class="training-activity-heading"><h3>${escape(activity.name)}</h3><span>${({ sets: 'Sätze', duration: 'Dauer', distance: 'Strecke' })[activity.mode]}</span></div>
        ${activityDetails(reference)}${today}${form}
        <button class="quiet training-remove" type="button" data-remove-activity="${index}">Aktivität entfernen</button></li>`;
    }
    function renderEditor() {
      const references = orderedSessions(sessions).flatMap(session => session.activities)
        .filter(activity => activity.name).reduce((names, activity) => {
          const key = normalizeActivityName(activity.name);
          if (!names.some(item => normalizeActivityName(item) === key)) names.push(activity.name);
          return names;
        }, []);
      content.innerHTML = `<h2 class="section-title training-editor-title" tabindex="-1">Training dokumentieren</h2>
        ${active.title ? `<p class="training-title-current">${escape(active.title)}</p>` : ''}
        <form id="trainingTitleForm" class="training-title-form"><label>Trainingsbezeichnung, optional<input name="title" maxlength="100" autocomplete="off" value="${escape(active.title || '')}"></label><button class="secondary" type="submit">${active.title ? 'Bezeichnung speichern' : 'Bezeichnung hinzufügen'}</button></form>
        <ol class="training-activities">${active.activities.map(activityCard).join('')}</ol>
        <form id="trainingActivityForm" class="training-add-form">
          <h3>Aktivität hinzufügen</h3>
          <label>Name<input name="name" maxlength="120" list="trainingActivityNames" autocomplete="off" required></label>
          <datalist id="trainingActivityNames">${references.map(name => `<option value="${escape(name)}"></option>`).join('')}</datalist>
          <fieldset><legend>Messart</legend><label><input type="radio" name="mode" value="sets" checked> Sätze</label><label><input type="radio" name="mode" value="duration"> Dauer</label><label><input type="radio" name="mode" value="distance"> Strecke</label></fieldset>
          <button type="submit">Aktivität hinzufügen</button>
        </form>
        <div class="training-actions training-finish-actions"><button type="button" data-training="finish">Training beenden</button><button class="quiet" type="button" data-training="home">Zum Trainingsstart</button></div>`;

      content.querySelector('#trainingTitleForm').addEventListener('submit', action(async form => {
        const values = new FormData(form);
        const title = normalizeDisplayName(values.get('title'));
        const next = { ...active };
        if (title) next.title = title;
        else delete next.title;
        await persist(next, '.training-editor-title', 'Trainingsbezeichnung gespeichert.');
      }, 'Bezeichnung konnte nicht gespeichert werden. Bitte erneut versuchen.'));
      content.querySelector('#trainingActivityForm').addEventListener('submit', action(async form => {
        const values = new FormData(form);
        const name = normalizeDisplayName(values.get('name'));
        if (!name || name.length > 120) { api.toast('Bitte einen gültigen Aktivitätsnamen eingeben.'); return; }
        const mode = values.get('mode');
        const activity = { id: nextActivityId(active), name, mode, ...(mode === 'sets' ? { sets: [] } : {}) };
        await persist({ ...active, activities: [...active.activities, activity] }, `[data-activity-form="${activity.id}"] input`, 'Aktivität hinzugefügt.');
      }, 'Aktivität konnte nicht hinzugefügt werden. Bitte erneut versuchen.'));
      content.querySelectorAll('[data-activity-form]').forEach(form => {
        form.addEventListener('submit', action(async submittedForm => {
          const values = new FormData(submittedForm);
          const index = active.activities.findIndex(activity => activity.id === submittedForm.dataset.activityForm);
          if (index < 0) throw new Error('Aktivität nicht mehr vorhanden.');
          const activities = active.activities.map(activity => ({ ...activity }));
          const activity = activities[index];
          const recordedAt = Date.now();
          if (activity.mode === 'sets') {
            const reps = Number(values.get('reps'));
            const weightText = values.get('weightKg');
            const weightKg = weightText === '' ? undefined : Number(weightText);
            if (!Number.isInteger(reps) || reps <= 0 || (weightKg !== undefined && (!Number.isFinite(weightKg) || weightKg < 0))) {
              api.toast('Bitte Wiederholungen und ein gültiges Gewicht prüfen.');
              return;
            }
            activity.sets = [...activity.sets, { ...(weightKg === undefined ? {} : { weightKg }), reps, recordedAt }];
          } else if (activity.mode === 'duration') {
            const minutes = Number(values.get('duration'));
            if (!Number.isFinite(minutes) || minutes <= 0) { api.toast('Bitte eine gültige Dauer eingeben.'); return; }
            activity.durationSeconds = Math.round(minutes * 60);
            activity.recordedAt = recordedAt;
          } else {
            const distanceKm = Number(values.get('distance'));
            const minutesText = values.get('duration');
            const minutes = minutesText === '' ? undefined : Number(minutesText);
            if (!Number.isFinite(distanceKm) || distanceKm <= 0 || (minutes !== undefined && (!Number.isFinite(minutes) || minutes <= 0))) {
              api.toast('Bitte eine gültige Strecke und Dauer prüfen.');
              return;
            }
            activity.distanceMeters = Math.round(distanceKm * 1000);
            if (minutes !== undefined) activity.durationSeconds = Math.round(minutes * 60);
            else delete activity.durationSeconds;
            activity.recordedAt = recordedAt;
          }
          await persist({ ...active, activities }, `[data-activity-form="${activity.id}"] input`, 'Wert gespeichert.');
        }, 'Aktivität konnte nicht gespeichert werden. Deine Eingabe bleibt erhalten.'));
      });
      content.querySelectorAll('[data-remove-activity]').forEach(button => button.addEventListener('click', action(async event => {
        const index = Number(event.currentTarget.dataset.removeActivity);
        await persist({ ...active, activities: active.activities.filter((_, itemIndex) => itemIndex !== index) }, '.training-editor-title', 'Aktivität entfernt.');
      }, 'Aktivität konnte nicht entfernt werden. Bitte erneut versuchen.')));
      content.querySelector('[data-training="finish"]').addEventListener('click', action(finish, 'Training konnte nicht beendet werden. Bitte erneut versuchen.'));
      content.querySelector('[data-training="home"]').addEventListener('click', () => {
        screen = 'home';
        render();
        focus('.section-title');
      });
      focus('.training-editor-title');
    }
    function renderSummary(session) {
      const items = session.activities.filter(activity => activity.mode === 'sets' ? activity.sets.length : activity.mode === 'duration' ? activity.durationSeconds !== undefined : activity.distanceMeters !== undefined);
      content.innerHTML = `<h2 class="section-title training-complete-title" tabindex="-1">Training beendet.</h2>
        <p class="training-session-date"><time datetime="${new Date(session.endedAt).toISOString()}">${escape(dateLabel(session.endedAt))}</time></p>
        ${session.title ? `<p class="training-session-title">${escape(session.title)}</p>` : ''}
        <ul class="training-summary-list">${items.map(activity => {
          let reference = session.basedOnSessionId
            ? sessions.find(item => item.id === session.basedOnSessionId)?.activities.find(previous => normalizeActivityName(previous.name) === normalizeActivityName(activity.name))
            : null;
          if (!reference) reference = latestActivityReference(sessions, activity.name, session.place?.id, session.id)?.activity;
          return `<li><strong>${escape(activity.name)}</strong><span><strong>Heute</strong> ${escape(formatActivity(activity))}</span>${reference ? `<span><strong>Letztes Mal</strong> ${escape(formatActivity(reference))}</span>` : ''}</li>`;
        }).join('')}</ul>
        <button type="button" data-training="home">Fertig</button>`;
      content.querySelector('[data-training="home"]').addEventListener('click', () => {
        active = null;
        screen = 'home';
        notify('');
        render();
        focus('.section-title');
      });
      focus('.training-complete-title');
    }
    async function finish() {
      const result = await finishTraining(api, active);
      if (signal.aborted) return;
      if (!result.entry) {
        active = null;
        screen = 'home';
        notify('Leeres Training entfernt. Es wurde keine Nutzung gezählt.');
        render();
        focus('.section-title');
        return;
      }
      sessions = orderedSessions([result.entry, ...sessions.filter(item => item.id !== result.entry.id)]);
      active = null;
      screen = 'summary';
      if (result.usageError) api.toast('Training beendet. „Zuletzt verwendet“ konnte nicht aktualisiert werden.');
      renderSummary(result.entry);
    }
    function render() {
      if (screen === 'home') renderHome();
      else if (screen === 'decision') renderDecision();
      else if (screen === 'editor') renderEditor();
    }
    render();
    return () => css.remove();
  }
};
