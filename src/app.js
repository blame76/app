import { HELPERS } from './helpers/registry.js';
import { validateRegistry, helperDefaults } from './helpers/contract.js';
import { list, get, put, remove, clearAll, exportAll, importAll, makeId, pruneEntries } from './db.js';
import { evaluateHelperContext, getPosition, watchPosition, matchingPlaces, nextTimeBoundary, timeBucket, timeBucketLabel } from './context.js';
import { TIME_BUCKETS, PLACE_CATEGORIES, validateRule } from './schema.js';
import { fromLegacyMinutes, INTERVAL_UNITS, intervalLabel, intervalUnitLabel } from './intervals.js';
import { RETENTION_WINDOWS } from './retention.js';
import { renderNotes, renderPeople, renderPerson } from './read-views.js';
import { createNavigation } from './navigation.js';
import { isNote, noteLabel, editNote, changeNoteContext, noteContext, relevantNotes } from './notes.js';
import { renderNote, renderNoteEdit, renderNoteContext, renderNoteContextPicker } from './note-views.js';
import { noteTextClass } from './note-presentation.js';
import { startPwaUpdates } from './pwa-update.js';
import { initializeTheme, saveTheme } from './theme.js';
import { PLACE_RADII, LOCATION_EXPLANATION, RADIUS_EXPLANATION, groupPlaces, radiusLabel } from './places.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const helpers = validateRegistry(HELPERS);

let activeHelper = null;
let helperCleanup = null;
let helperController = null;
let viewVersion = 0;
let dashboardVersion = 0;
let stopLocationWatch = null;
let contextTimer = null;
let dashboardPosition = null;
let locationRequested = false;

let composerVersion = 0;
let installPrompt = null;
let composerReturnFocus = null;
const navigation = createNavigation({ title: 'Startseite', open: goHome });
let helperBackAction = null;

function pauseDashboardContext() {
  stopLocationWatch?.();
  stopLocationWatch = null;
  clearTimeout(contextTimer);
  contextTimer = null;
  dashboardPosition = null;
  locationRequested = false;
  dashboardVersion++;
}

function dashboardVisible() { return !document.hidden && !$('#view-dashboard').hidden; }

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

function clearToast() {
  clearTimeout(toast.timer);
  $('#toast').hidden = true;
}

function contextError(root, message) {
  let status = root.querySelector('.note-context-error');
  if (!status) {
    status = document.createElement('p');
    status.className = 'muted note-context-error';
    status.setAttribute('role', 'status');
    (root.querySelector('form') || root).append(status);
  }
  status.textContent = message;
}

function helperById(id) { return helpers.find(helper => helper.id === id); }

