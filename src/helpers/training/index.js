import {
  createTraining, documentedActivity, finishTraining, formatActivity,
  latestActivityReference, latestSessionAtPlace, latestSession, normalizeActivityName,
  normalizeDisplayName, nextActivityId, orderedSessions, recentSessionChoices, repeatStructure,
  validateTrainingEntry
} from './model.js';

const escape = value => String(value).replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[char]);
const dateLabel = value => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(value);
const numberLabel = value => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(value);
const modeLabels = { sets: 'Sätze & Wiederholungen', duration: 'Zeit', distance: 'Strecke' };
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
    <ul class="training-summary-list">${session.activities.filter(documentedActivity).map(activity => `<li><strong>${escape(activity.name)}</strong><span>${escape(formatActivity(activity))}</span></li>`).join('')}</ul>`;
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
    host.innerHTML = '<p class="training-status" role="status" aria-live="polite" aria-atomic="true"></p><div class="training-content"></div>';
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
    let selectedSession = null;
    let olderExpanded = false;

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
    async function persist(next, focusSelector, message, nextScreen = screen) {
      const entry = validateTrainingEntry(next);
      const committed = await api.saveEntry(entry);
      if (signal.aborted) return;
      active = validateTrainingEntry(committed);
      screen = nextScreen;
      notify(message);
      render();
      focus(focusSelector);
    }
    function show(nextScreen, focusSelector = '.section-title') {
      if (saving || signal.aborted) return;
      screen = nextScreen;
      notify('');
      render();
      focus(focusSelector);
    }
    async function startTraining(title = '', reference = null) {
      const next = createTraining(Date.now(), place || undefined);
      if (reference) Object.assign(next, repeatStructure(reference));
      else if (title) next.title = title;
      await persist(next, '.training-editor-title', reference
        ? 'Training begonnen. Die bisherigen Werte stehen unter „Letztes Mal“. Deine heutigen Einträge sind noch leer.'
        : 'Training begonnen. Füge deine erste Aktivität hinzu.', 'editor');
    }
    function renderHome() {
      const latest = place ? latestSessionAtPlace(sessions, place.id) : latestSession(sessions);
      const detail = place
        ? latest ? `<p class="training-context">Letztes Training hier ${escape(elapsed(latest.endedAt))}</p>` : '<p class="training-context">Hier noch kein Training dokumentiert.</p>'
        : latest ? `<p class="training-context">Letztes Training ${escape(elapsed(latest.endedAt))}</p>` : '<p class="training-context">Noch kein Training dokumentiert.</p>';
      content.innerHTML = `<h2 class="section-title" tabindex="-1">Training</h2>${place ? `<p class="training-place">${escape(place.name)}</p>` : ''}${detail}
        ${active ? `<p class="training-open-note">Training ist noch offen.</p>${active.title ? `<p class="training-title-current">${escape(active.title)}</p>` : ''}<div class="training-actions"><button type="button" data-training="continue">Weiter</button><button class="secondary" type="button" data-training="finish">Beenden</button></div>`
          : `${sessions.length ? '<h3>Was möchtest du heute machen?</h3>' : ''}<div class="training-actions">
            ${latest ? `<button type="button" data-training="repeat">${latest.title ? `${escape(latest.title)} wiederholen` : 'Letztes Training wiederholen'}</button>` : ''}
            ${sessions.length ? '<button class="secondary" type="button" data-training="history">Anderes früheres Training</button>' : ''}
            <button class="${latest ? 'secondary' : ''}" type="button" id="trainingStart">${sessions.length ? 'Neues Training' : 'Training starten'}</button></div>`}`;
      content.querySelector('#trainingStart')?.addEventListener('click', () => {
        show('title');
        notify('Gut, dass du da bist.');
      });
      content.querySelector('[data-training="repeat"]')?.addEventListener('click', action(() => startTraining('', latest), 'Training konnte nicht gestartet werden. Bitte erneut versuchen.'));
      content.querySelector('[data-training="history"]')?.addEventListener('click', () => show('history'));
      content.querySelector('[data-training="continue"]')?.addEventListener('click', action(async () => {
        // Old drafts may still carry the previous start-flow flag.
        if (active.awaitingChoice) {
          const next = { ...active };
          delete next.awaitingChoice;
          await persist(next, '.training-editor-title', '', 'editor');
        } else {
          screen = 'editor';
          notify('');
          render();
          focus('.training-editor-title');
        }
      }, 'Training konnte nicht geöffnet werden. Bitte erneut versuchen.'));
      content.querySelector('[data-training="finish"]')?.addEventListener('click', action(finish, 'Training konnte nicht beendet werden. Bitte erneut versuchen.'));
    }
    function renderTitle() {
      content.innerHTML = `<h2 class="section-title" tabindex="-1">Was steht heute an?</h2>
        <p id="trainingTitleHint">Ein Name hilft dir, dieses Training später wiederzufinden und zu wiederholen.</p>
        <form id="trainingStartForm" class="training-title-form">
          <label>Name des Trainings, optional<input name="title" maxlength="100" autocomplete="off" placeholder="Oberkörper" aria-describedby="trainingTitleHint trainingTitleExamples"></label>
          <p id="trainingTitleExamples" class="training-hint">Zum Beispiel: Beine · Oberkörper · Ausdauer</p>
          <button type="submit">Weiter zur ersten Aktivität</button>
          <button class="secondary" type="button" data-training="without-title">Ohne Bezeichnung starten</button>
        </form>`;
      content.querySelector('#trainingStartForm').addEventListener('submit', action(form => startTraining(normalizeDisplayName(new FormData(form).get('title'))), 'Training konnte nicht gestartet werden. Deine Eingabe bleibt erhalten.'));
      content.querySelector('[data-training="without-title"]').addEventListener('click', action(() => startTraining(), 'Training konnte nicht gestartet werden. Bitte erneut versuchen.'));
    }
    function historyList(items, className) {
      return `<ul class="training-history-list ${className}">${items.map(session => `<li><button type="button" class="secondary training-history-choice" data-session="${escape(session.id)}">
        <strong>${escape(session.title || 'Training ohne Bezeichnung')}</strong>
        <span><time datetime="${new Date(session.endedAt).toISOString()}">${escape(shortDate(session.endedAt))} · ${escape(elapsed(session.endedAt))}</time>${session.place ? ` · ${escape(session.place.name)}` : ''}</span>
        <span>${session.activities.map(activity => `${escape(activity.name)}${activity.mode === 'sets' ? '' : ` · ${escape(formatActivity(activity))}`}`).join(' · ')}</span>
        </button></li>`).join('')}</ul>`;
    }
    function renderHistory() {
      const quick = recentSessionChoices(sessions);
      const quickIds = new Set(quick.map(session => session.id));
      const older = orderedSessions(sessions).filter(session => !quickIds.has(session.id));
      content.innerHTML = `<h2 class="section-title" tabindex="-1">Frühere Trainings</h2>
        <p>Wähle ein Training, um es anzusehen und zu wiederholen.</p>
        ${historyList(quick, 'training-quick-choices')}
        ${older.length ? `<details class="training-older" ${olderExpanded ? 'open' : ''}><summary>Ältere Trainings (${older.length})</summary>${historyList(older, 'training-older-choices')}</details>` : ''}`;
      content.querySelector('.training-older')?.addEventListener('toggle', event => { olderExpanded = event.currentTarget.open; });
      content.querySelectorAll('[data-session]').forEach(button => button.addEventListener('click', () => {
        selectedSession = sessions.find(session => session.id === button.dataset.session);
        show('detail');
      }));
    }
    function renderDetail() {
      content.innerHTML = `<h2 class="section-title" tabindex="-1">${escape(selectedSession.title || 'Training ohne Bezeichnung')}</h2>
        <section class="training-reference">${sessionSummary(selectedSession)}</section>
        <button type="button" data-training="repeat">Dieses Training wiederholen</button>`;
      content.querySelector('[data-training="repeat"]').addEventListener('click', action(() => startTraining('', selectedSession), 'Training konnte nicht gestartet werden. Bitte erneut versuchen.'));
    }
    function referenceFor(session, activity) {
      const source = sessions.find(item => item.id === session.basedOnSessionId);
      const previous = source?.activities.find(item => normalizeActivityName(item.name) === normalizeActivityName(activity.name));
      return previous ? { session: source, activity: previous }
        : latestActivityReference(sessions, activity.name, session.place?.id, session.id);
    }
    function activityCard(activity, index) {
      const reference = referenceFor(active, activity);
      const today = documentedActivity(activity) ? `<div class="training-today"><h4>Heute</h4><ol class="training-saved-list">${activity.mode === 'sets'
        ? activity.sets.map((set, setIndex) => `<li id="${activity.id}-saved-${setIndex}" tabindex="-1"><span aria-hidden="true">✓</span> Satz ${setIndex + 1} · ${set.weightKg === undefined ? `${set.reps} Wiederholungen` : `${numberLabel(set.weightKg)} kg × ${set.reps}`}</li>`).join('')
        : `<li id="${activity.id}-saved" tabindex="-1"><span aria-hidden="true">✓</span> Gespeichert: ${escape(formatActivity(activity))}</li>`}</ol></div>`
        : '<p class="training-hint">Heute noch kein Eintrag. Trage deinen ersten Wert ein.</p>';
      let form = '';
      if (activity.mode === 'sets') {
        const latestSet = activity.sets.at(-1);
        form = `<form class="training-entry-form" data-activity-form="${activity.id}">
          <label>Gewicht in kg, optional<input name="weightKg" type="number" min="0" max="1000000" step="any" inputmode="decimal" value="${latestSet?.weightKg ?? ''}"></label>
          <label>Wiederholungen<input name="reps" type="number" min="1" max="1000000000" step="1" inputmode="numeric" required></label>
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
      return `<li class="training-activity"><div class="training-activity-heading"><h3 id="${activity.id}-heading" tabindex="-1">${escape(activity.name)}</h3><span>${modeLabels[activity.mode]}</span></div>
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
      content.innerHTML = `<h2 class="section-title training-editor-title" tabindex="-1">Training läuft</h2>
        ${active.title ? `<p class="training-title-current">${escape(active.title)}</p>` : ''}
        <details class="training-title-edit"><summary>${active.title ? 'Bezeichnung ändern' : 'Training benennen (optional)'}</summary>
          <form id="trainingTitleForm" class="training-title-form"><label>Name des Trainings, optional<input name="title" maxlength="100" autocomplete="off" aria-describedby="trainingEditTitleHint" value="${escape(active.title || '')}"></label>
          <p id="trainingEditTitleHint" class="training-hint">Ein Name hilft dir, dieses Training später wiederzufinden und zu wiederholen. Zum Beispiel: Beine · Oberkörper · Ausdauer</p>
          <button class="secondary" type="submit">Bezeichnung speichern</button></form>
        </details>
        ${active.activities.length ? '' : '<p>Füge deine erste Aktivität hinzu. Danach kannst du deine Werte eintragen.</p>'}
        <ol class="training-activities">${active.activities.map(activityCard).join('')}</ol>
        <details class="training-add" ${active.activities.length ? '' : 'open'}><summary>${active.activities.length ? 'Weitere Aktivität hinzufügen' : 'Erste Aktivität hinzufügen'}</summary>
        <form id="trainingActivityForm" class="training-add-form">
          <h3>Was machst du?</h3>
          <label>Aktivität<input name="name" maxlength="120" list="trainingActivityNames" autocomplete="off" required></label>
          <datalist id="trainingActivityNames">${references.map(name => `<option value="${escape(name)}"></option>`).join('')}</datalist>
          <fieldset><legend>Wie möchtest du sie erfassen?</legend>
            <label class="training-mode"><input type="radio" name="mode" value="sets" checked><span><strong>Sätze &amp; Wiederholungen</strong><span>Für Kraftübungen</span><span>45 kg × 10</span></span></label>
            <label class="training-mode"><input type="radio" name="mode" value="duration"><span><strong>Zeit</strong><span>Für Pilates, Yoga oder Rudern nach Zeit</span><span>30 Min.</span></span></label>
            <label class="training-mode"><input type="radio" name="mode" value="distance"><span><strong>Strecke</strong><span>Für Laufen oder Radfahren</span><span>5 km · optional 28 Min.</span></span></label>
          </fieldset>
          <button type="submit">Aktivität hinzufügen</button>
        </form></details>
        <div class="training-actions training-finish-actions"><button type="button" data-training="finish">Training beenden</button><button class="quiet" type="button" data-training="home">Zum Trainingsstart</button></div>`;

      content.querySelector('#trainingTitleForm').addEventListener('submit', action(async form => {
        const title = normalizeDisplayName(new FormData(form).get('title'));
        const next = { ...active };
        if (title) next.title = title;
        else delete next.title;
        await persist(next, '.training-editor-title', 'Trainingsbezeichnung gespeichert.');
      }, 'Bezeichnung konnte nicht gespeichert werden. Bitte erneut versuchen.'));
      const addForm = content.querySelector('#trainingActivityForm');
      let previousName = '';
      addForm.elements.name.addEventListener('input', () => {
        const name = normalizeActivityName(addForm.elements.name.value);
        if (name === previousName) return;
        previousName = name;
        // Mode defaults use the latest known activity across places; references keep their place preference.
        const previous = latestActivityReference(sessions, name);
        addForm.elements.mode.value = previous?.activity.mode || 'sets';
      });
      addForm.addEventListener('submit', action(async form => {
        const values = new FormData(form);
        const name = normalizeDisplayName(values.get('name'));
        if (!name || name.length > 120) { api.toast('Bitte einen gültigen Aktivitätsnamen eingeben.'); return; }
        const mode = values.get('mode');
        const activity = { id: nextActivityId(active), name, mode, ...(mode === 'sets' ? { sets: [] } : {}) };
        await persist({ ...active, activities: [...active.activities, activity] }, `[data-activity-form="${activity.id}"] input`, 'Aktivität hinzugefügt. Trage jetzt deine Werte ein.');
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
          const lastSet = activity.sets?.at(-1);
          const message = activity.mode === 'sets'
            ? `Satz ${activity.sets.length} gespeichert: ${lastSet.weightKg === undefined ? '' : `${numberLabel(lastSet.weightKg)} Kilogramm, `}${lastSet.reps} Wiederholungen. Für den nächsten Satz neue Wiederholungen eintragen.`
            : `${modeLabels[activity.mode]} gespeichert: ${formatActivity(activity)}.`;
          const savedSelector = activity.mode === 'sets' ? `#${activity.id}-saved-${activity.sets.length - 1}` : `#${activity.id}-saved`;
          await persist({ ...active, activities }, savedSelector, message);
        }, 'Aktivität konnte nicht gespeichert werden. Deine Eingabe bleibt erhalten.'));
      });
      content.querySelectorAll('[data-remove-activity]').forEach(button => button.addEventListener('click', action(async target => {
        const index = Number(target.dataset.removeActivity);
        const activity = active.activities[index];
        if (documentedActivity(activity) && !window.confirm(`„${activity.name}“ und die heutigen Einträge aus diesem Training entfernen?`)) return;
        await persist({ ...active, activities: active.activities.filter((_, itemIndex) => itemIndex !== index) }, '.training-editor-title', 'Aktivität entfernt.');
      }, 'Aktivität konnte nicht entfernt werden. Bitte erneut versuchen.')));
      content.querySelector('[data-training="finish"]').addEventListener('click', action(finish, 'Training konnte nicht beendet werden. Bitte erneut versuchen.'));
      content.querySelector('[data-training="home"]').addEventListener('click', () => show('home'));
    }
    function renderSummary(session) {
      const items = session.activities.filter(documentedActivity);
      content.innerHTML = `<h2 class="section-title training-complete-title" tabindex="-1">Training beendet.</h2>
        <p class="training-session-date"><time datetime="${new Date(session.endedAt).toISOString()}">${escape(dateLabel(session.endedAt))}</time></p>
        ${session.title ? `<p class="training-session-title">${escape(session.title)}</p>` : ''}
        <ul class="training-summary-list">${items.map(activity => {
          const reference = referenceFor(session, activity)?.activity;
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
      api.setBackAction(() => show('home'), 'Training');
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
      notify('');
      if (result.usageError) api.toast('Training beendet. „Zuletzt verwendet“ konnte nicht aktualisiert werden.');
      renderSummary(result.entry);
    }
    function render() {
      if (screen === 'home') renderHome();
      else if (screen === 'title') renderTitle();
      else if (screen === 'history') renderHistory();
      else if (screen === 'detail') renderDetail();
      else if (screen === 'editor') renderEditor();
      api.setBackAction(screen === 'home' ? null : () => {
        if (saving) return;
        const fromDetail = screen === 'detail';
        show(fromDetail ? 'history' : 'home');
        if (fromDetail) [...content.querySelectorAll('[data-session]')].find(button => button.dataset.session === selectedSession.id)?.focus();
      }, screen === 'detail' ? 'Frühere Trainings' : 'Training');
    }
    render();
    focus('.section-title');
    return () => css.remove();
  }
};
