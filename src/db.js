import { STORES, validateImport, validateRecord } from './schema.js';
import { HELPERS } from './helpers/registry.js';
import { expiredEntryIds, retentionWindow } from './retention.js';

const DB_NAME = '0815-local';
const DB_VERSION = 2;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let blocked = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Datenbank-Update blockiert. Bitte andere Tabs dieser App schließen.'));
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      if (blocked) db.close();
      else resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

// Queue all operations synchronously so they share one transaction/commit.
async function transaction(stores, mode, enqueue) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let result;
      let failure;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => { failure = tx.error; };
      tx.onabort = () => reject(failure || tx.error || new Error('Speichervorgang abgebrochen.'));
      try { result = enqueue(tx); }
      catch (error) { failure = error; tx.abort(); }
    });
  } finally { db.close(); }
}

export async function list(storeName, { prune = true } = {}) {
  if (storeName === 'entries' && prune) await pruneEntries();
  let result;
  await transaction(storeName, 'readonly', tx => {
    tx.objectStore(storeName).getAll().onsuccess = event => { result = event.target.result; };
  });
  return result;
}

export async function get(storeName, id) {
  let value;
  await transaction(storeName, 'readonly', tx => {
    tx.objectStore(storeName).get(id).onsuccess = event => { value = event.target.result; };
  });
  return value;
}

function validateHelperRecord(storeName, value) {
  const helper = HELPERS.find(item => item.id === (storeName === 'entries' ? value.helperId : value.id));
  if (storeName === 'entries') helper?.validateEntry?.(value);
  if (storeName === 'helperRules' && helper) retentionWindow(helper, value);
}

export function put(storeName, value) {
  validateRecord(storeName, value);
  validateHelperRecord(storeName, value);
  if (storeName === 'helperRules') {
    // Changing retention and deleting expired data commit together.
    return transaction(['helperRules', 'entries'], 'readwrite', tx => {
      tx.objectStore('helperRules').put(value);
      const helper = HELPERS.find(item => item.id === value.id);
      if (!helper?.retention) return;
      tx.objectStore('entries').getAll().onsuccess = event => {
        const ids = expiredEntryIds(event.target.result, [value], [helper]);
        for (const id of ids) tx.objectStore('entries').delete(id);
      };
    });
  }
  if (storeName === 'entries' && value.personId) {
    return transaction(['people', 'entries'], 'readwrite', tx => {
      tx.objectStore('people').get(value.personId).onsuccess = event => {
        if (!event.target.result) { tx.abort(); return; }
        try { tx.objectStore('entries').put(value); } catch { tx.abort(); }
      };
    });
  }
  return transaction(storeName, 'readwrite', tx => { tx.objectStore(storeName).put(value); });
}

// Explicit interval opt-out must not run retention or touch any entry.
export function disableHelperInterval(id) {
  if (!HELPERS.find(helper => helper.id === id)?.contexts?.includes('interval')) throw new Error('Nicht unterstützte Kontextart.');
  return transaction('helperRules', 'readwrite', tx => {
    const rules = tx.objectStore('helperRules');
    rules.get(id).onsuccess = event => {
      try {
        const { intervalMinutes, toleranceMinutes, ...rule } = event.target.result || { id };
        const value = { ...rule, interval: null, earlyBy: null };
        validateRecord('helperRules', value);
        validateHelperRecord('helperRules', value);
        rules.put(value);
      } catch { tx.abort(); }
    };
  });
}

export function pruneEntries(now = Date.now()) {
  return transaction(['entries', 'helperRules'], 'readwrite', tx => {
    let entries;
    let rules;
    function prune() {
      if (!entries || !rules) return;
      try {
        for (const id of expiredEntryIds(entries, rules, HELPERS, now)) tx.objectStore('entries').delete(id);
      } catch { tx.abort(); }
    }
    tx.objectStore('entries').getAll().onsuccess = event => { entries = event.target.result; prune(); };
    tx.objectStore('helperRules').getAll().onsuccess = event => { rules = event.target.result; prune(); };
  });
}

export function remove(storeName, id) {
  return transaction(storeName, 'readwrite', tx => { tx.objectStore(storeName).delete(id); });
}

// All person-linked entries, including future types, share the person's commit.
export function deletePerson(id) {
  return transaction(['people', 'entries'], 'readwrite', tx => {
    tx.objectStore('people').delete(id);
    tx.objectStore('entries').openCursor().onsuccess = event => {
      const cursor = event.target.result;
      if (!cursor) return;
      try {
        if (cursor.value.personId === id) cursor.delete();
        cursor.continue();
      } catch { tx.abort(); }
    };
  });
}

export function clearAll() {
  return transaction(STORES, 'readwrite', tx => {
    for (const name of STORES) tx.objectStore(name).clear();
  });
}

export async function exportAll() {
  await pruneEntries();
  const data = { schemaVersion: 2, exportedAt: new Date().toISOString(), stores: {} };
  await transaction(STORES, 'readonly', tx => {
    for (const name of STORES) {
      tx.objectStore(name).getAll().onsuccess = event => { data.stores[name] = event.target.result; };
    }
  });
  return data;
}

export function importAll(payload) {
  const stores = validateImport(payload); // No database open or write before this succeeds.
  for (const name of ['entries', 'helperRules']) for (const item of stores[name]) validateHelperRecord(name, item);
  const expired = new Set(expiredEntryIds(stores.entries, stores.helperRules, HELPERS));
  stores.entries = stores.entries.filter(entry => !expired.has(entry.id));
  return transaction(STORES, 'readwrite', tx => {
    for (const name of STORES) {
      const store = tx.objectStore(name);
      store.clear();
      for (const item of stores[name]) store.put(item);
    }
  });
}

export function makeId(prefix = 'item') {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}
