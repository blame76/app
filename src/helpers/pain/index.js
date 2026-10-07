import { createNavigation } from '../../navigation.js';
import { BODY_AREAS, QUALITIES, RELIEF, validatePainEntry, historyForArea, documentedAreas, addDetails, approximateStart, saveObservation } from './model.js';

const escape = value => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const dateLabel = value => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(value);
const relativeTime = value => {
  const minutes = Math.floor((Date.now() - value) / 60000);
  if (minutes < 0) return dateLabel(value);
  if (minutes === 0) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} ${hours === 1 ? 'Stunde' : 'Stunden'}`;
  const days = Math.floor(hours / 24);
  return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
};
const documentedTime = value => `<time datetime="${new Date(value).toISOString()}" title="${escape(dateLabel(value))}">${escape(relativeTime(value))}</time>`;
const localDate = value => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const localDateTime = value => new Date(value - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const clockTime = value => new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(value);
const clock = value => `<time datetime="${new Date(value).toISOString()}">${escape(clockTime(value))}</time>`;
const beginning = entry => entry.startedAt && (entry.startedAt.kind === 'today' || entry.startedAt.kind === 'yesterday'
  ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(entry.startedAt.at)
  : dateLabel(entry.startedAt.at));

// Presentation only: chronological observations, with real time spacing and no inferred values.
function dayOverview(group) {
  const observations = [...group].reverse();
  const first = observations[0];
  const latest = observations.at(-1);
  const duration = latest.recordedAt - first.recordedAt;
  const points = observations.map(entry => ({
    entry,
    x: duration ? 12 + (entry.recordedAt - first.recordedAt) / duration * 576 : 300,
    y: 96 - entry.intensity * 8
  }));
  return `
    <dl class="pain-day-overview">
      <div><dt>Erste Dokumentation</dt><dd>${clock(first.recordedAt)}</dd></div>
      <div><dt>Zuletzt</dt><dd><strong class="pain-latest-value">${latest.intensity}</strong><span> · ${clock(latest.recordedAt)}</span></dd>${latest.intensity === 0 ? '<p class="muted">schmerzfrei · Schmerz weg</p>' : ''}</div>
    </dl>
    ${beginning(first) ? `<p class="muted pain-day-beginning">Beginn ungefähr: ${escape(beginning(first))}</p>` : ''}
    <figure class="pain-trend" aria-label="Dokumentierte Werte nach Uhrzeit">
      <svg viewBox="0 0 600 112" aria-hidden="true" focusable="false">
        ${points.length > 1 ? `<polyline points="${points.map(point => `${point.x.toFixed(2)},${point.y}`).join(' ')}" fill="none" vector-effect="non-scaling-stroke" />` : ''}
        ${points.map(({ entry, x, y }) => `<circle cx="${x.toFixed(2)}" cy="${y}" r="3.5"><title>${escape(clockTime(entry.recordedAt))} · ${entry.intensity}${entry.intensity === 0 ? ' · schmerzfrei' : ''}</title></circle>`).join('')}
      </svg>
      <figcaption><span>${clock(first.recordedAt)}${duration ? `–${clock(latest.recordedAt)}` : ''}</span><span>${points.length === 1 ? 'Ein dokumentierter Wert' : 'Linie verbindet dokumentierte Werte.'}</span></figcaption>
    </figure>`;
}

export default {
  id: 'pain', label: 'Schmerz', category: 'Wohlbefinden', defaultVisible: true,
  contexts: ['place', 'time', 'interval'],
  retention: { defaultWindow: 'always' },
  guidance: true,
  validateEntry: validatePainEntry,
  nowCard({ entries }) {
    const open = documentedAreas(entries).map(area => historyForArea(entries, area)[0])
      .filter(entry => entry.eventType === 'observation');
    return {
      active: open.length > 0,
      primary: open.length === 1 ? `${open[0].bodyArea} · ${open[0].intensity}/10`
        : open.length ? `${open.length} Schmerzorte aktiv` : 'Kein Schmerz offen dokumentiert',
      density: 'compact'
    };
  },
  offlineAssets: ['./src/helpers/pain/model.js', './src/helpers/pain/styles.css'],
  async mount({ root, api, signal }) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = new URL('./styles.css', import.meta.url).href;
    root.append(css);
    const host = document.createElement('div');
    host.className = 'pain';
    host.innerHTML = '<div class="pain-guidance" hidden><p class="muted">Für einen Eintrag reichen Ort und Stärke.</p><button class="quiet" type="button" data-pain="guidance-off">Hinweise ausblenden</button></div><p class="pain-status muted" role="status" aria-live="polite"></p><div class="pain-content"></div>';
    root.append(host);
    const status = host.querySelector('.pain-status');
    const content = host.querySelector('.pain-content');
    const guide = host.querySelector('.pain-guidance');
    let [entries, guidance] = await Promise.all([api.listEntries(), api.getGuidance()]);
    if (signal.aborted) return;
    entries.forEach(validatePainEntry);
    let saving = false;
    const navigation = createNavigation({ title: 'Schmerz' });
    function enterView(title, open, options) {
      navigation.enter({ title, open }, options);
      api.setBackAction(navigation.parent ? () => navigation.back().open() : null, navigation.parent?.title);
    }

    function focus(selector) { content.querySelector(selector)?.focus(); }
    function notify(message) { status.textContent = message; }
    function failure(error, message) {
      if (signal.aborted) return;
      api.toast(error.name === 'QuotaExceededError'
        ? `Browser-Speicher voll. ${message || 'Konnte nicht gespeichert werden. Deine Eingabe bleibt erhalten.'}`
        : message || 'Konnte nicht gespeichert werden. Deine Eingabe bleibt erhalten. Bitte erneut versuchen.');
    }
    function action(task, failureMessage) {
      return event => {
        event?.preventDefault();
        if (saving || signal.aborted) return;
        saving = true;
        host.setAttribute('aria-busy', 'true');
        const buttons = [...host.querySelectorAll('button')];
        buttons.forEach(button => { button.disabled = true; });
        Promise.resolve().then(task).catch(error => failure(error, failureMessage)).finally(() => {
          saving = false;
          host.removeAttribute('aria-busy');
          buttons.forEach(button => { button.disabled = false; });
        });
      };
    }
    function bindForm(form, task) {
      // Capture values before async work and cancel the browser submit synchronously.
      form.addEventListener('submit', event => {
        event.preventDefault();
        const values = new FormData(form);
        action(() => task(values))(event);
      });
    }
    function previous(entry) {
      const history = historyForArea(entries, entry.bodyArea);
      return history[history.findIndex(item => item.id === entry.id) + 1];
    }
    async function record(bodyArea, intensity, resolved = false) {
      const prior = historyForArea(entries, bodyArea)[0];
      const { entry, usageError } = await saveObservation(api, bodyArea, intensity, Date.now(), resolved);
      if (signal.aborted) return;
      // The committed entry is authoritative even if a subsequent history read fails.
      entries = [entry, ...entries];
      showSaved(entry, prior);
      notify('Eintrag gespeichert.');
      if (usageError) api.toast('Eintrag gespeichert. „Zuletzt verwendet“ konnte nicht aktualisiert werden.');
    }
    function guidanceView(showIntro = false) {
      guide.hidden = !guidance || !showIntro;
    }
    guide.querySelector('button').addEventListener('click', action(async () => {
      await api.setGuidance(false);
      if (signal.aborted) return;
      guidance = false;
      guidanceView();
      for (const copy of content.querySelectorAll('[data-guidance-copy]')) {
        copy.hidden = true;
        const group = content.querySelector(`[aria-describedby~="${copy.id}"]`);
        if (group) {
          const remaining = group.getAttribute('aria-describedby').split(' ').filter(id => id !== copy.id);
          if (remaining.length) group.setAttribute('aria-describedby', remaining.join(' '));
          else group.removeAttribute('aria-describedby');
        }
      }
      notify('Hinweise ausgeblendet.');
      focus('legend, h2');
    }, 'Hinweise konnten nicht ausgeblendet werden. Bitte erneut versuchen.'));
    function resolvedAction(entry) {
      return entry.intensity > 0 ? '<section class="pain-resolved"><h3 id="pain-resolved-question">Ist der Schmerz inzwischen vorbei?</h3><button class="secondary" type="button" data-pain="resolved" aria-describedby="pain-resolved-question pain-resolved-context">Schmerz weg</button><p id="pain-resolved-context" class="muted pain-hint">Für ' + escape(entry.bodyArea) + '</p></section>' : '';
    }
    function bindResolved(entry) {
      content.querySelector('[data-pain="resolved"]')?.addEventListener('click', action(() => record(entry.bodyArea, 0, true)));
    }
    function historyPicker() {
      return entries.length ? `<details class="pain-history-picker"><summary>Verlauf ansehen</summary><form id="painHistoryForm" class="stack"><label>Schmerzort<select name="area" required><option value="">Ort auswählen</option>${documentedAreas(entries).map(area => `<option value="${escape(area)}">${escape(area)}</option>`).join('')}</select></label><button class="secondary" type="submit">Verlauf ansehen</button></form></details>` : '';
    }
    function bindHistoryPicker() {
      const form = content.querySelector('#painHistoryForm');
      if (form) bindForm(form, values => showHistory(values.get('area')));
    }
    function chooseEntry(draft = {}, options = {}) {
      if (signal.aborted) return;
      enterView('Schmerzort', () => chooseEntry(draft, { replace: true }), options);
      status.textContent = '';
      guidanceView(true);
      const choice = draft.bodyArea ? BODY_AREAS.includes(draft.bodyArea) ? draft.bodyArea : 'Anderer Ort' : '';
      content.innerHTML = `
        <form class="stack" id="painAreaForm">
          <fieldset ${guidance ? 'aria-describedby="pain-area-hint"' : ''}><legend tabindex="-1">Wo tut es gerade weh?</legend>
            <p class="muted pain-question-hint" id="pain-area-hint" data-guidance-copy ${guidance ? '' : 'hidden'}>Wähle einen Ort. Weitere kannst du danach dokumentieren.</p>
            <div class="pain-areas">${[...BODY_AREAS, 'Anderer Ort'].map(area => `<label class="pain-choice"><input type="radio" name="bodyArea" value="${escape(area)}" ${area === choice ? 'checked' : ''} required><span>${escape(area)}</span></label>`).join('')}</div>
            <label class="pain-other" ${choice === 'Anderer Ort' ? '' : 'hidden'}>Kurze Bezeichnung<input name="otherArea" maxlength="60" autocomplete="off" value="${escape(choice === 'Anderer Ort' ? draft.bodyArea : '')}"></label>
          </fieldset>
          <button type="submit">Weiter</button>
        </form>${historyPicker()}`;
      const form = content.querySelector('#painAreaForm');
      const other = form.querySelector('.pain-other');
      const toggleOther = () => {
        other.hidden = new FormData(form).get('bodyArea') !== 'Anderer Ort';
        other.querySelector('input').required = !other.hidden;
      };
      form.addEventListener('change', toggleOther);
      toggleOther();
      bindForm(form, values => {
        const bodyArea = (values.get('bodyArea') === 'Anderer Ort' ? values.get('otherArea') : values.get('bodyArea')).trim();
        if (!bodyArea) { api.toast('Bitte einen Schmerzort angeben.'); return; }
        draft.bodyArea = bodyArea;
        showIntensity(draft, { fromArea: true });
      });
      bindHistoryPicker();
      focus('legend');
    }
    function showIntensity(draft, { fromArea = false, ...options } = {}) {
      if (signal.aborted) return;
      enterView('Schmerzstärke', () => showIntensity(draft, { replace: true, fromArea }), options);
      status.textContent = '';
      guidanceView();
      content.innerHTML = `
        <div class="pain-selected-area"><strong>${escape(draft.bodyArea)}</strong><button class="quiet" type="button" data-pain="change-area">Ort ändern</button></div>
        <form class="stack" id="painEntryForm">
          <fieldset aria-describedby="pain-scale${guidance ? ' pain-intensity-hint' : ''}"><legend tabindex="-1">Wie stark ist der Schmerz gerade?</legend>
            <p class="muted pain-question-hint" id="pain-intensity-hint" data-guidance-copy ${guidance ? '' : 'hidden'}>Wähle die Zahl, die gerade am ehesten passt.</p>
            <div class="pain-signature-value" aria-hidden="true"><output class="pain-value-number">${draft.intensity ?? '–'}</output><span>von 10</span></div>
            <div class="pain-intensities">${Array.from({ length: 10 }, (_, index) => index + 1).map(number => `<label class="pain-choice pain-number"><input type="radio" name="intensity" value="${number}" ${draft.intensity === number ? 'checked' : ''} required><span>${number}</span></label>`).join('')}</div>
            <p class="muted pain-hint" id="pain-scale">1 = wenig · 10 = sehr stark</p>
          </fieldset>
          <button type="submit">Speichern</button><button class="quiet" type="button" data-pain="back">Zurück</button>
        </form>`;
      const form = content.querySelector('#painEntryForm');
      form.addEventListener('change', () => {
        draft.intensity = Number(new FormData(form).get('intensity'));
        form.querySelector('.pain-value-number').value = draft.intensity;
      });
      bindForm(form, values => record(draft.bodyArea, values.has('intensity') ? Number(values.get('intensity')) : null));
      content.querySelector('[data-pain="change-area"]').addEventListener('click', () => {
        if (fromArea) api.goBack();
        else chooseEntry(draft, { replace: true });
      });
      content.querySelector('[data-pain="back"]').addEventListener('click', () => api.goBack());
      focus('legend');
    }
    function showReturning(entry, options = {}) {
      if (signal.aborted) return;
      enterView('Schmerz', () => showReturning(entry, { replace: true }), options);
      status.textContent = '';
      guidanceView(true);
      content.innerHTML = `
        <h2 class="section-title" tabindex="-1">Zuletzt dokumentiert</h2>
        <p class="pain-last-value"><strong>${escape(entry.bodyArea)} · ${entry.intensity}${entry.intensity === 0 ? ' · schmerzfrei' : ''}</strong><br>${documentedTime(entry.recordedAt)}</p>
        <button type="button" data-pain="same-area">Neuen Wert für ${escape(entry.bodyArea)}</button>
        ${resolvedAction(entry)}
        <div class="stack pain-actions"><button class="secondary" type="button" data-pain="another">Anderen Schmerz dokumentieren</button></div>
        ${historyPicker()}`;
      content.querySelector('[data-pain="same-area"]').addEventListener('click', () => showIntensity({ bodyArea: entry.bodyArea }));
      content.querySelector('[data-pain="another"]').addEventListener('click', () => chooseEntry());
      bindResolved(entry);
      bindHistoryPicker();
      focus('h2');
    }
    function showSaved(entry, prior = previous(entry), options = { reset: true }) {
      if (signal.aborted) return;
      // A committed observation finishes the input flow; Back must never replay it.
      enterView('Gespeicherter Eintrag', () => showSaved(entry, prior, { replace: true }), options);
      guidanceView();
      content.innerHTML = `
        <h2 class="section-title pain-confirmation-title" tabindex="-1">${escape(entry.bodyArea)} · ${entry.intensity === 0 ? 'schmerzfrei' : entry.intensity} gespeichert</h2>
        <p class="muted">Dokumentiert: ${escape(dateLabel(entry.recordedAt))}${entry.eventType === 'resolved' ? ' · Schmerz weg' : ''}</p>
        <p>${prior ? `Letzter dokumentierter Wert für ${escape(entry.bodyArea)}: <strong>${prior.intensity}${prior.intensity === 0 ? ' · schmerzfrei' : ''}</strong><br>${documentedTime(prior.recordedAt)}` : `Erster dokumentierter Wert für ${escape(entry.bodyArea)}.`}</p>
        <div class="stack pain-actions">
          <button type="button" data-pain="done">Fertig</button>
          <button class="secondary" type="button" data-pain="another">Weiteren Schmerzort dokumentieren</button>
          <div class="stack"><button class="secondary" type="button" data-pain="details" aria-describedby="pain-details-description">Details ergänzen</button><p class="muted pain-hint" id="pain-details-description" data-guidance-copy ${guidance ? '' : 'hidden'}>Beginn, Schmerzart, mögliche Zusammenhänge oder Notiz.</p></div>
          <button class="quiet" type="button" data-pain="history">Verlauf ansehen</button>
        </div>${resolvedAction(entry)}`;
      if (!guidance) content.querySelector('[data-pain="details"]').removeAttribute('aria-describedby');
      content.querySelector('[data-pain="done"]').addEventListener('click', () => api.goHome());
      bindResolved(entry);
      content.querySelector('[data-pain="another"]').addEventListener('click', () => chooseEntry());
      content.querySelector('[data-pain="details"]').addEventListener('click', () => showDetails(entry));
      content.querySelector('[data-pain="history"]').addEventListener('click', () => showHistory(entry.bodyArea));
      focus('h2');
    }
    function showDetails(entry, options = {}) {
      if (signal.aborted) return;
      enterView('Details ergänzen', () => showDetails(entry, { replace: true }), options);
      status.textContent = '';
      guidanceView();
      content.innerHTML = `
        <h2 class="section-title" tabindex="-1">Details ergänzen · ${escape(entry.bodyArea)}</h2>
        <p class="muted">${entry.intensity} · dokumentiert ${escape(dateLabel(entry.recordedAt))}. Alle Angaben sind freiwillig.</p>
        <form id="painDetailsForm" class="stack">
          <label>Seit wann ungefähr?<select name="start"><option value="">Keine Angabe</option>${[['now', 'zum Zeitpunkt der Dokumentation'], ['today', 'am Tag der Dokumentation'], ['yesterday', 'am Vortag'], ['exact', 'genauer …']].map(([key, label]) => `<option value="${key}" ${entry.startedAt?.kind === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
          <label class="pain-exact" ${entry.startedAt?.kind === 'exact' ? '' : 'hidden'}>Beginn<input type="datetime-local" name="exact" max="${localDateTime(entry.recordedAt)}" value="${entry.startedAt?.kind === 'exact' ? localDateTime(entry.startedAt.at) : ''}"></label>
          <fieldset><legend>Wie fühlt sich der Schmerz an?</legend>${QUALITIES.map(value => `<label class="check-row"><input type="checkbox" name="quality" value="${value}" ${entry.quality?.includes(value) ? 'checked' : ''}>${value}</label>`).join('')}</fieldset>
          <label>Wie sehr stört er dich gerade?<select name="interference"><option value="">Keine Angabe</option>${Array.from({ length: 11 }, (_, number) => `<option value="${number}" ${entry.interference === number ? 'selected' : ''}>${number}${number === 0 ? ' · gar nicht' : number === 10 ? ' · sehr stark' : ''}</option>`).join('')}</select></label>
          <label>Ist dir etwas aufgefallen, das damit zusammenhängen könnte?<textarea name="possibleContext" rows="2" maxlength="300">${escape(entry.possibleContext ?? '')}</textarea></label>
          <fieldset><legend>Was hast du getan?</legend>${RELIEF.map(value => `<label class="check-row"><input type="checkbox" name="relief" value="${value}" ${entry.relief?.includes(value) ? 'checked' : ''}>${value}</label>`).join('')}</fieldset>
          <label>Notiz<textarea name="note" rows="3" maxlength="2000">${escape(entry.note ?? '')}</textarea></label>
          <button type="submit">Angaben speichern</button><button class="quiet" type="button" data-pain="cancel">Zurück</button>
        </form>`;
      const form = content.querySelector('#painDetailsForm');
      const select = form.querySelector('select[name="start"]');
      const exact = form.querySelector('.pain-exact');
      const toggleExact = () => { exact.hidden = select.value !== 'exact'; exact.querySelector('input').required = !exact.hidden; };
      select.addEventListener('change', toggleExact);
      toggleExact();
      bindForm(form, async values => {
        const details = {};
        const startedAt = approximateStart(values.get('start'), entry.recordedAt, values.get('exact'));
        if (startedAt) details.startedAt = startedAt;
        for (const key of ['quality', 'relief']) if (values.getAll(key).length) details[key] = values.getAll(key);
        if (values.get('interference') !== '') details.interference = Number(values.get('interference'));
        for (const key of ['possibleContext', 'note']) if (values.get(key).trim()) details[key] = values.get(key).trim();
        const updated = await api.saveEntry(addDetails(entry, details));
        if (signal.aborted) return;
        entries = entries.map(item => item.id === updated.id ? updated : item);
        showSaved(updated);
        notify('Details gespeichert.');
      });
      form.querySelector('[data-pain="cancel"]').addEventListener('click', () => api.goBack());
      focus('h2');
    }
    function showHistory(area, options = {}) {
      if (signal.aborted) return;
      enterView(`${area} · Verlauf`, () => showHistory(area, { replace: true }), options);
      status.textContent = '';
      guidanceView();
      const history = historyForArea(entries, area);
      const today = new Date();
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const groups = new Map();
      for (const entry of history) {
        const day = localDate(entry.recordedAt);
        if (!groups.has(day)) groups.set(day, []);
        groups.get(day).push(entry);
      }
      content.innerHTML = `
        <h2 class="section-title" tabindex="-1">${escape(area)} · Verlauf</h2>
        <p class="muted">Angezeigt werden nur dokumentierte Werte.</p>
        ${[...groups].map(([day, group]) => `<section class="pain-day" aria-labelledby="pain-day-${day}"><h3 id="pain-day-${day}">${day === localDate(today) ? 'Heute' : day === localDate(yesterday) ? 'Gestern' : escape(new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(group[0].recordedAt))}</h3>${dayOverview(group)}<ol class="pain-history">${group.map(entry => `<li><div class="pain-history-value">${clock(entry.recordedAt)}<strong>${entry.intensity}${entry.intensity === 0 ? ' · schmerzfrei · Schmerz weg' : ''}</strong></div>${detailsText(entry)}<button class="quiet" type="button" data-entry="${escape(entry.id)}">Details ergänzen</button></li>`).join('')}</ol></section>`).join('') || '<p class="muted">Noch keine dokumentierten Werte für diesen Ort.</p>'}
        <button class="secondary" type="button" data-pain="new">Wert dokumentieren</button>`;
      for (const button of content.querySelectorAll('[data-entry]')) button.addEventListener('click', () => showDetails(history.find(entry => entry.id === button.dataset.entry)));
      content.querySelector('[data-pain="new"]').addEventListener('click', () => chooseEntry());
      focus('h2');
    }
    function detailsText(entry) {
      const details = [];
      if (entry.startedAt) details.push(['Beginn ungefähr', beginning(entry)]);
      if (entry.quality?.length) details.push(['Schmerzart', entry.quality.join(', ')]);
      if (entry.interference !== undefined) details.push(['Wie sehr gestört', entry.interference]);
      if (entry.possibleContext) details.push(['Möglicher Zusammenhang', entry.possibleContext]);
      if (entry.relief?.length) details.push(['Was getan wurde', entry.relief.join(', ')]);
      if (entry.note) details.push(['Notiz', entry.note]);
      return details.length ? `<dl class="pain-detail-text">${details.map(([label, value]) => `<div${label === 'Notiz' ? ' class="pain-detail-note"' : ''}><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>` : '';
    }
    const latest = [...entries].sort((a, b) => b.recordedAt - a.recordedAt || b.id.localeCompare(a.id))[0];
    if (latest) showReturning(latest, { reset: true });
    else chooseEntry({}, { reset: true });
    return () => { css.remove(); };
  }
};
