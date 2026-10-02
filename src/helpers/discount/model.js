export const HISTORY_ID = 'discount-history';
// Integer intermediates (including half a cent) must stay exact in Number arithmetic.
export const MAX_PRICE_CENTS = Math.floor((Number.MAX_SAFE_INTEGER - 5000) / 10000);

function requireValue(condition, message) { if (!condition) throw new Error(message); }
function timestamp(value) { return Number.isFinite(value) && value >= 0 && value <= 8640000000000000; }

function decimal(value, field, maximum, message, limitMessage = message) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) throw Object.assign(new Error(message), { field });
  const [whole, fraction = ''] = text.split(/[.,]/);
  const scaled = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(scaled) || scaled > maximum) throw Object.assign(new Error(limitMessage), { field });
  return scaled;
}

export function calculateDiscount(price, discount, recordedAt = Date.now()) {
  const calculation = {
    priceCents: decimal(price, 'price', MAX_PRICE_CENTS, 'Bitte einen Preis ab 0 mit höchstens zwei Nachkommastellen angeben.', 'Preis zu groß. Bitte höchstens 9.007.199.254,73 € angeben.'),
    discountBasisPoints: decimal(discount, 'discount', 10000, 'Bitte einen Rabatt von 0 bis 100 % mit höchstens zwei Nachkommastellen angeben.'),
    recordedAt
  };
  validateCalculation(calculation);
  return calculation;
}

export function validateCalculation(value) {
  requireValue(value && Number.isSafeInteger(value.priceCents) && value.priceCents >= 0 && value.priceCents <= MAX_PRICE_CENTS, 'Ungültiger Preis.');
  requireValue(Number.isInteger(value.discountBasisPoints) && value.discountBasisPoints >= 0 && value.discountBasisPoints <= 10000, 'Ungültiger Rabatt.');
  requireValue(timestamp(value.recordedAt), 'Ungültiger Berechnungszeitpunkt.');
  requireValue(Object.keys(value).every(key => ['priceCents', 'discountBasisPoints', 'recordedAt'].includes(key)), 'Unbekanntes Berechnungsfeld.');
  return value;
}

export function discountResult(calculation) {
  validateCalculation(calculation);
  // Round the final price half up; savings are the exact difference in cents.
  const finalCents = Math.floor((calculation.priceCents * (10000 - calculation.discountBasisPoints) + 5000) / 10000);
  return { finalCents, savedCents: calculation.priceCents - finalCents };
}

export function validateDiscountEntry(entry) {
  requireValue(entry.id === HISTORY_ID && entry.helperId === 'discount' && entry.entryVersion === 1, 'Unbekanntes Rabattformat.');
  requireValue(Array.isArray(entry.calculations) && entry.calculations.length >= 1 && entry.calculations.length <= 5, 'Ungültige Rabatthistorie.');
  entry.calculations.forEach(validateCalculation);
  requireValue(timestamp(entry.createdAt) && entry.createdAt === entry.calculations[0].recordedAt, 'Ungültiger Historienzeitpunkt.');
  requireValue(Object.keys(entry).every(key => ['id', 'helperId', 'entryVersion', 'createdAt', 'calculations'].includes(key)), 'Unbekanntes Rabattfeld.');
  return entry;
}

export async function saveCalculation(api, calculation) {
  validateCalculation(calculation);
  const entries = await api.listEntries();
  entries.forEach(validateDiscountEntry);
  const calculations = [calculation, ...(entries[0]?.calculations || [])].slice(0, 5);
  const entry = await api.saveEntry({ id: HISTORY_ID, helperId: 'discount', entryVersion: 1, createdAt: calculation.recordedAt, calculations });
  let usageError = null;
  try { await api.recordUse(); } catch (error) { usageError = error; }
  return { entry, usageError };
}
