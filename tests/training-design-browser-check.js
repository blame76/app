// Actual Training views, native controls and theme tokens; no mocked renderer.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 320, height: 760 }, timezoneId: 'Europe/Berlin' });
  const app = await context.newPage();
  const checks = [], errors = [];
  const check = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
  app.on('pageerror', error => errors.push(error.message));
  async function inspect(label) {
    await app.evaluate(() => document.fonts.ready);
    await app.mouse.move(0, 0);
    check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: no horizontal overflow`);
    check(await app.locator('.training button:visible, .training summary:visible, .training-mode:visible').evaluateAll(elements => elements.every(element => element.getBoundingClientRect().height >= 48)), `${label}: controls have at least 48px touch height`);
    const failures = await app.evaluate(() => {
      const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = color => rgb(color).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
      const contrast = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
      const background = element => {
        for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
          const color = getComputedStyle(ancestor).backgroundColor;
          if (!['transparent', 'rgba(0, 0, 0, 0)'].includes(color)) return color;
        }
        return 'rgb(255, 255, 255)';
      };
      return [...document.querySelectorAll('.training *')].filter(element => element.checkVisibility() && [...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim()) && element.tagName !== 'OPTION').flatMap(element => {
        const style = getComputedStyle(element);
        const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
        const ratio = contrast(style.color, background(element));
        return ratio < (large ? 3 : 4.5) ? [{ text: element.textContent.slice(0, 40), ratio }] : [];
      }).concat([...document.querySelectorAll('.training-mode')].filter(element => element.checkVisibility()).flatMap(element => {
        const ratio = contrast(getComputedStyle(element).borderTopColor, background(element));
        return ratio < 3 ? [{ control: 'mode card', ratio }] : [];
      }));
    });
    check(!failures.length, `${label}: AA text and mode-card boundary contrast ${JSON.stringify(failures)}`);
  }
  async function inspectSizes(label) {
    for (const width of [320, 390]) {
      await app.setViewportSize({ width, height: 760 });
      await inspect(`${label}/${width}`);
    }
    await app.setViewportSize({ width: 320, height: 760 });
    await app.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await inspect(`${label}/320 at 200% text`);
    await app.evaluate(() => { document.documentElement.style.fontSize = ''; });
  }
  try {
    await app.goto('http://127.0.0.1:8080/');
    await app.locator('#allHelperList [data-helper="training"]').waitFor({ state: 'attached' });
    await app.evaluate(async () => {
      const db = await import('/src/db.js');
      const { createTraining, validateTrainingEntry } = await import('/src/helpers/training/model.js');
      const now = Date.now();
      for (const [index, title] of ['Oberkörper', 'Beine', 'Oberkörper <img src=x onerror=alert(1)>'].entries()) {
        const start = now - (index + 1) * 86400000;
        await db.put('entries', validateTrainingEntry({ ...createTraining(start), id: `design-${index}`, title, status: 'ended', endedAt: start + 3600000,
          activities: [{ id: 'a1', name: 'Bizepsmaschine <img src=x>', mode: 'sets', sets: [{ weightKg: 45, reps: 10, recordedAt: start + 1000 }] }] }));
      }
    });
    await app.locator('.home-accordion').last().locator('summary').click();
    await app.locator('#allHelperList [data-helper="training"]').click();
    for (const theme of ['light', 'dark', 'signature']) {
      await app.evaluate(async value => (await import('/src/theme.js')).saveTheme(value), theme);
      await inspectSizes(`${theme}/start choices`);
      await app.locator('#trainingStart').click();
      await inspectSizes(`${theme}/optional name`);
      await app.locator('[data-training="without-title"]').click();
      await inspectSizes(`${theme}/activity and modes`);
      const tree = await app.locator('.training').ariaSnapshot();
      check(tree.includes('group "Wie möchtest du sie erfassen?"') && tree.includes('radio "Sätze & Wiederholungen') && tree.includes('radio "Zeit') && tree.includes('radio "Strecke'), `${theme}: accessible mode group and descriptive radios`);
      await app.locator('#trainingActivityForm input[name="name"]').fill('Bizepsmaschine <img src=x>');
      await app.locator('input[name="mode"][value="sets"]').focus();
      await app.keyboard.press('ArrowRight');
      check(await app.locator('input[name="mode"][value="duration"]').isChecked(), `${theme}: arrow keys select the next mode`);
      await app.keyboard.press('ArrowLeft');
      check(await app.locator('.training-mode:has(:focus-visible)').evaluate(element => getComputedStyle(element).outlineStyle === 'solid'), `${theme}: keyboard focus outlines the whole mode card`);
      await app.locator('#trainingActivityForm button').click();
      await app.locator('[data-activity-form="a1"] input[name="weightKg"]').fill('45');
      await app.locator('[data-activity-form="a1"] input[name="reps"]').fill('10');
      await app.locator('[data-activity-form="a1"] button').click();
      await app.locator('#a1-saved-0').waitFor();
      await inspectSizes(`${theme}/saved set and next entry`);
      await app.setViewportSize({ width: 320, height: 480 });
      await app.locator('[data-activity-form="a1"] input[name="reps"]').fill('9');
      await app.locator('[data-activity-form="a1"] button').click();
      await app.locator('#a1-saved-1').waitFor();
      check(await app.locator('#a1-saved-1').evaluate(element => {
        const rect = element.getBoundingClientRect();
        const footer = document.querySelector('.action-footer').getBoundingClientRect();
        return element === document.activeElement && rect.top >= 0 && rect.bottom <= Math.min(innerHeight, footer.top);
      }), `${theme}: saved set receives visible focus above the footer at 480px height`);
      await app.locator('[data-activity-form="a1"] button').focus();
      check(await app.locator('[data-activity-form="a1"] button').evaluate(element => {
        const rect = element.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= document.querySelector('.action-footer').getBoundingClientRect().top;
      }), `${theme}: next save stays reachable on a short viewport`);
      await app.emulateMedia({ reducedMotion: 'reduce' });
      check(await app.locator('.training-saved-list li').evaluateAll(elements => elements.every(element => getComputedStyle(element).animationName === 'none' && getComputedStyle(element).transitionDuration.split(',').every(value => parseFloat(value) === 0))), `${theme}: no saved-result animation with Reduced Motion`);
      await app.locator('[data-training="finish"]').click();
      await app.locator('.training-complete-title').waitFor();
      await inspectSizes(`${theme}/completion`);
      await app.locator('[data-training="home"]').click();
      await app.locator('[data-training="history"]').click();
      await inspectSizes(`${theme}/history`);
      await app.locator('[data-session="design-2"]').click();
      await inspectSizes(`${theme}/history detail`);
      check((await app.locator('.training .section-title').textContent()).includes('<img src=x onerror=alert(1)>') && await app.locator('.training img').count() === 0, `${theme}: imported markup stays literal text in title, activities and history`);
      await app.locator('#backButton').click();
      await app.locator('#backButton').click();
    }
    check(errors.length === 0, `No Training design browser errors: ${errors.join(', ')}`);
    return checks;
  } finally { await context.close(); }
}
