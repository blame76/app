// Rolling days, applied only to dated entries of helpers that opt in.
export const RETENTION_WINDOWS = ['7d', '30d', '365d', 'always'];

export function retentionWindow(helper, rule) {
  if (!helper.retention) return 'always';
  const window = rule?.trackingWindow ?? helper.retention.defaultWindow;
  if (!RETENTION_WINDOWS.includes(window)) throw new Error('Ungültige Aufbewahrungsdauer.');
  return window;
}

export function expiredEntryIds(entries, rules, helpers, now = Date.now()) {
  const windows = new Map(helpers.map(helper => [helper.id, retentionWindow(helper, rules.find(rule => rule.id === helper.id))]));
  return entries.filter(entry => {
    const window = windows.get(entry.helperId) ?? 'always';
    return window !== 'always' && Number.isFinite(entry.createdAt) && entry.createdAt <= now - Number.parseInt(window, 10) * 86400000;
  }).map(entry => entry.id);
}
