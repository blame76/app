import assert from 'node:assert/strict';
import test from 'node:test';
import { HELPERS } from '../src/helpers/registry.js';
import { helperDefaults } from '../src/helpers/contract.js';
import { calculateDiscount, discountResult, validateDiscountEntry, saveCalculation, HISTORY_ID, MAX_PRICE_CENTS } from '../src/helpers/discount/model.js';
import { importAll } from '../src/db.js';
import { STORES } from '../src/schema.js';

const history = calculations => ({ id: HISTORY_ID, helperId: 'discount', entryVersion: 1, createdAt: calculations[0].recordedAt, calculations });

test('Discount is visible and supports only place, without time, interval or retention defaults', () => {
  const helper = HELPERS.find(helper => helper.id === 'discount');
  assert.equal(helper.label, 'Rabatt');
  assert.equal(helper.category, 'Einkaufen');
  assert.deepEqual(helper.contexts, ['place']);
  assert.deepEqual(helperDefaults(helper), { id: 'discount', visible: true, favorite: false, placeIds: [], timeBuckets: [], interval: null, earlyBy: null });
  assert.equal(helper.retention, undefined);
});
test('75 / 30 gives 52.50 and 22.50 savings for comma, point and integer input', () => {
  for (const price of ['75', '75,00', '75.00', ' 75,00 ']) {
    const calculation = calculateDiscount(price, '30', 1000);
    assert.deepEqual(calculation, { priceCents: 7500, discountBasisPoints: 3000, recordedAt: 1000 });
    assert.deepEqual(discountResult(calculation), { finalCents: 5250, savedCents: 2250 });
  }
  assert.deepEqual(discountResult(calculateDiscount('75,50', '30,50')), { finalCents: 5247, savedCents: 2303 });
});
test('Final price rounds half cents up, with exact savings and 0/100 percent boundaries', () => {
  assert.deepEqual(discountResult(calculateDiscount('0,05', '50')), { finalCents: 3, savedCents: 2 });
  assert.deepEqual(discountResult(calculateDiscount('0,03', '50')), { finalCents: 2, savedCents: 1 });
  assert.deepEqual(discountResult(calculateDiscount('75', '0')), { finalCents: 7500, savedCents: 0 });
  assert.deepEqual(discountResult(calculateDiscount('75', '100')), { finalCents: 0, savedCents: 7500 });
  assert.deepEqual(discountResult(calculateDiscount('0', '100')), { finalCents: 0, savedCents: 0 });
  const price = `${Math.floor(MAX_PRICE_CENTS / 100)},${String(MAX_PRICE_CENTS % 100).padStart(2, '0')}`;
  for (const discount of ['0', '0,01', '50', '99,99', '100']) {
    const calculation = calculateDiscount(price, discount);
    const result = discountResult(calculation);
    const exact = Number((BigInt(calculation.priceCents) * BigInt(10000 - calculation.discountBasisPoints) + 5000n) / 10000n);
    assert.equal(result.finalCents, exact);
    assert.equal(result.finalCents + result.savedCents, MAX_PRICE_CENTS);
  }
});
test('Invalid or ambiguous input never becomes a calculation', () => {
  for (const price of ['', ' ', '-1', '-0', '1e3', '1,234', '1.000,00', '1,2.3', 'Infinity', '9999999999999999999999999', 75, null]) {
    assert.throws(() => calculateDiscount(price, '30'), error => error.field === 'price');
  }
  for (const discount of ['-1', '100,01', '101', 'NaN', '', '30,001', '1e2']) {
    assert.throws(() => calculateDiscount('75', discount), error => error.field === 'discount');
  }
});
test('Successful calculations keep only the last five in one committed entry and then record use', async () => {
  let entries = [];
  const calls = [];
  const api = {
    listEntries: async () => { calls.push('read'); return structuredClone(entries); },
    saveEntry: async entry => { calls.push('save'); validateDiscountEntry(entry); entries = [structuredClone(entry)]; return entry; },
    recordUse: async () => calls.push('use')
  };
  for (let number = 1; number <= 7; number++) await saveCalculation(api, calculateDiscount(String(number), '30', number));
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].calculations.map(value => value.priceCents), [700, 600, 500, 400, 300]);
  assert.deepEqual(calls, Array.from({ length: 7 }, () => ['read', 'save', 'use']).flat());
});
test('Failed history save preserves old data and never records use; metadata failure preserves a commit', async () => {
  const old = history([calculateDiscount('75', '30', 1000)]);
  const snapshot = structuredClone(old);
  let uses = 0;
  const api = { listEntries: async () => [old], saveEntry: async () => { throw new Error('write failed'); }, recordUse: async () => { uses++; } };
  await assert.rejects(saveCalculation(api, calculateDiscount('100', '20')), /write failed/);
  assert.deepEqual(old, snapshot);
  assert.equal(uses, 0);
  api.saveEntry = async entry => entry;
  api.recordUse = async () => { throw new Error('metadata failed'); };
  const result = await saveCalculation(api, calculateDiscount('100', '20'));
  assert.equal(result.entry.calculations.length, 2);
  assert.equal(result.usageError.message, 'metadata failed');
});
test('Discount validation rejects invalid imports before opening IndexedDB', () => {
  let opens = 0;
  globalThis.indexedDB = { open() { opens++; throw new Error('Unexpected database access'); } };
  try {
    const valid = history([calculateDiscount('75', '30', 1000)]);
    const cases = [
      { ...valid, entryVersion: 2 }, { ...valid, id: 'foreign-id' }, { ...valid, createdAt: 1 },
      { ...valid, calculations: Array.from({ length: 6 }, () => valid.calculations[0]) },
      { ...valid, calculations: [{ ...valid.calculations[0], discountBasisPoints: 10001 }] },
      { ...valid, calculations: [{ ...valid.calculations[0], priceCents: '<img src=x>' }] },
      { ...valid, calculations: [{ ...valid.calculations[0], recordedAt: -1 }] }
    ];
    for (const entry of cases) {
      const data = { schemaVersion: 2, stores: Object.fromEntries(STORES.map(name => [name, []])) };
      data.stores.entries = [entry];
      assert.throws(() => importAll(data));
    }
    assert.equal(opens, 0);
  } finally { delete globalThis.indexedDB; }
});
