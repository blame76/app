import { get, put } from './db.js';

export const DESIGN_MODES = ['light', 'dark', 'signature'];
const colors = { light: '#f5f2eb', dark: '#211f1e', signature: '#2447c7' };

function applyTheme(value) {
  document.documentElement.dataset.theme = value;
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.removeAttribute('media');
    meta.content = colors[value];
  }
}

export async function initializeTheme() {
  // Migrate the previous appearance once. There is no live system/auto mode.
  const initial = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  try {
    const saved = await get('settings', 'theme');
    if (DESIGN_MODES.includes(saved?.value)) applyTheme(saved.value);
    else {
      applyTheme(initial);
      await put('settings', { id: 'theme', value: initial });
    }
  } catch (error) {
    if (!document.documentElement.dataset.theme) applyTheme(initial);
    return error;
  } finally { delete document.documentElement.dataset.themeLoading; }
}

export async function saveTheme(value) {
  if (!DESIGN_MODES.includes(value)) throw new TypeError('Unbekanntes Design.');
  await put('settings', { id: 'theme', value });
  applyTheme(value);
}
