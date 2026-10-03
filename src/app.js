import { HELPERS } from './helpers/registry.js';
import { validateRegistry, helperDefaults } from './helpers/contract.js';
import { list, get, put, remove, clearAll, exportAll, importAll, makeId, pruneEntries } from './db.js';
import { getPosition, matchingPlaces, timeBucket, timeBucketLabel } from './context.js';
import { TIME_BUCKETS, validateRule } from './schema.js';
import { RETENTION_WINDOWS } from './retention.js';
import { renderNotes, renderPeople, renderPerson } from './read-views.js';
import { createNavigation } from './navigation.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const helpers = validateRegistry(HELPERS);

let activeHelper = null;
let helperCleanup = null;
let helperController = null;
let viewVersion = 0;
let dashboardVersion = 0;
let composerVersion = 0;
let installPrompt = null;
let composerReturnFocus = null;
const navigation = createNavigation({ title: 'Startseite', open: goHome });
let helperBackAction = null;

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 2600);
}

function helperById(id) { return helpers.find(helper => helper.id === id); }

async function getRule(helper) {
  const saved = await get('helperRules', helper.id);
  const rule = validateRule({ ...helperDefaults(helper), ...(saved || {}), id: helper.id });
  const contexts = helper.contexts || [];
  return {
    ...rule,
    placeIds: contexts.includes('place') ? rule.placeIds : [],
    timeBuckets: contexts.includes('time') ? rule.timeBuckets : [],
    intervalMinutes: contexts.includes('interval') ? rule.intervalMinutes : null,
    toleranceMinutes: contexts.includes('interval') ? rule.toleranceMinutes : null
  };
}

async function visibleHelpers() {
  const result = [];
  for (const helper of helpers) {
    const rule = await getRule(helper);
    if (rule.visible) result.push({ helper, rule });
  }
  return result;
}

async function recordUse(helperId) {
  await put('settings', { id: `usage:${helperId}`, lastUsedAt: Date.now() });
}

function reportError(error, message = 'Aktion konnte nicht ausgeführt werden. Bitte erneut versuchen.') {
  if (error?.name === 'AbortError' && error.message === 'Helfer geschlossen.') return;
  toast(error?.name === 'QuotaExceededError'
    ? 'Browser-Speicher voll. Bitte Daten exportieren und Speicher freigeben.'
    : error?.name === 'AbortError'
      ? 'Speichervorgang abgebrochen. Bitte erneut versuchen.'
    : error?.name === 'UnknownError' || error?.name === 'InvalidStateError' || error?.name === 'SecurityError'
      ? 'Speicher nicht verfügbar. Bitte Browsereinstellungen prüfen.'
    : error?.message === 'Datenbank-Update blockiert. Bitte andere Tabs dieser App schließen.'
      ? 'Speicher konnte nicht geöffnet werden. Bitte andere Tabs dieser App schließen und diese Seite neu laden.'
      : message);
}

function guarded(action) {
  return (...args) => { Promise.resolve().then(() => action(...args)).catch(reportError); };
}

// preventDefault must run synchronously, before any async work or browser navigation.
function bindSubmit(form, save) {
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (form.dataset.saving) return;
    const data = new FormData(form);
    const buttons = [...form.querySelectorAll('button[type="submit"]')];
    form.dataset.saving = 'true';
    const disabledBefore = buttons.map(button => button.disabled);
    buttons.forEach(button => { button.disabled = true; });
    Promise.resolve().then(() => save(data)).catch(error => reportError(error, 'Konnte nicht gespeichert werden. Deine Eingabe bleibt erhalten. Bitte erneut versuchen.')).finally(() => {
      delete form.dataset.saving;
      buttons.forEach((button, index) => { button.disabled = disabledBefore[index]; });
    });
  });
}

function stopHelper() {
  helperController?.abort();
  helperController = null;
  const cleanup = helperCleanup;
  helperCleanup = null;
  activeHelper = null;
  helperBackAction = null;
  $('#helperHost').replaceChildren();
  if (cleanup) { try { cleanup(); } catch (error) { reportError(error); } }
}

