// Real helper; checks accessibility risks introduced by the visual pass, not CSS snapshots.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 320, height: 700 } });
  const app = await context.newPage();
  const results = [];
  const errors = [];
  app.on('pageerror', error => errors.push(error.message));
  function check(condition, label) { if (!condition) throw new Error(label); results.push(label); }
  async function reflow(label) { check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label); }
  async function targets(label) {
    check(await app.locator('.pain button:visible, .pain-choice:visible, .action-footer button').evaluateAll(elements => elements.every(element => element.getBoundingClientRect().height >= 48)), label);
  }
  async function open() {
    await app.locator('.home-accordion').last().evaluate(element => { element.open = true; });
    await app.locator('#allHelperList [data-helper="pain"]').click();
    await app.waitForSelector('.pain-content form, .pain-content h2');
  }
  try {
    await app.goto('http://127.0.0.1:8080/');
    await open();
    const contrasts = await app.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const color = name => style.getPropertyValue(`--${name}`).trim();
      const luminance = hex => {
        const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
        return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
      };
      return [['text-primary', 'surface-page', 4.5], ['text-muted', 'surface-page', 4.5], ['text-primary', 'surface-paper', 4.5], ['text-muted', 'surface-paper', 4.5], ['text-primary', 'surface-soft', 4.5], ['text-muted', 'surface-soft', 4.5], ['text-primary', 'accent-soft', 4.5], ['accent', 'surface-page', 4.5], ['border-control', 'surface-paper', 3], ['border-control', 'surface-page', 3], ['accent', 'accent-soft', 3], ['surface-paper', 'color-danger', 4.5]].map(([foreground, background, minimum]) => {
        const values = [luminance(color(foreground)), luminance(color(background))].sort((a, b) => b - a);
        return { pair: `${foreground}/${background}`, ratio: (values[0] + .05) / (values[1] + .05), minimum };
      });
    });
    for (const { pair, ratio, minimum } of contrasts) check(ratio >= minimum, `Contrast ${pair}: ${ratio.toFixed(2)}:1`);
    await targets('Area answers, actions and footer retain at least 48 px touch height');
    await app.locator('[data-pain="guidance-off"]').click();
    await app.waitForFunction(() => document.querySelector('.pain-guidance').hidden);
    // Also combine 200% text enlargement with a 320 px viewport, a stricter case than reflow alone.
    await app.addStyleTag({ content: ':root { font-size: 200%; }' });
    await reflow('Area question reflows with 200% text at 320 CSS px');
    check(await app.locator('input[name="bodyArea"][value="Kopf"]').evaluate(element => {
      const text = element.closest('label').querySelector('span');
      return text.getBoundingClientRect().height <= parseFloat(getComputedStyle(text).lineHeight) + 1;
    }), 'Enlarged body-area names remain readable without splitting short words');
    check(await app.locator('.action-footer button').evaluateAll(elements => elements.every(element => {
      const bounds = element.getBoundingClientRect();
      const text = element.lastElementChild.getBoundingClientRect();
      return text.left >= bounds.left && text.right <= bounds.right;
    })), 'Enlarged footer labels stay within their touch areas');
    await app.locator('input[name="bodyArea"][value="Bauch"]').check();
    await app.locator('#painAreaForm button[type="submit"]').click();
    await app.waitForSelector('#painEntryForm');
    await reflow('Intensity question reflows with 200% text at 320 CSS px');
    check(await app.locator('input[name="intensity"][value="10"]').evaluate(element => {
      const text = element.closest('label').querySelector('span');
      return text.getBoundingClientRect().height <= parseFloat(getComputedStyle(text).lineHeight) + 1;
    }), 'Enlarged intensity 10 remains one readable number');
    await app.locator('input[name="intensity"][value="4"]').check();
    await app.locator('#painEntryForm button[type="submit"]').click();
    await app.waitForFunction(() => document.querySelector('.pain-status')?.textContent === 'Eintrag gespeichert.');
    await reflow('Confirmation reflows with 200% text at 320 CSS px');
    await targets('Enlarged controls retain touch size');
    await app.locator('[data-pain="history"]').click();
    await reflow('History reflows with 200% text at 320 CSS px');
    await app.locator('[data-entry]').first().click();
    await reflow('Optional details reflow with 200% text at 320 CSS px');
    await app.locator('[data-pain="cancel"]').click();
    await app.locator('#backButton').click();
    await app.locator('[data-pain="done"]').click();
    await app.waitForSelector('#nowRows [data-helper="pain"]');
    await reflow('Dashboard reflows with 200% text at 320 CSS px');
    const tile = app.locator('#nowRows [data-helper="pain"]');
    await app.keyboard.press('Tab');
    await tile.focus();
    check(await tile.evaluate(element => {
      const style = getComputedStyle(element);
      return style.outlineStyle === 'solid' && parseFloat(style.outlineWidth) >= 3 && style.clipPath === 'none' && style.overflow === 'visible';
    }), 'Helper tile preserves an unclipped visible keyboard focus');
    await app.keyboard.press('Enter');
    await app.waitForSelector('.pain-last-value');
    await reflow('Returning summary reflows with 200% text at 320 CSS px');
    await app.locator('[data-composer="person"]').click();
    await app.setViewportSize({ width: 320, height: 480 });
    await app.locator('#personForm button[type="submit"]').focus();
    check(await app.locator('#personForm button[type="submit"]').evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.top >= 0 && bounds.bottom <= document.querySelector('.action-footer').getBoundingClientRect().top;
    }), 'Enlarged composer submit stays visible above footer on a short viewport');
    await app.locator('#quickComposerClose').click();
    await app.setViewportSize({ width: 320, height: 700 });
    await app.emulateMedia({ reducedMotion: 'reduce' });
    await app.locator('[data-pain="same-area"]').click();
    check(await app.locator('#painEntryForm').evaluate(element => getComputedStyle(element).animationName === 'none'), 'Reduced Motion removes the step arrival animation');
    check(await app.locator('.pain-choice').evaluateAll(elements => elements.every(element => getComputedStyle(element).transitionDuration.split(',').every(value => parseFloat(value) === 0))), 'Reduced Motion removes selection transitions');
    check(await app.evaluate(() => [...document.querySelectorAll('[hidden]')].every(element => getComputedStyle(element).display === 'none')), 'Hidden elements stay outside visual layout');
    check(errors.length === 0, `No browser errors: ${errors.join(', ')}`);
    return results;
  } finally { await context.close(); }
}
