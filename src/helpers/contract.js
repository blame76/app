import { CONTEXT_TYPES, validateRule } from '../schema.js';
import { RETENTION_WINDOWS } from '../retention.js';
import { fromLegacyMinutes } from '../intervals.js';

export function validateHelper(helper) {
  for (const key of ['id', 'label', 'category']) {
    if (typeof helper?.[key] !== 'string' || !helper[key].trim()) throw new Error(`Helfer benötigt "${key}".`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(helper.id)) throw new Error('Helfer-ID muss ein einfacher, eindeutiger Slug sein.');
  if (typeof helper.mount !== 'function') throw new Error(`Helfer "${helper.id}": mount muss eine Funktion sein.`);
  if (helper.defaultVisible !== undefined && typeof helper.defaultVisible !== 'boolean') throw new Error('defaultVisible muss boolean sein.');
  if (helper.guidance !== undefined && helper.guidance !== true) throw new Error('guidance muss true sein, wenn Hinweise unterstützt werden.');
  if (helper.contexts !== undefined && (!Array.isArray(helper.contexts) || helper.contexts.some(type => !CONTEXT_TYPES.includes(type)) || new Set(helper.contexts).size !== helper.contexts.length)) throw new Error('Ungültige Kontextarten.');
  if (helper.defaults !== undefined && (!helper.defaults || typeof helper.defaults !== 'object' || Array.isArray(helper.defaults) || Object.keys(helper.defaults).some(key => !['timeBuckets', 'interval', 'earlyBy', 'intervalMinutes', 'toleranceMinutes'].includes(key)))) throw new Error('Ungültige Helfer-Defaults.');
  if (helper.offlineAssets !== undefined && (!Array.isArray(helper.offlineAssets) || helper.offlineAssets.some(path => typeof path !== 'string' || !path.startsWith('./') || path.includes('?') || path.includes('#') || path.split('/').includes('..')))) throw new Error('Offline-Assets müssen lokale relative Pfade sein.');
  if (helper.validateEntry !== undefined && typeof helper.validateEntry !== 'function') throw new Error('validateEntry muss eine Funktion sein.');
  if (helper.nowCard !== undefined && typeof helper.nowCard !== 'function') throw new Error('nowCard muss eine Funktion sein.');
  if (helper.retention !== undefined && (!helper.retention || typeof helper.retention !== 'object' || Array.isArray(helper.retention) || !RETENTION_WINDOWS.includes(helper.retention.defaultWindow) || Object.keys(helper.retention).some(key => key !== 'defaultWindow'))) throw new Error('Ungültige Aufbewahrungsregel.');
  helperDefaults(helper);
  return helper;
}

// Data only: helpers never supply markup, navigation or recommendation scores.
export function validateNowCard(card) {
  const fields = ['active', 'primary', 'secondary', 'badge', 'tone', 'density', 'nextChangeAt'];
  if (!card || typeof card !== 'object' || Array.isArray(card)
    || Object.keys(card).some(key => !fields.includes(key)) || typeof card.active !== 'boolean') {
    throw new Error('Ungültige Now-Karte.');
  }
  for (const key of ['primary', 'secondary']) {
    if (card[key] !== undefined && (typeof card[key] !== 'string' || !card[key].trim())) throw new Error(`Ungültiges Now-Feld: ${key}.`);
  }
  if (card.tone !== undefined && !['normal', 'attention'].includes(card.tone)) throw new Error('Ungültiger Now-Ton.');
  if (card.density !== undefined && !['compact', 'standard'].includes(card.density)) throw new Error('Ungültige Now-Dichte.');
  if (card.badge !== undefined && (!card.badge || typeof card.badge !== 'object' || Array.isArray(card.badge)
    || Object.keys(card.badge).some(key => !['value', 'label'].includes(key))
    || ['value', 'label'].some(key => typeof card.badge[key] !== 'string' || !card.badge[key].trim()))) throw new Error('Ungültiges Now-Badge.');
  if (card.nextChangeAt !== undefined && (!Number.isFinite(card.nextChangeAt) || card.nextChangeAt < 0
    || card.nextChangeAt > 8640000000000000)) throw new Error('Ungültiger Now-Zeitpunkt.');
  return card;
}

function freezeSnapshot(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeSnapshot);
    Object.freeze(value);
  }
  return value;
}

export function projectNowCard(helper, entries, snapshot) {
  if (!helper.nowCard) return { active: false };
  const input = freezeSnapshot(structuredClone({ ...snapshot, entries: entries.filter(entry => entry.helperId === helper.id) }));
  return validateNowCard(helper.nowCard(input));
}

export function validateRegistry(registry) {
  if (!Array.isArray(registry)) throw new Error('Registry muss eine Liste sein.');
  const ids = new Set();
  for (const helper of registry) {
    validateHelper(helper);
    if (ids.has(helper.id)) throw new Error(`Doppelte Helfer-ID: ${helper.id}`);
    ids.add(helper.id);
  }
  return registry;
}

export function helperDefaults(helper) {
  const defaults = helper.defaults || {};
  const contexts = helper.contexts || [];
  const interval = defaults.interval ?? fromLegacyMinutes(defaults.intervalMinutes ?? null);
  const earlyBy = defaults.earlyBy ?? fromLegacyMinutes(defaults.toleranceMinutes ?? null, { allowZero: true });
  const hasStructuredDefaults = Object.hasOwn(defaults, 'interval') || Object.hasOwn(defaults, 'earlyBy');
  if ((!contexts.includes('time') && defaults.timeBuckets?.length)
    || (!contexts.includes('interval') && (interval != null || earlyBy != null || defaults.intervalMinutes != null || defaults.toleranceMinutes != null))
    || (hasStructuredDefaults && (Object.hasOwn(defaults, 'intervalMinutes') || Object.hasOwn(defaults, 'toleranceMinutes')))
    || (earlyBy != null && interval == null)) throw new Error('Defaults benötigen die passende Kontextart.');
  return validateRule({
    ...(helper.guidance ? { guidance: true } : {}),
    ...(helper.retention ? { trackingWindow: helper.retention.defaultWindow } : {}),
    id: helper.id,
    favorite: false,
    visible: helper.defaultVisible !== false,
    placeIds: [],
    timeBuckets: defaults.timeBuckets ? [...defaults.timeBuckets] : [],
    interval,
    earlyBy
  });
}