async function lastUsed(helperId) {
  return (await get('settings', `usage:${helperId}`))?.lastUsedAt || 0;
}

function returnFocusTarget() {
  const element = document.activeElement;
  if (element?.id) return `#${CSS.escape(element.id)}`;
  for (const attribute of ['data-helper', 'data-person']) {
    if (element?.hasAttribute(attribute)) {
      const host = element.closest('[id]');
      return `${host ? `#${CSS.escape(host.id)} ` : ''}[${attribute}="${CSS.escape(element.getAttribute(attribute))}"]`;
    }
  }
  return null;
}

function restoreFocus(selector) {
  const target = selector && $(selector);
  if (target?.getClientRects().length && !target.disabled) target.focus();
  else ($('#view-dashboard').hidden ? $('#focusTitle') : $('#main')).focus({ preventScroll: true });
}

function updateBackLabel() {
  const title = helperBackAction?.title || navigation.parent?.title;
  $('#backButton').setAttribute('aria-label', title && title !== 'Startseite' ? `Zurück zu ${title}` : 'Zurück zur Startseite');
}

function showView(name, title, open, options = {}) {
  navigation.enter({ title: title || 'Startseite', open }, { ...options, returnFocus: returnFocusTarget() });
  viewVersion++;
  stopHelper();
  $$('.view').forEach(view => { view.hidden = true; });
  $(`#view-${name}`).hidden = false;

  const dashboard = name === 'dashboard';
  $('#backButton').hidden = dashboard;
  updateBackLabel();
  $('#brandButton').hidden = !dashboard;
  $('#focusTitle').hidden = dashboard;
  $('#focusTitle').textContent = title;
  $('#headerMenuWrap').hidden = !dashboard;
  $('#helperSettingsButton').hidden = !(name === 'helper' && activeHelper);
  closeMenu();
  closeComposer();
  $('#main').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

async function goHome() {
  const focus = navigation.root.returnFocus;
  showView('dashboard', '', goHome, { reset: true });
  const version = viewVersion;
  await renderDashboard();
  if (version === viewVersion) restoreFocus(focus);
}

async function goBack() {
  if (helperBackAction) { await helperBackAction.action(); return; }
  const target = navigation.back();
  if (!target) { await goHome(); return; }
  const pending = target.open();
  const version = viewVersion;
  await pending;
  if (version === viewVersion) restoreFocus(target.returnFocus);
}

function openMenu() {
  const panel = $('#menuPanel');
  panel.hidden = !panel.hidden;
  $('#menuButton').setAttribute('aria-expanded', String(!panel.hidden));
}

function closeMenu() {
  $('#menuPanel').hidden = true;
  $('#menuButton').setAttribute('aria-expanded', 'false');
}

async function openHelper(id, options = {}) {
  const helper = helperById(id);
  if (!helper) return;
  showView('helper', helper.label, () => openHelper(id, { replace: true }), options);
  const version = viewVersion;
  const controller = new AbortController();
  helperController = controller;
  activeHelper = helper;
  $('#helperSettingsButton').hidden = false;
  // Each mount owns a separate node. Old async work can only modify its detached root.
  const root = document.createElement('div');
  $('#helperHost').append(root);
  const current = () => version === viewVersion && !controller.signal.aborted;
  const requireCurrent = action => (...args) => {
    if (!current()) throw new DOMException('Helfer geschlossen.', 'AbortError');
    return action(...args);
  };
  try {
    if (!(await getRule(helper)).visible) {
      if (current()) await goHome();
      return;
    }
    if (!current()) return;
    const cleanup = await helper.mount({
      root,
      signal: controller.signal,
      api: {
        recordUse: requireCurrent(() => recordUse(id)),
        saveEntry: requireCurrent(async value => {
          const entry = { ...value, id: value.id || makeId(id), helperId: id, createdAt: value.createdAt ?? Date.now() };
          await put('entries', entry);
          return entry;
        }),
        listEntries: requireCurrent(async () => (await list('entries', { prune: false })).filter(entry => entry.helperId === id)),
        getGuidance: requireCurrent(async () => (await getRule(helper)).guidance !== false),
        setGuidance: requireCurrent(async guidance => {
          if (!helper.guidance || typeof guidance !== 'boolean') throw new Error('Ungültige Hinweiseinstellung.');
          const rule = await getRule(helper);
          if (!current()) throw new DOMException('Helfer geschlossen.', 'AbortError');
          await put('helperRules', { ...rule, guidance });
        }),
        openSettings: requireCurrent(() => guarded(() => openHelperSettings(id))()),
        // Helpers register only their internal parent; the shell owns the global button.
        setBackAction: requireCurrent((action = null, title = helper.label) => {
          if (action !== null && typeof action !== 'function') throw new TypeError('Ungültige Zurück-Aktion.');
          helperBackAction = action ? { action, title } : null;
          updateBackLabel();
        }),
        goBack: requireCurrent(() => guarded(goBack)()),
        goHome: requireCurrent(() => guarded(goHome)()),
        toast: requireCurrent(toast)
      }
    });
    if (typeof cleanup === 'function') {
      if (current()) helperCleanup = cleanup;
      else cleanup();
    }
  } catch (error) {
    if (current()) { await goHome(); throw error; }
  }
}

async function openHelperSettings(id, options = {}) {
  const helper = helperById(id);
  if (!helper) return;
  showView('helper-settings', `${helper.label} · Einstellungen`, () => openHelperSettings(id, { replace: true }), options);
  const version = viewVersion;
  const root = $('#helperSettingsHost');
  root.replaceChildren();
  const rule = await getRule(helper);
  const places = await list('places');
  if (version !== viewVersion) return;
  const contexts = helper.contexts || [];
  root.innerHTML = `
    <form id="helperSettingsForm" class="stack">
      <label class="toggle-row"><span><strong>Favorit</strong><small>In „Favoriten“ anzeigen.</small></span><input name="favorite" type="checkbox" ${rule.favorite ? 'checked' : ''}></label>
      <label class="toggle-row"><span><strong>Sichtbar</strong><small>In „Alle Helfer“ anzeigen.</small></span><input name="visible" type="checkbox" ${rule.visible ? 'checked' : ''}></label>
      ${contexts.includes('place') ? `<fieldset><legend>Ort</legend>${places.length ? places.map(place => `<label class="check-row"><input type="checkbox" name="place" value="${escapeHtml(place.id)}" ${rule.placeIds.includes(place.id) ? 'checked' : ''}> ${escapeHtml(place.name)}</label>`).join('') : '<p class="muted">Noch kein Ort gespeichert.</p>'}</fieldset>` : ''}
      ${contexts.includes('time') ? `<fieldset><legend>Tageszeit</legend>${TIME_BUCKETS.map(bucket => `<label class="check-row"><input type="checkbox" name="time" value="${bucket}" ${rule.timeBuckets.includes(bucket) ? 'checked' : ''}> ${timeBucketLabel(bucket)}</label>`).join('')}</fieldset>` : ''}
      ${contexts.includes('interval') ? `<fieldset><legend>Intervall</legend><div class="form-grid two"><label>Minuten<input name="interval" type="number" min="1" inputmode="numeric" value="${escapeHtml(rule.intervalMinutes ?? '')}"></label><label>Toleranz ± Minuten<input name="tolerance" type="number" min="0" inputmode="numeric" value="${escapeHtml(rule.toleranceMinutes ?? '')}"></label></div></fieldset>` : ''}
      ${helper.retention ? `<label>Aufbewahrung<select name="trackingWindow">${RETENTION_WINDOWS.map(window => `<option value="${window}" ${rule.trackingWindow === window ? 'selected' : ''}>${({ '7d': '7 Tage', '30d': '30 Tage', '365d': '365 Tage', always: 'Unbegrenzt' })[window]}</option>`).join('')}</select></label><p class="muted">Bei begrenzter Dauer werden ältere Einträge gelöscht – bei einer Verkürzung schon beim Speichern. Einstellungen bleiben erhalten.</p>` : ''}
      ${helper.guidance ? `<label class="toggle-row"><span><strong>Hinweise anzeigen</strong><small>Kurze Erklärungen beim Dokumentieren anzeigen.</small></span><input name="guidance" type="checkbox" ${rule.guidance ? 'checked' : ''}></label>` : ''}
      <button type="submit">Speichern</button>
    </form>`;
  bindSubmit($('#helperSettingsForm'), async form => {
    let nextRule;
    try {
      nextRule = validateRule({
        ...rule,
        id,
        favorite: form.has('favorite'),
        visible: form.has('visible'),
        placeIds: form.getAll('place'),
        timeBuckets: form.getAll('time'),
        intervalMinutes: form.get('interval') ? Number(form.get('interval')) : null,
        toleranceMinutes: form.get('tolerance') ? Number(form.get('tolerance')) : null,
        ...(helper.retention ? { trackingWindow: form.get('trackingWindow') } : {}),
        ...(helper.guidance ? { guidance: form.has('guidance') } : {})
      });
    } catch {
      toast('Bitte Intervall und Toleranz prüfen. Das Intervall muss mindestens eine Minute betragen. Die Toleranz muss nichtnegativ und kleiner als das Intervall sein.');
      return;
    }
    await put('helperRules', nextRule);
    toast('Einstellungen gespeichert.');
  });
}

function tile(helper, reason) {
  return `<button class="helper-tile" type="button" data-helper="${escapeHtml(helper.id)}"><strong>${escapeHtml(helper.label)}</strong>${reason ? `<span>${escapeHtml(reason)}</span>` : ''}</button>`;
}

async function dashboardCandidates(visible) {
  if (!visible.length) return [];
  const places = await list('places');
  const hasPlaceRules = visible.some(({ rule }) => rule.placeIds.length);
  let activePlaces = [];
  if (hasPlaceRules) {
    try { activePlaces = matchingPlaces(await getPosition(), places); } catch { activePlaces = []; }
  }
  const placeIds = new Set(activePlaces.map(place => place.id));
  const bucket = timeBucket();
  const now = Date.now();
  const items = [];
  for (const { helper, rule } of visible) {
    const usedAt = await lastUsed(helper.id);
    let reason = '';
    let rank = 0;
    if (rule.placeIds.some(id => placeIds.has(id))) { reason = activePlaces.find(place => rule.placeIds.includes(place.id))?.name || 'Ort'; rank = 400; }
    else if (rule.intervalMinutes && usedAt && now >= usedAt + Math.max(0, rule.intervalMinutes - (rule.toleranceMinutes || 0)) * 60000) { reason = `Intervall · ${rule.intervalMinutes} Min.`; rank = 300; }
    else if (rule.timeBuckets.includes(bucket)) { reason = timeBucketLabel(bucket); rank = 200; }
    else if (usedAt) { reason = 'zuletzt verwendet'; rank = 100 + Math.max(0, 30 - Math.floor((now - usedAt) / 3600000)); }
    if (reason) items.push({ helper, reason, rank, usedAt });
  }
  return items.sort((a, b) => b.rank - a.rank || b.usedAt - a.usedAt);
}

async function renderDashboard() {
  const version = ++dashboardVersion;
  const visible = await visibleHelpers();
  const favorites = visible.filter(({ rule }) => rule.favorite).map(({ helper }) => helper).sort((a, b) => a.label.localeCompare(b.label, 'de'));
  const candidates = await dashboardCandidates(visible);
  if (version !== dashboardVersion) return;

  $('#nowRows').innerHTML = candidates.length ? candidates.slice(0, 9).map(({ helper, reason }) => tile(helper, reason)).join('') : '';
  $('#favoriteTiles').innerHTML = favorites.length ? favorites.map(helper => tile(helper, '')).join('') : '';

  const categories = [...new Set(visible.map(({ helper }) => helper.category))].sort((a, b) => a.localeCompare(b, 'de'));
  const selectedCategory = $('#helperCategory').value;
  $('#helperCategory').innerHTML = '<option value="">Alle Kategorien</option>' + categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  $('#helperCategory').value = categories.includes(selectedCategory) ? selectedCategory : '';
  $('#helperToolbar').hidden = visible.length === 0;
  await renderAllHelpers(visible);
}

async function renderAllHelpers(visibleSnapshot = null) {
  const visible = visibleSnapshot || await visibleHelpers();
  const query = $('#helperSearch').value.trim().toLocaleLowerCase('de');
  const category = $('#helperCategory').value;
  const filtered = visible
    .map(({ helper }) => helper)
    .filter(helper => (!category || helper.category === category) && (!query || `${helper.label} ${helper.category}`.toLocaleLowerCase('de').includes(query)))
    .sort((a, b) => a.label.localeCompare(b.label, 'de'));
  $('#allHelperList').innerHTML = filtered.length
    ? filtered.map(helper => `<button type="button" class="helper-list-item" data-helper="${escapeHtml(helper.id)}"><span><strong>${escapeHtml(helper.label)}</strong><small>${escapeHtml(helper.category)}</small></span><span aria-hidden="true">›</span></button>`).join('')
    : `<p class="muted empty-state">${visible.length ? 'Keine Helfer gefunden.' : 'Keine sichtbaren Helfer.'}</p>`;
}

async function renderSettings() {
  const version = viewVersion;
  const rules = await list('helperRules');
  if (version !== viewVersion) return;
  $('#rulesList').innerHTML = rules.length ? rules.map(rule => `<div class="list-item"><span><strong>${escapeHtml(helperById(rule.id)?.label || rule.id)}</strong><small>${escapeHtml([rule.favorite ? 'Favorit' : '', rule.placeIds?.length ? `${rule.placeIds.length} ${rule.placeIds.length === 1 ? 'Ort' : 'Orte'}` : '', rule.timeBuckets?.length ? rule.timeBuckets.map(timeBucketLabel).join(', ') : '', rule.intervalMinutes ? `${rule.intervalMinutes} Min.` : ''].filter(Boolean).join(' · ') || 'Keine Verknüpfung')}</small></span></div>`).join('') : '<p class="muted">Noch keine Verknüpfungen.</p>';

  const places = await list('places');
  if (version !== viewVersion) return;
  $('#placesList').innerHTML = places.length ? places.map(place => `<div class="list-item"><span><strong>${escapeHtml(place.name)}</strong><small>Radius ${escapeHtml(place.radius)} m</small></span><button class="quiet danger-text" type="button" data-remove-place="${escapeHtml(place.id)}">Entfernen</button></div>`).join('') : '<p class="muted">Noch kein Ort gespeichert.</p>';

  const visibilityHtml = helpers.length ? (await Promise.all(helpers.map(async helper => {
    const rule = await getRule(helper);
    return `<label class="toggle-row"><span><strong>${escapeHtml(helper.label)}</strong><small>${escapeHtml(helper.category)}</small></span><input type="checkbox" data-helper-visible="${escapeHtml(helper.id)}" ${rule.visible ? 'checked' : ''}></label>`;
  }))).join('') : '<p class="muted">Keine Helfer verfügbar.</p>';
  if (version === viewVersion) $('#helperVisibilityList').innerHTML = visibilityHtml;
}

async function openCoreView(name, options = {}) {
  const open = () => openCoreView(name, { replace: true });
  if (name === 'notes' || name === 'people') {
    showView('read', name === 'notes' ? 'Notizen' : 'Personen', open, options);
    const version = viewVersion;
    const root = $('#readHost');
    root.replaceChildren();
    root.setAttribute('aria-busy', 'true');
    try {
      // Reading core content must not trigger helper retention writes.
      const records = await list(name === 'notes' ? 'entries' : 'people', { prune: false });
      if (version !== viewVersion) return;
      if (name === 'notes') renderNotes(root, records);
      else {
        renderPeople(root, records);
      }
    } catch (error) {
      if (version === viewVersion) reportError(error, 'Inhalte konnten nicht geladen werden. Bitte erneut versuchen.');
    } finally {
      if (version === viewVersion) root.removeAttribute('aria-busy');
    }
  } else if (name === 'settings') {
    showView('settings', 'Verknüpfungen & Orte', open, options);
    await renderSettings();
  } else if (name === 'data') {
    showView('data', 'Daten', open, options);
  }
}

async function openPerson(id, name, options = {}) {
  showView('read', name, () => openPerson(id, name, { replace: true }), options);
  const version = viewVersion;
  const root = $('#readHost');
  root.replaceChildren();
  root.setAttribute('aria-busy', 'true');
  try {
    const [person, entries] = await Promise.all([get('people', id), list('entries', { prune: false })]);
    if (version !== viewVersion) return;
    if (!person) { await goBack(); return; }
    $('#focusTitle').textContent = person.name;
    renderPerson(root, person, entries);
  } catch (error) {
    if (version === viewVersion) reportError(error, 'Inhalte konnten nicht geladen werden. Bitte erneut versuchen.');
  } finally {
    if (version === viewVersion) root.removeAttribute('aria-busy');
  }
}

const staticViews = {
  privacy: {
    title: 'Datenschutz',
    html: `<p>Erfasste Inhalte werden lokal in diesem Browser gespeichert und von der App nicht an einen Server übertragen. Es gibt kein Benutzerkonto und keine Nutzungsanalyse.</p><p>Nach Browserfreigabe wird der Standort auf der Startseite mit Ortsverknüpfungen und beim Öffnen von „Diesen Ort merken“ abgefragt. Die App wertet ihn lokal aus und fragt ihn nicht fortlaufend im Hintergrund ab.</p><p><strong>Vor Veröffentlichung:</strong> Angaben zu Server-Logs des tatsächlichen Hosters ergänzen.</p>`
  },
  imprint: {
    title: 'Impressum',
    html: `<p><strong>Platzhalter – vor Veröffentlichung ergänzen.</strong></p><p>Name / Anschrift / Kontakt des verantwortlichen Anbieters.</p>`
  },
  appinfo: {
    title: 'App-Info & Open Source',
    html: `<p>0815 ist eine installierbare Web-App unter MIT-Lizenz.</p><p>Entwickelt mit HTML, CSS und JavaScript, ohne externe Laufzeit-Abhängigkeiten.</p>`
  }
};

function openStatic(key, options = {}) {
  const view = staticViews[key];
  if (!view) return;
  $('#staticTitle').textContent = view.title;
  $('#staticContent').innerHTML = view.html;
  showView('static', view.title, () => openStatic(key, { replace: true }), options);
}

function closeComposer() {
  composerVersion++;
  $('#quickComposer').hidden = true;
  $('#quickComposerBody').replaceChildren();
  if (composerReturnFocus) composerReturnFocus.focus();
  composerReturnFocus = null;
}

async function openComposer(type, trigger = null) {
  closeComposer();
  const version = composerVersion;
  const current = () => version === composerVersion;
  composerReturnFocus = trigger;
  const panel = $('#quickComposer');
  const title = $('#quickComposerTitle');
  const body = $('#quickComposerBody');
  panel.hidden = false;

  if (type === 'note') {
    title.textContent = 'Notiz';
    body.innerHTML = `<form id="noteForm" class="composer-form"><label class="visually-hidden" for="noteText">Notiz</label><textarea id="noteText" name="text" rows="2" placeholder="Notiz" required></textarea><button type="submit">Speichern</button></form>`;
    bindSubmit($('#noteForm'), async form => {
      const text = form.get('text').trim();
      if (!text) return;
      await put('entries', { id: makeId('note'), type: 'note', text, createdAt: Date.now() });
      if (current()) closeComposer();
      toast('Notiz gespeichert.');
    });
    $('#noteText').focus();
  }

  if (type === 'place') {
    title.textContent = 'Diesen Ort merken';
    body.innerHTML = `<form id="placeForm" class="composer-form"><label>Name<input name="name" placeholder="z. B. Einkaufszentrum" required></label><button type="submit">Ort speichern</button><p id="placeStatus" class="muted" aria-live="polite"></p></form>`;
    let position;
    const form = $('#placeForm');
    const status = $('#placeStatus');
    const saveButton = form.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    bindSubmit(form, async data => {
      if (!position || !current()) { toast('Standort noch nicht verfügbar.'); return; }
      const name = data.get('name').trim();
      if (!name) return;
      await put('places', { id: makeId('place'), name, lat: position.lat, lon: position.lon, radius: 250, createdAt: Date.now() });
      if (current()) closeComposer();
      toast('Ort gespeichert.');
      if (!$('#view-settings').hidden) await renderSettings();
    });
    form.querySelector('input[name="name"]').focus();
    status.textContent = 'Standort wird abgefragt …';
    try {
      position = await getPosition({ maximumAge: 0 });
      if (!current()) return;
      status.textContent = 'Standort bereit.';
      saveButton.disabled = false;
    } catch {
      if (current()) status.textContent = 'Standort nicht verfügbar. Bitte die Standortfreigabe im Browser prüfen und erneut öffnen.';
    }
  }

  if (type === 'person') {
    title.textContent = 'Person';
    const people = (await list('people')).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    if (!current()) return;
    body.innerHTML = `<form id="personForm" class="composer-form">
      <label>Person<select name="personId"><option value="new">Neue Person</option>${people.map(person => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.name)}</option>`).join('')}</select></label>
      <label id="newPersonField">Name<input name="newName" placeholder="Name"></label>
      <fieldset><legend>Art des Eintrags</legend><label class="check-row"><input type="radio" name="kind" value="reference" checked> Notiz</label><label class="check-row"><input type="radio" name="kind" value="gift"> Geschenkidee</label></fieldset>
      <label>Notiz<textarea name="text" rows="2" required></textarea></label>
      <button type="submit">Hinzufügen</button>
    </form>`;
    const select = $('#personForm select[name="personId"]');
    const updateNewField = () => { $('#newPersonField').hidden = select.value !== 'new'; };
    select.addEventListener('change', updateNewField); updateNewField();
    bindSubmit($('#personForm'), async form => {
      const text = form.get('text').trim();
      if (!text) return;
      let personId = form.get('personId');
      if (personId === 'new') {
        const name = form.get('newName').trim();
        if (!name) { toast('Bitte einen Namen angeben.'); return; }
        personId = makeId('person');
        await put('people', { id: personId, name, createdAt: Date.now() });
      }
      await put('entries', { id: makeId('person-note'), type: 'person-note', personId, kind: form.get('kind'), text, createdAt: Date.now() });
      if (current()) closeComposer();
      toast(form.get('kind') === 'gift' ? 'Geschenkidee gespeichert.' : 'Notiz zur Person gespeichert.');
    });
    select.focus();
  }
}

async function addPlaceFromSettings() {
  await openComposer('place', $('#settingsAddPlace'));
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
}

async function initStorageStatus() {
  const status = $('#storageStatus');
  if (!navigator.storage?.persisted) { status.textContent = 'Speicherschutz ist hier nicht verfügbar.'; return; }
  status.textContent = await navigator.storage.persisted() ? 'Schutz vor automatischem Löschen aktiv.' : 'Browser kann Daten bei Speichermangel löschen.';
}

function bindEvents() {
  $('#brandButton').addEventListener('click', guarded(goHome));
  $('#backButton').addEventListener('click', guarded(goBack));
  $('#menuButton').addEventListener('click', openMenu);
  $('#helperSettingsButton').addEventListener('click', guarded(() => { if (activeHelper) return openHelperSettings(activeHelper.id); }));
  $('#quickComposerClose').addEventListener('click', closeComposer);

  document.addEventListener('submit', event => { if (event.target.matches('form')) event.preventDefault(); }, true);
  document.addEventListener('click', guarded(async event => {
    const helperButton = event.target.closest('[data-helper]');
    if (helperButton) { await openHelper(helperButton.dataset.helper); return; }
    const composerButton = event.target.closest('[data-composer]');
    if (composerButton) { await openComposer(composerButton.dataset.composer, composerButton); return; }
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) { await openCoreView(viewButton.dataset.view); return; }
    const personButton = event.target.closest('[data-person]');
    if (personButton) { await openPerson(personButton.dataset.person, personButton.firstElementChild.textContent); return; }
    const staticButton = event.target.closest('[data-static]');
    if (staticButton) { openStatic(staticButton.dataset.static); return; }
    const removePlaceButton = event.target.closest('[data-remove-place]');
    if (removePlaceButton) { await remove('places', removePlaceButton.dataset.removePlace); await renderSettings(); return; }
    const visibleToggle = event.target.closest('[data-helper-visible]');
    if (visibleToggle) {
      const helper = helperById(visibleToggle.dataset.helperVisible);
      const checked = visibleToggle.checked;
      visibleToggle.disabled = true;
      try {
        const rule = await getRule(helper);
        await put('helperRules', { ...rule, visible: checked });
      } catch (error) {
        visibleToggle.checked = !checked;
        throw error;
      } finally { visibleToggle.disabled = false; }
      await renderDashboard();
    }
  }));

  $('#helperSearch').addEventListener('input', guarded(() => renderAllHelpers()));
  $('#helperCategory').addEventListener('change', guarded(() => renderAllHelpers()));
  $('#settingsAddPlace').addEventListener('click', guarded(addPlaceFromSettings));

  $('#persistStorageButton').addEventListener('click', guarded(async () => {
    if (!navigator.storage?.persist) { toast('Speicherschutz ist hier nicht verfügbar.'); return; }
    toast(await navigator.storage.persist() ? 'Schutz vor automatischem Löschen aktiv.' : 'Browser hat den Speicherschutz nicht freigegeben.');
    await initStorageStatus();
  }));

  $('#exportButton').addEventListener('click', guarded(async () => downloadJson(await exportAll(), `0815-export-${new Date().toISOString().slice(0, 10)}.json`)));
  $('#importInput').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!confirm('Import ersetzt alle lokalen Daten dieser App. Fortfahren?')) { event.target.value = ''; return; }
    let imported = false;
    try {
      await importAll(JSON.parse(await file.text()));
      imported = true;
      toast('Daten importiert.');
      await renderDashboard();
    } catch (error) {
      if (imported) toast('Daten importiert. Die Ansicht konnte nicht aktualisiert werden. Bitte neu laden.');
      else reportError(error, 'Import fehlgeschlagen. Bitte einen 0815-Export wählen. Vorhandene Daten bleiben erhalten.');
    }
    event.target.value = '';
  });
  $('#resetButton').addEventListener('click', guarded(async () => {
    if (!confirm('Alle lokalen Daten dieser App wirklich löschen?')) return;
    await clearAll(); toast('Lokale Daten gelöscht.'); await goHome();
  }));

  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('#installButton').hidden = false; });
  window.addEventListener('appinstalled', () => { installPrompt = null; $('#installButton').hidden = true; });
  $('#installButton').addEventListener('click', guarded(async () => { if (!installPrompt) return; await installPrompt.prompt(); installPrompt = null; $('#installButton').hidden = true; }));
  if (window.matchMedia('(display-mode: standalone)').matches) $('#installButton').hidden = true;
}

async function init() {
  bindEvents();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { type: 'module', updateViaCache: 'none' }).catch(() => toast('Offline-Nutzung konnte nicht eingerichtet werden.'));
  await pruneEntries();
  await renderDashboard();
  await initStorageStatus();
}

init().catch(reportError);