async function getRule(helper) {
  const saved = await get('helperRules', helper.id);
  const contexts = helper.contexts || [];
  const persisted = { ...(saved || {}) };
  const legacyMinutes = !Object.hasOwn(persisted, 'interval') && Object.hasOwn(persisted, 'intervalMinutes')
    ? { interval: persisted.intervalMinutes, tolerance: persisted.toleranceMinutes }
    : null;
  if (legacyMinutes) {
    persisted.interval = fromLegacyMinutes(persisted.intervalMinutes);
    persisted.earlyBy = fromLegacyMinutes(persisted.toleranceMinutes, { allowZero: true });
    delete persisted.intervalMinutes;
    delete persisted.toleranceMinutes;
  }
  const rule = validateRule({ ...helperDefaults(helper), ...persisted, id: helper.id });
  return {
    ...rule,
    placeIds: contexts.includes('place') ? rule.placeIds : [],
    timeBuckets: contexts.includes('time') ? rule.timeBuckets : [],
    interval: contexts.includes('interval') ? rule.interval : null,
    earlyBy: contexts.includes('interval') ? rule.earlyBy : null,
    legacyIntervalMinutes: legacyMinutes?.interval ?? null,
    legacyToleranceMinutes: legacyMinutes?.tolerance ?? null
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
  if (dashboardVisible()) refreshNow();
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
    form.setAttribute('aria-busy', 'true');
    const disabledBefore = buttons.map(button => button.disabled);
    buttons.forEach(button => { button.disabled = true; });
    Promise.resolve().then(() => save(data)).catch(error => reportError(error, 'Konnte nicht gespeichert werden. Deine Eingabe bleibt erhalten. Bitte erneut versuchen.')).finally(() => {
      delete form.dataset.saving;
      form.removeAttribute('aria-busy');
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
  for (const attribute of ['data-helper', 'data-person', 'data-note']) {
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

function showView(name, title, open, options = {}, section = name) {
  pauseDashboardContext();
  $('#noteDeleteDialog').close();
  navigation.enter({ title: title || 'Startseite', open }, { ...options, returnFocus: returnFocusTarget() });
  viewVersion++;
  stopHelper();
  $$('.view').forEach(view => { view.hidden = true; });
  $(`#view-${name}`).hidden = false;

  const dashboard = name === 'dashboard';
  if (dashboard) $('#nowRows').replaceChildren();
  $('#backButton').hidden = dashboard;
  updateBackLabel();
  $('#brandButton').hidden = !dashboard;
  $('#focusTitle').hidden = dashboard;
  $('#focusTitle').textContent = title;
  const notesChapter = section === 'notes';
  $('.app-header').dataset.section = notesChapter ? 'notes' : name;
  $('#signatureHeadingScript').textContent = notesChapter ? 'Journal' : '';
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
  showView('helper', helper.label, () => openHelper(id, { replace: true, launchContext: options.launchContext }), options);
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
      launchContext: options.launchContext ?? null,
      api: {
        recordUse: requireCurrent(() => recordUse(id)),
        getPosition: requireCurrent(() => getPosition({ maximumAge: 0 })),
        deleteEntry: requireCurrent(async entryId => {
          const entry = await get('entries', entryId);
          if (!current()) throw new DOMException('Helfer geschlossen.', 'AbortError');
          if (entry && entry.helperId !== id) throw new Error('Fremder Eintrag.');
          if (entry) await remove('entries', entryId);
        }),
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
  const hasContexts = contexts.length > 0;
  root.innerHTML = `
    <form id="helperSettingsForm" class="stack">
      <label class="toggle-row"><span><strong>Favorit</strong><small>In „Favoriten“ anzeigen.</small></span><input name="favorite" type="checkbox" ${rule.favorite ? 'checked' : ''}></label>
      <label class="toggle-row"><span><strong>Sichtbar</strong><small>In „Alle Helfer“ anzeigen.</small></span><input name="visible" type="checkbox" ${rule.visible ? 'checked' : ''}></label>
      ${hasContexts ? '<h2 class="settings-question">Wann soll dieser Helfer unter „Jetzt“ erscheinen?</h2>' : ''}
      ${contexts.includes('place') ? `<fieldset><legend>An einem Ort</legend>${places.length ? places.map(place => `<label class="check-row"><input type="checkbox" name="place" value="${escapeHtml(place.id)}" ${rule.placeIds.includes(place.id) ? 'checked' : ''}> ${escapeHtml(place.name)}</label>`).join('') : '<p class="muted">Noch kein Ort gespeichert.</p>'}</fieldset>` : ''}
      ${contexts.includes('time') ? `<fieldset><legend>Zu einer Tageszeit</legend>${TIME_BUCKETS.map(bucket => `<label class="check-row"><input type="checkbox" name="time" value="${bucket}" ${rule.timeBuckets.includes(bucket) ? 'checked' : ''}> ${timeBucketLabel(bucket, { capitalize: true })}</label>`).join('')}</fieldset>` : ''}
      ${contexts.includes('interval') ? `<fieldset><legend>Nach erfolgreicher Nutzung wieder zeigen</legend><div class="form-grid two">
        <label>Zeitraum<input name="intervalValue" type="number" min="1" max="1000" step="1" inputmode="numeric" value="${escapeHtml(rule.interval?.value ?? '')}"></label>
        <label>Einheit<select name="intervalUnit">${INTERVAL_UNITS.map(unit => `<option value="${unit}" ${rule.interval?.unit === unit ? 'selected' : ''}>${intervalUnitLabel(unit, rule.interval?.value)}</option>`).join('')}</select></label>
      </div><details class="interval-early-option"><summary>Weitere Optionen</summary><p class="muted">Der Helfer kann schon um diesen Zeitraum früher erscheinen.</p><div class="form-grid two">
        <label>Schon früher<input name="earlyByValue" type="number" min="0" max="1000" step="1" inputmode="numeric" value="${escapeHtml(rule.earlyBy?.value ?? '')}"></label>
        <label>Einheit<select name="earlyByUnit">${INTERVAL_UNITS.map(unit => `<option value="${unit}" ${rule.earlyBy?.unit === unit ? 'selected' : ''}>${intervalUnitLabel(unit, rule.earlyBy?.value)}</option>`).join('')}</select></label>
      </div></details></fieldset>` : ''}
      ${hasContexts ? '<p class="muted">Eine passende Bedingung reicht.</p>' : ''}
      ${helper.retention ? `<label>Aufbewahrung<select name="trackingWindow">${RETENTION_WINDOWS.map(window => `<option value="${window}" ${rule.trackingWindow === window ? 'selected' : ''}>${({ '7d': '7 Tage', '30d': '30 Tage', '365d': '365 Tage', always: 'Unbegrenzt' })[window]}</option>`).join('')}</select></label><p class="muted">Bei begrenzter Dauer werden ältere Einträge gelöscht – bei einer Verkürzung schon beim Speichern. Einstellungen bleiben erhalten.</p>` : ''}
      ${helper.guidance ? `<label class="toggle-row"><span><strong>Hinweise anzeigen</strong><small>Kurze Erklärungen beim Dokumentieren anzeigen.</small></span><input name="guidance" type="checkbox" ${rule.guidance ? 'checked' : ''}></label>` : ''}
      <button type="submit">Speichern</button>
    </form>`;
  for (const [valueName, unitName] of [['intervalValue', 'intervalUnit'], ['earlyByValue', 'earlyByUnit']]) {
    const valueInput = $('#helperSettingsForm').elements.namedItem(valueName);
    const unitSelect = $('#helperSettingsForm').elements.namedItem(unitName);
    if (!valueInput || !unitSelect) continue;
    const updateLabels = () => {
      const value = Number(valueInput.value);
      for (const option of unitSelect.options) option.textContent = intervalUnitLabel(option.value, value);
    };
    valueInput.addEventListener('input', updateLabels);
  }
  bindSubmit($('#helperSettingsForm'), async form => {
    let nextRule;
    try {
      const { legacyIntervalMinutes, legacyToleranceMinutes, ...storedRule } = rule;
      nextRule = validateRule({
        ...storedRule,
        id,
        favorite: form.has('favorite'),
        visible: form.has('visible'),
        placeIds: form.getAll('place'),
        timeBuckets: form.getAll('time'),
        interval: form.get('intervalValue') ? { value: Number(form.get('intervalValue')), unit: form.get('intervalUnit') } : null,
        earlyBy: form.get('intervalValue') && form.get('earlyByValue') ? { value: Number(form.get('earlyByValue')), unit: form.get('earlyByUnit') } : null,
        ...(helper.retention ? { trackingWindow: form.get('trackingWindow') } : {}),
        ...(helper.guidance ? { guidance: form.has('guidance') } : {})
      });
    } catch {
      toast('Bitte Intervall und frühere Anzeige prüfen. Werte müssen ganze Zahlen sein; die frühere Anzeige muss kleiner als das Intervall sein.');
      return;
    }
    await put('helperRules', nextRule);
    toast('Einstellungen gespeichert.');
    if (dashboardVisible()) refreshNow();
  });
}

function tile(helper, reason, launchPlace) {
  const placeData = launchPlace ? ` data-place-id="${escapeHtml(launchPlace.id)}" data-place-name="${escapeHtml(launchPlace.name)}"` : '';
  return `<button class="helper-tile" type="button" data-helper="${escapeHtml(helper.id)}"${placeData}><strong>${escapeHtml(helper.label)}</strong>${reason ? `<span class="tile-reason">${escapeHtml(reason)}</span>` : ''}</button>`;
}

async function dashboardCandidates(visible, position = null, date = new Date()) {
  const [places, entries, people] = await Promise.all([list('places'), list('entries', { prune: false }), list('people')]);
  const hasPlaceRules = visible.some(({ rule }) => rule.placeIds.some(id => places.some(place => place.id === id)))
    || entries.some(entry => isNote(entry) && noteContext(entry).placeIds.some(id => places.some(place => place.id === id)));
  const activePlaces = matchingPlaces(position, places);
  const bucket = timeBucket(date);
  const items = [];
  let nextIntervalAt = null;
  for (const { helper, rule } of visible) {
    const usedAt = await lastUsed(helper.id);
    const state = evaluateHelperContext(rule, activePlaces, usedAt, date);
    if (state.nextIntervalAt !== null && (nextIntervalAt === null || state.nextIntervalAt < nextIntervalAt)) nextIntervalAt = state.nextIntervalAt;
    if (state.match) items.push({ helper, usedAt, ...state.match });
  }
  items.push(...relevantNotes(entries, activePlaces, bucket).map(item => ({ ...item, person: people.find(person => person.id === item.note.personId) })));
  const hasTimeRules = visible.some(({ rule }) => rule.timeBuckets.length)
    || entries.some(entry => isNote(entry) && noteContext(entry).timeBuckets.length);
  const nextRefreshAt = Math.min(nextIntervalAt ?? Infinity, hasTimeRules ? nextTimeBoundary(date) : Infinity);
  return {
    hasPlaceRules,
    nextRefreshAt: Number.isFinite(nextRefreshAt) ? nextRefreshAt : null,
    items: items.sort((a, b) => b.rank - a.rank || (b.note?.createdAt ?? b.usedAt) - (a.note?.createdAt ?? a.usedAt) || (a.note?.id || a.helper.id).localeCompare(b.note?.id || b.helper.id))
  };
}

function noteTile(note, reason, person) {
  const label = noteLabel(note);
  return `<button class="note-tile" type="button" data-note="${escapeHtml(note.id)}"><span class="note-tile-heading"><span class="note-eyebrow">${label}</span>${note.type === 'person-note' ? `<span class="note-person-name">${escapeHtml(person?.name || 'Person nicht mehr gespeichert')}</span>` : ''}</span><strong class="${noteTextClass(note.text)}">${escapeHtml(note.text)}</strong><span class="note-tile-context">${escapeHtml(reason)}</span></button>`;
}

const MAX_TIMEOUT_DELAY = 2147483647;

function scheduleContextRefresh(nextAt) {
  clearTimeout(contextTimer);
  contextTimer = null;
  if (!dashboardVisible() || nextAt === null) return;
  const delay = Math.min(MAX_TIMEOUT_DELAY, Math.max(1, nextAt - Date.now()));
  contextTimer = setTimeout(() => {
    contextTimer = null;
    if (dashboardVisible()) renderDashboard({ contextOnly: true }).catch(reportError);
  }, delay);
}

function updateDashboardPosition(position) {
  if (!dashboardVisible()) return;
  dashboardPosition = position;
  renderDashboard({ position, contextOnly: true }).catch(reportError);
}

async function renderDashboard({ position = dashboardPosition, contextOnly = false } = {}) {
  const version = ++dashboardVersion;
  const visible = await visibleHelpers();
  if (version !== dashboardVersion) return;
  const favorites = visible.filter(({ rule }) => rule.favorite).map(({ helper }) => helper).sort((a, b) => a.label.localeCompare(b.label, 'de'));
  const { items: candidates, hasPlaceRules, nextRefreshAt } = await dashboardCandidates(visible, position);
  if (version !== dashboardVersion) return;

  const rows = $('#nowRows');
  const html = candidates.map(({ helper, note, reason, why, person, launchPlace }) => note ? noteTile(note, reason, person) : tile(helper, why || reason, launchPlace)).join('');
  if (rows.innerHTML !== html) {
    const focused = rows.contains(document.activeElement) ? returnFocusTarget() : null;
    rows.innerHTML = html;
    if (focused) restoreFocus(focused);
  }
  scheduleContextRefresh(nextRefreshAt);
  if (!hasPlaceRules || !dashboardVisible()) {
    stopLocationWatch?.();
    stopLocationWatch = null;
    dashboardPosition = null;
    locationRequested = false;
  }
  else if (!stopLocationWatch) {
    stopLocationWatch = watchPosition(updateDashboardPosition);
  }
  if (hasPlaceRules && dashboardVisible() && !locationRequested) {
    locationRequested = true;
    getPosition({ maximumAge: 0 }).then(updateDashboardPosition).catch(() => {});
  }
  if (contextOnly) return;
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

function radiusOptions(radius = 250) {
  const options = PLACE_RADII.includes(radius) ? PLACE_RADII : [...PLACE_RADII, radius];
  return options.map(value => `<option value="${escapeHtml(value)}" ${value === radius ? 'selected' : ''}>${escapeHtml(radiusLabel(value))}</option>`).join('');
}

function categoryOptions(category) {
  return '<option value="">Ohne Kategorie</option>' + PLACE_CATEGORIES.map(value => `<option ${value === category ? 'selected' : ''}>${value}</option>`).join('');
}

async function renderSettings() {
  syncThemeChoice();
  const version = viewVersion;
  const rules = await list('helperRules');
  if (version !== viewVersion) return;
  $('#rulesList').innerHTML = rules.length ? rules.map(rule => {
    const interval = rule.interval || (rule.intervalMinutes ? fromLegacyMinutes(rule.intervalMinutes) : null);
    return `<div class="list-item"><span><strong>${escapeHtml(helperById(rule.id)?.label || rule.id)}</strong><small>${escapeHtml([rule.favorite ? 'Favorit' : '', rule.placeIds?.length ? `${rule.placeIds.length} ${rule.placeIds.length === 1 ? 'Ort' : 'Orte'}` : '', rule.timeBuckets?.length ? rule.timeBuckets.map(timeBucketLabel).join(', ') : '', interval ? `Nach Nutzung: ${intervalLabel(interval)}` : ''].filter(Boolean).join(' · ') || 'Keine Verknüpfung')}</small></span></div>`;
  }).join('') : '<p class="muted">Noch keine Verknüpfungen.</p>';

  const places = await list('places');
  if (version !== viewVersion) return;
  $('#placesList').innerHTML = places.length ? groupPlaces(places).map(group => `<section><h3>${escapeHtml(group.label)}</h3>${group.places.map(place => `<form class="stack place-settings" data-place-form="${escapeHtml(place.id)}"><strong>${escapeHtml(place.name)}</strong><div class="form-grid two"><label>Radius<select name="radius" aria-label="Radius für ${escapeHtml(place.name)}">${radiusOptions(place.radius)}</select></label><label>Kategorie<select name="category" aria-label="Kategorie für ${escapeHtml(place.name)}">${categoryOptions(place.category)}</select></label></div><div class="actions"><button type="submit" class="secondary">Änderungen speichern</button><button class="quiet danger-text" type="button" data-remove-place="${escapeHtml(place.id)}">Entfernen</button></div><p role="status" class="muted"></p></form>`).join('')}</section>`).join('') : '<p class="muted">Noch kein Ort gespeichert.</p>';
  for (const form of $$('#placesList form')) bindSubmit(form, async data => {
    const place = await get('places', form.dataset.placeForm);
    if (!place) throw new Error('Ort nicht mehr gespeichert.');
    const next = { ...place, radius: Number(data.get('radius')) };
    if (data.get('category')) next.category = data.get('category'); else delete next.category;
    await put('places', next);
    if (version !== viewVersion) return;
    await renderSettings();
    if (version !== viewVersion) return;
    const savedForm = $$('#placesList form').find(item => item.dataset.placeForm === place.id);
    if (!savedForm) return;
    savedForm.querySelector('[role="status"]').textContent = 'Ort gespeichert.';
    savedForm.querySelector('button').focus();
  });

  const visibilityHtml = helpers.length ? (await Promise.all(helpers.map(async helper => {
    const rule = await getRule(helper);
    return `<label class="toggle-row"><span><strong>${escapeHtml(helper.label)}</strong><small>${escapeHtml(helper.category)}</small></span><input type="checkbox" data-helper-visible="${escapeHtml(helper.id)}" ${rule.visible ? 'checked' : ''}></label>`;
  }))).join('') : '<p class="muted">Keine Helfer verfügbar.</p>';
  if (version === viewVersion) $('#helperVisibilityList').innerHTML = visibilityHtml;
}

async function openCoreView(name, options = {}) {
  const open = () => openCoreView(name, { replace: true });
  if (name === 'notes' || name === 'people') {
    showView('read', name === 'notes' ? 'Notizen' : 'Personen', open, options, name);
    const version = viewVersion;
    const root = $('#readHost');
    root.classList.remove('read-person');
    root.classList.toggle('read-notes', name === 'notes');
    delete root.dataset.personId;
    root.replaceChildren();
    root.setAttribute('aria-busy', 'true');
    try {
      // Reading core content must not trigger helper retention writes.
      const [records, places] = await Promise.all([
        list(name === 'notes' ? 'entries' : 'people', { prune: false }),
        name === 'notes' ? list('places') : Promise.resolve([])
      ]);
      if (version !== viewVersion) return;
      if (name === 'notes') renderNotes(root, records, places);
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

async function requireNote(id) {
  const note = await get('entries', id);
  if (!isNote(note)) throw new Error('Notiz nicht mehr vorhanden.');
  return note;
}

async function openNoteScreen(id, title, open, options, render) {
  showView('note', title, open, options);
  const version = viewVersion;
  const root = $('#noteHost');
  root.replaceChildren();
  root.setAttribute('aria-busy', 'true');
  const current = () => version === viewVersion;
  try {
    const [note, places] = await Promise.all([get('entries', id), list('places')]);
    if (!current()) return;
    if (!isNote(note)) { toast('Notiz nicht mehr vorhanden.'); await goBack(); return; }
    const person = note.type === 'person-note' && note.personId ? await get('people', note.personId) : null;
    if (!current()) return;
    const resolvedTitle = title.replace('Notiz', noteLabel(note));
    if (resolvedTitle !== title) {
      navigation.enter({ title: resolvedTitle, open }, { replace: true });
      $('#focusTitle').textContent = resolvedTitle;
    }
    render(root, note, places, current, person);
    if ($('#quickComposer').hidden) $('#focusTitle').focus({ preventScroll: true });
  } catch (error) {
    if (current()) reportError(error, 'Notiz konnte nicht geladen werden. Bitte erneut versuchen.');
  } finally {
    if (current()) root.removeAttribute('aria-busy');
  }
}

function refreshNow() {
  renderDashboard().catch(error => reportError(error, 'Die Ansicht konnte nicht aktualisiert werden. Bitte neu laden.'));
}

async function refreshNoteList() {
  if ($('#view-read').hidden) return;
  const root = $('#readHost');
  const personId = root.dataset.personId;
  if (!root.classList.contains('read-notes') && !personId) return;
  const version = viewVersion;
  const [entries, places, person] = await Promise.all([list('entries', { prune: false }), list('places'), personId ? get('people', personId) : Promise.resolve(null)]);
  if (version !== viewVersion) return;
  root.replaceChildren();
  if (person) renderPerson(root, person, entries, places);
  else if (!personId) renderNotes(root, entries, places);
}

async function openNote(id, options = {}) {
  await openNoteScreen(id, 'Notiz', () => openNote(id, { replace: true }), options, (root, note, places, current, person) => {
    renderNote(root, note, places, {
      edit: guarded(() => openNoteEdit(id)),
      context: guarded(() => openNoteContext(id)),
      remove: () => confirmNoteDelete(id, noteLabel(note))
    }, person);
  });
}

async function openNoteEdit(id, options = {}) {
  await openNoteScreen(id, 'Notiz bearbeiten', () => openNoteEdit(id, { replace: true }), options, (root, note, places, current) => {
    const form = renderNoteEdit(root, note, guarded(goBack));
    bindSubmit(form, async data => {
      const text = data.get('text');
      if (!text.trim()) { toast('Bitte einen Notiztext eingeben.'); $('#noteEditText')?.focus(); return; }
      const original = await requireNote(id);
      if (!current()) return;
      const next = editNote(original, text);
      if (next.text !== original.text) await put('entries', next);
      if (current()) { toast(`${noteLabel(next)} gespeichert.`); await goBack(); refreshNow(); }
    });
    // The screen loader focuses the title; a microtask puts editing directly in the field.
    queueMicrotask(() => { if (current() && $('#quickComposer').hidden) $('#noteEditText').focus(); });
  });
}

async function saveNoteContext(id, changes, current) {
  const original = await requireNote(id);
  if (!current()) return;
  await put('entries', changeNoteContext(original, changes));
  refreshNow();
  refreshNoteList().catch(error => reportError(error, 'Verknüpfung gespeichert. Die Ansicht konnte nicht aktualisiert werden.'));
}

function contextActions(root, note, current, actions, capture = false) {
  renderNoteContext(root, note, actions.places, {
    choose: guarded(actions.choose),
    done: guarded(actions.done),
    remove: async link => {
      if (root.getAttribute('aria-busy') === 'true') return;
      root.setAttribute('aria-busy', 'true');
      const buttons = [...root.querySelectorAll('button')];
      buttons.forEach(button => { button.disabled = true; });
      try {
        const original = await requireNote(note.id);
        await saveNoteContext(note.id, { [link.kind]: noteContext(original)[link.kind].filter(id => id !== link.id) }, current);
        if (current()) {
          if (capture) clearToast(); else toast('Verknüpfung entfernt.');
          await actions.refresh();
        }
      } catch {
        if (current()) contextError(root, capture ? 'Notiz gespeichert. Verknüpfung konnte nicht gespeichert werden.' : 'Verknüpfung konnte nicht gespeichert werden. Bitte erneut versuchen.');
      } finally {
        if (current()) root.removeAttribute('aria-busy');
        buttons.forEach(button => { button.disabled = false; });
      }
    }
  }, { capture });
}

async function openNoteContext(id, kind = null, options = {}) {
  const title = kind ? (kind === 'placeIds' ? 'Ort' : 'Tageszeit') : 'Wann soll diese Notiz wieder auftauchen?';
  await openNoteScreen(id, title, () => openNoteContext(id, kind, { replace: true }), options, (root, note, places, current) => {
    if (!kind) {
      contextActions(root, note, current, {
        places, choose: kind => openNoteContext(id, kind), done: goBack,
        refresh: () => openNoteContext(id, null, { replace: true })
      });
    } else {
      const form = renderNoteContextPicker(root, note, places, kind, guarded(goBack));
      bindSubmit(form, async data => {
        try { await saveNoteContext(id, { [kind]: data.getAll('context') }, current); }
        catch { if (current()) contextError(root, 'Verknüpfung konnte nicht gespeichert werden. Bitte erneut versuchen.'); return; }
        if (current()) { toast('Verknüpfung gespeichert.'); await goBack(); }
      });
    }
  });
}

function confirmNoteDelete(id, label = 'Notiz') {
  const dialog = $('#noteDeleteDialog');
  const version = viewVersion;
  const returnFocus = document.activeElement;
  const form = $('#noteDeleteForm');
  const cancel = $('#noteDeleteCancel');
  const confirm = $('#noteDeleteConfirm');
  $('#noteDeleteTitle').textContent = `${label} löschen?`;
  $('#noteDeleteDescription').textContent = `Diese ${label} wird dauerhaft von diesem Gerät gelöscht.`;
  $('#noteDeleteError').textContent = '';
  cancel.disabled = confirm.disabled = false;
  form.removeAttribute('aria-busy');
  cancel.onclick = () => dialog.close();
  dialog.onclose = () => { if (version === viewVersion && returnFocus?.isConnected) returnFocus.focus(); };
  form.onsubmit = async event => {
    event.preventDefault();
    if (form.getAttribute('aria-busy') === 'true') return;
    form.setAttribute('aria-busy', 'true');
    cancel.disabled = confirm.disabled = true;
    try {
      await remove('entries', id);
    } catch {
      $('#noteDeleteError').textContent = `${label} konnte nicht gelöscht werden. Bitte erneut versuchen.`;
      return;
    } finally {
      form.removeAttribute('aria-busy');
      cancel.disabled = confirm.disabled = false;
    }
    dialog.close();
    if (version === viewVersion) {
      guarded(async () => { await goBack(); if ($('#view-dashboard').hidden) refreshNow(); })();
    }
  };
  dialog.showModal();
  cancel.focus();
}

function noteFollowup(note, composerCurrent) {
  const body = $('#quickComposerBody');
  let step = 0;
  async function show(kind = null, focus = null) {
    const version = ++step;
    const current = () => composerCurrent() && version === step;
    body.replaceChildren();
    $('#quickComposerTitle').textContent = 'Gespeichert';
    // Saving is already complete: Done remains available even if context reads fail.
    const actions = {
      places: [], choose: kind => show(kind), done: closeComposer,
      refresh: () => show(null, '#quickNoteChoosePlace')
    };
    if (!kind) {
      contextActions(body, note, current, actions, true);
      body.querySelector('#noteFollowupTitle').focus();
    }
    body.setAttribute('aria-busy', 'true');
    try {
      const [saved, places] = await Promise.all([requireNote(note.id), list('places')]);
      if (!current()) return;
      note = saved;
      body.replaceChildren();
      if (!kind) contextActions(body, note, current, { ...actions, places }, true);
      else {
        const form = renderNoteContextPicker(body, note, places, kind, guarded(() => show(null, kind === 'placeIds' ? '#quickNoteChoosePlace' : '#quickNoteChooseTime')), { capture: true });
        bindSubmit(form, async data => {
          try { await saveNoteContext(note.id, { [kind]: data.getAll('context') }, current); }
          catch { if (current()) contextError(body, 'Notiz gespeichert. Verknüpfung konnte nicht gespeichert werden.'); return; }
          if (current()) { clearToast(); await show(null, kind === 'placeIds' ? '#quickNoteChoosePlace' : '#quickNoteChooseTime'); }
        });
      }
      (focus && body.querySelector(focus) || body.querySelector(kind ? 'input, #quickNoteContextCancel' : '#noteFollowupTitle')).focus();
    } catch {
      if (current()) {
        if (kind) contextActions(body, note, current, actions, true);
        contextError(body, 'Notiz gespeichert. Verknüpfungen konnten nicht geladen werden.');
        body.querySelector('#quickNoteContextDone').focus();
      }
    } finally { if (current()) body.removeAttribute('aria-busy'); }
  }
  show().catch(reportError);
}

async function openPerson(id, name, options = {}) {
  showView('read', name, () => openPerson(id, name, { replace: true }), options);
  const version = viewVersion;
  const root = $('#readHost');
  root.classList.add('read-person');
  root.classList.remove('read-notes');
  root.dataset.personId = id;
  root.replaceChildren();
  root.setAttribute('aria-busy', 'true');
  try {
    const [person, entries, places] = await Promise.all([get('people', id), list('entries', { prune: false }), list('places')]);
    if (version !== viewVersion) return;
    if (!person) { await goBack(); return; }
    $('#focusTitle').textContent = person.name;
    renderPerson(root, person, entries, places);
  } catch (error) {
    if (version === viewVersion) reportError(error, 'Inhalte konnten nicht geladen werden. Bitte erneut versuchen.');
  } finally {
    if (version === viewVersion) root.removeAttribute('aria-busy');
  }
}

const staticViews = {
  privacy: {
    title: 'Datenschutz',
    html: `<p>Erfasste Inhalte werden lokal in diesem Browser gespeichert und von der App nicht an einen Server übertragen. Es gibt kein Benutzerkonto und keine Nutzungsanalyse.</p><p>Nach Browserfreigabe wird der Standort auf der Startseite mit Ortsverknüpfungen und beim Öffnen von „Diesen Ort merken“ abgefragt. Bei sichtbarer Startseite mit Ortsverknüpfungen aktualisiert die App die erkannten Orte bei Standortänderungen. Beim Verlassen der Startseite oder Wechsel in den Hintergrund endet diese Beobachtung. Beim Parkplatz merken wird der Standort nur nach deiner Aktion abgefragt und lokal gespeichert.</p><p>${LOCATION_EXPLANATION}</p><p><strong>Vor Veröffentlichung:</strong> Angaben zu Server-Logs des tatsächlichen Hosters ergänzen.</p>`
  },
  imprint: {
    title: 'Impressum',
    html: `<p><strong>Platzhalter – vor Veröffentlichung ergänzen.</strong></p><p>Name / Anschrift / Kontakt des verantwortlichen Anbieters.</p>`
  },
  appinfo: {
    title: 'App-Info & Open Source',
    html: `<p>0815 ist eine installierbare Web-App unter MIT-Lizenz.</p><p>Entwickelt mit HTML, CSS und JavaScript, ohne externe Laufzeit-Abhängigkeiten.</p><p>Signature verwendet die lokal mitgelieferten Schriften Cormorant Garamond und Great Vibes unter SIL Open Font License 1.1: <a href="./assets/fonts/OFL-CormorantGaramond.txt">Lizenz Cormorant Garamond</a>, <a href="./assets/fonts/OFL-GreatVibes.txt">Lizenz Great Vibes</a>.</p>`
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
  $$('[aria-controls="quickComposer"]').forEach(button => button.setAttribute('aria-expanded', 'false'));
  $('#quickComposerBody').replaceChildren();
  $('#quickComposerBody').removeAttribute('aria-busy');
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
  trigger?.setAttribute('aria-expanded', 'true');

  if (type === 'note') {
    title.textContent = 'Notiz';
    body.innerHTML = `<form id="noteForm" class="composer-form"><label class="visually-hidden" for="noteText">Notiz</label><textarea id="noteText" name="text" rows="2" placeholder="Notiz" required></textarea><button type="submit">Speichern</button></form>`;
    bindSubmit($('#noteForm'), async form => {
      const text = form.get('text').trim();
      if (!text) return;
      const note = { id: makeId('note'), type: 'note', text, createdAt: Date.now() };
      await put('entries', note);
      if (current()) { clearToast(); noteFollowup(note, current); }
      else toast('Notiz gespeichert.');
      refreshNow();
      refreshNoteList().catch(error => reportError(error, 'Notiz gespeichert. Die Ansicht konnte nicht aktualisiert werden.'));
    });
    $('#noteText').focus();
  }

  if (type === 'place') {
    title.textContent = 'Diesen Ort merken';
    body.innerHTML = `<form id="placeForm" class="composer-form"><label>Name<input name="name" placeholder="z. B. Einkaufszentrum" required></label><label>Kategorie<select name="category">${categoryOptions()}</select></label><label>Radius<select name="radius" aria-describedby="placeRadiusHelp">${radiusOptions()}</select></label><p id="placeRadiusHelp" class="muted">${RADIUS_EXPLANATION}</p><button type="submit">Ort speichern</button><p id="placeStatus" class="muted" aria-live="polite"></p></form>`;
    let position;
    const form = $('#placeForm');
    const status = $('#placeStatus');
    const saveButton = form.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    bindSubmit(form, async data => {
      if (!position || !current()) { toast('Standort noch nicht verfügbar.'); return; }
      const name = data.get('name').trim();
      if (!name) return;
      await put('places', { id: makeId('place'), name, lat: position.lat, lon: position.lon, radius: Number(data.get('radius')), ...(data.get('category') ? { category: data.get('category') } : {}), createdAt: Date.now() });
      if (current()) closeComposer();
      toast('Ort gespeichert.');
      if (!$('#view-settings').hidden) await renderSettings();
    });
    form.querySelector('input[name="name"]').focus();
    status.textContent = 'Standort wird abgefragt …';
    try {
      position = await getPosition({ maximumAge: 0 });
      if (!current()) return;
      status.textContent = `Standort bereit. Gemeldete Genauigkeit: etwa ${Math.round(position.accuracy)} Meter.`;
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
    let savedPerson = null;
    const currentPersonId = !$('#view-read').hidden && $('#readHost').dataset.personId;
    if (people.some(person => person.id === currentPersonId)) select.value = currentPersonId;
    const updateNewField = () => { $('#newPersonField').hidden = select.value !== 'new'; };
    select.addEventListener('change', updateNewField); updateNewField();
    bindSubmit($('#personForm'), async form => {
      const text = form.get('text').trim();
      if (!text) return;
      let personId = form.get('personId');
      if (personId === 'new') {
        const name = form.get('newName').trim();
        if (!name) { toast('Bitte einen Namen angeben.'); return; }
        if (savedPerson?.name === name) personId = savedPerson.id;
        else {
          const person = { id: makeId('person'), name, createdAt: Date.now() };
          await put('people', person);
          savedPerson = person;
          personId = person.id;
        }
      }
      const note = { id: makeId('person-note'), type: 'person-note', personId, kind: form.get('kind'), text, createdAt: Date.now() };
      await put('entries', note);
      if (current()) { clearToast(); noteFollowup(note, current); }
      else toast(note.kind === 'gift' ? 'Geschenkidee gespeichert.' : 'Notiz zur Person gespeichert.');
      refreshNow();
      refreshNoteList().catch(error => reportError(error, 'Notiz gespeichert. Die Ansicht konnte nicht aktualisiert werden.'));
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
  $('#locationExplanation').textContent = LOCATION_EXPLANATION;
  $('#radiusExplanation').textContent = RADIUS_EXPLANATION;
  document.addEventListener('visibilitychange', () => {
    pauseDashboardContext();
    if (dashboardVisible()) refreshNow();
    else $('#nowRows').replaceChildren();
  });
  window.addEventListener('pagehide', pauseDashboardContext);
  window.addEventListener('pageshow', event => { if (event.persisted && dashboardVisible()) refreshNow(); });
  $('#themeChoice').addEventListener('change', async event => {
    const value = event.target.value;
    const choices = $('#themeChoice');
    choices.disabled = true;
    choices.setAttribute('aria-busy', 'true');
    $('#themeStatus').textContent = '';
    try { await saveTheme(value); }
    catch { $('#themeStatus').textContent = 'Design konnte nicht gespeichert werden. Bitte erneut versuchen.'; }
    finally {
      syncThemeChoice();
      choices.disabled = false;
      choices.removeAttribute('aria-busy');
    }
  });
  $('#brandButton').addEventListener('click', guarded(goHome));
  $('#backButton').addEventListener('click', guarded(goBack));
  $('#menuButton').addEventListener('click', openMenu);
  $('#helperSettingsButton').addEventListener('click', guarded(() => { if (activeHelper) return openHelperSettings(activeHelper.id); }));
  $('#quickComposerClose').addEventListener('click', closeComposer);

  document.addEventListener('submit', event => { if (event.target.matches('form')) event.preventDefault(); }, true);
  document.addEventListener('click', guarded(async event => {
    const helperButton = event.target.closest('[data-helper]');
    if (helperButton) {
      const placeId = helperButton.dataset.placeId;
      const placeName = helperButton.dataset.placeName;
      const options = placeId && placeName ? { launchContext: { place: { id: placeId, name: placeName } } } : {};
      await openHelper(helperButton.dataset.helper, options);
      return;
    }
    const noteButton = event.target.closest('[data-note]');
    if (noteButton) { await openNote(noteButton.dataset.note); return; }
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
      await initializeTheme();
      syncThemeChoice();
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
    await clearAll();
    await initializeTheme();
    syncThemeChoice();
    toast('Lokale Daten gelöscht.'); await goHome();
  }));

  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('#installButton').hidden = false; });
  window.addEventListener('appinstalled', () => { installPrompt = null; $('#installButton').hidden = true; });
  $('#installButton').addEventListener('click', guarded(async () => { if (!installPrompt) return; await installPrompt.prompt(); installPrompt = null; $('#installButton').hidden = true; }));
  if (window.matchMedia('(display-mode: standalone)').matches) $('#installButton').hidden = true;
}

async function init() {
  const themeError = await initializeTheme();
  bindEvents();
  syncThemeChoice();
  if (themeError) reportError(themeError, 'Design konnte nicht lokal gespeichert werden. Bitte erneut versuchen.');
  let ready = false;
  const resumeUpdate = startPwaUpdates({
    canReload: () => ready && !$('#view-dashboard').hidden && $('#quickComposer').hidden && $('#menuPanel').hidden
      && !document.querySelector('dialog[open], [aria-busy="true"]'),
    onDeferred: () => toast('Neue Version bereit. Sie wird auf der Startseite geladen. Deine Eingabe bleibt offen.'),
    onRegistrationError: () => toast('Offline-Nutzung konnte nicht eingerichtet werden.')
  });
  await pruneEntries();
  await renderDashboard();
  await initStorageStatus();
  ready = true;
  resumeUpdate?.();
}

init().catch(reportError);

function syncThemeChoice() {
  for (const input of $$('#themeChoice input')) input.checked = input.value === document.documentElement.dataset.theme;
}
