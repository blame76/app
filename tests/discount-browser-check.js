// Real discount helper and IndexedDB; no production fixtures or new dependency.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 320, height: 700 } });
  const app = await context.newPage();
  const results = [];
  const errors = [];
  const requests = [];
  app.on('pageerror', error => errors.push(error.message));
  app.on('request', request => requests.push(request.url()));
  function check(condition, label) { if (!condition) throw new Error(label); results.push(label); }
  async function data() { return app.evaluate(async () => (await (await import('/src/db.js')).list('entries')).filter(entry => entry.helperId === 'discount')); }
  async function usage() { return app.evaluate(async () => (await (await import('/src/db.js')).get('settings', 'usage:discount'))?.lastUsedAt); }
  async function open() {
    await app.locator('.home-accordion').last().evaluate(element => { element.open = true; });
    await app.locator('#allHelperList [data-helper="discount"]').click();
    await app.waitForSelector('#discountForm');
  }
  async function fill(price, discount) {
    await app.locator('input[name="price"]').fill(price);
    await app.locator('input[name="discount"]').fill(discount);
  }
  async function saved(amount) {
    await app.waitForFunction(amount => !document.querySelector('.discount-result').hidden && document.querySelector('#discountResult').textContent.replace(/\s/g, '') === amount, amount);
    await app.waitForFunction(() => !document.querySelector('#discountForm button').disabled);
  }
  async function calculate(price, discount, amount) { await fill(price, discount); await app.locator('#discountForm button').click(); await saved(amount); }
  async function reflow(label) { check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label); }
  await app.addInitScript(() => {
    window.geoCalls = 0;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition(success) {
      window.geoCalls++;
      success({ coords: { latitude: 50, longitude: 8, accuracy: 10 } });
    } } });
  });
  try {
    await app.goto('http://127.0.0.1:8080/');
    await app.waitForSelector('#allHelperList [data-helper="discount"]', { state: 'attached' });
    await open();
    check(!await app.locator('#view-dashboard').isVisible() && !await app.locator('#headerMenuWrap').isVisible(), 'Discount owns the shell focus view');
    check(await usage() === undefined && (await data()).length === 0 && await app.evaluate(() => window.geoCalls === 0), 'Opening discount neither records use nor queries location');
    check(!await app.locator('#discountForm').evaluate(form => form.checkValidity()), 'Both discount fields are required');
    check(await app.locator('input[name="price"]').evaluate(element => element === document.activeElement), 'Discount opening focuses the price field');
    await app.keyboard.type('75,00');
    await app.keyboard.press('Tab');
    check(await app.locator('input[name="discount"]').evaluate(element => element === document.activeElement), 'Tab reaches the discount field');
    await app.keyboard.type('30');
    await app.keyboard.press('Tab');
    check(await app.locator('#discountForm button').evaluate(element => getComputedStyle(element).outlineStyle === 'solid'), 'Calculate has visible keyboard focus');
    await app.keyboard.press('Enter');
    await saved('52,50€');
    check((await app.locator('#discountSavings').textContent()).replace(/\s/g, '') === '22,50€weniger', '75 / 30 displays the final price and actual savings');
    check(await app.locator('#discountResult').evaluate(element => element === document.activeElement), 'Calculation moves focus to its result');
    check((await data())[0].calculations[0].priceCents === 7500 && await usage() > 0, 'Successful calculation commits history before actual-use metadata');
    await reflow('Discount inputs, result and history fit 320 CSS px');
    await app.screenshot({ path: '/tmp/0815-discount-320.png', fullPage: true });
    const beforeInvalid = JSON.stringify(await data());
    const useBeforeInvalid = await usage();
    await fill('-1', '30');
    await app.locator('#discountForm button').click();
    check(await app.locator('input[name="price"]').evaluate(element => element.validity.customError && element === document.activeElement), 'Negative price is rejected with field feedback and focus');
    await fill('75', '101');
    await app.locator('#discountForm button').click();
    check(await app.locator('input[name="discount"]').evaluate(element => element.validity.customError && element.validationMessage.includes('0 bis 100')), 'Out-of-range discount gives its allowed range');
    check(JSON.stringify(await data()) === beforeInvalid && await usage() === useBeforeInvalid && !await app.locator('.discount-result').isVisible(), 'Invalid input neither stores history nor records use or retains a misleading old result');
    await calculate('75.00', '0', '75,00€');
    check((await app.locator('#discountSavings').textContent()).replace(/\s/g, '') === '0,00€weniger', 'Zero discount preserves the whole price');
    await calculate('75', '100', '0,00€');
    check((await app.locator('#discountSavings').textContent()).replace(/\s/g, '') === '75,00€weniger', 'Full discount gives zero final price');
    for (let number = 100; number <= 106; number++) await calculate(String(number), '0', `${number},00€`);
    const history = await data();
    check(history.length === 1 && history[0].calculations.length === 5 && history[0].calculations.map(value => value.priceCents).join(',') === '10600,10500,10400,10300,10200', 'Storage contains exactly the last five calculations in one bounded entry');
    check(await app.locator('.discount-history li').count() === 5, 'Visible history matches the stored five calculations');
    const beforeFailure = JSON.stringify(history);
    const useBeforeFailure = await usage();
    await app.evaluate(() => {
      window.originalPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(value, ...args) {
        if (this.name === 'entries' && value.helperId === 'discount') throw new DOMException('Quota', 'QuotaExceededError');
        return window.originalPut.call(this, value, ...args);
      };
    });
    await fill('200', '15');
    await app.locator('#discountForm button').click();
    await app.waitForFunction(() => document.querySelector('#toast').textContent.includes('Berechnung konnte nicht gespeichert werden'));
    check(JSON.stringify(await data()) === beforeFailure && await usage() === useBeforeFailure && await app.locator('input[name="price"]').inputValue() === '200', 'History write failure preserves data, use metadata and input');
    await app.evaluate(() => { IDBObjectStore.prototype.put = window.originalPut; });
    await app.locator('#discountForm button').click();
    await saved('170,00€');
    check((await data())[0].calculations[0].priceCents === 20000, 'Failed calculation can be retried successfully');
    await app.evaluate(() => {
      IDBObjectStore.prototype.put = function(value, ...args) {
        if (this.name === 'settings' && value.id === 'usage:discount') throw new Error('Metadata failure');
        return window.originalPut.call(this, value, ...args);
      };
    });
    await calculate('99', '10', '89,10€');
    await app.waitForFunction(() => document.querySelector('#toast').textContent.includes('Berechnung gespeichert.'));
    check((await data())[0].calculations[0].priceCents === 9900 && await app.locator('.discount-result').isVisible(), 'Metadata failure preserves the committed calculation and result');
    await app.evaluate(() => {
      window.discountWrites = 0;
      IDBObjectStore.prototype.put = function(value, ...args) {
        if (this.name === 'entries' && value.helperId === 'discount') window.discountWrites++;
        return window.originalPut.call(this, value, ...args);
      };
    });
    await fill('303', '10');
    await app.evaluate(() => {
      const form = document.querySelector('#discountForm');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      window.discountInputsDisabled = [...form.querySelectorAll('input')].every(element => element.disabled);
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await saved('272,70€');
    check(await app.evaluate(() => window.discountWrites === 1), 'Repeated submission during a pending calculation makes one write');
    check(await app.evaluate(() => window.discountInputsDisabled) && await app.locator('#discountForm input:disabled').count() === 0, 'Pending calculation freezes its input snapshot and restores editable fields');
    await app.evaluate(() => { IDBObjectStore.prototype.put = window.originalPut; });
    const enlargedText = await app.addStyleTag({ content: ':root { font-size: 200%; }' });
    await reflow('Discount reflows at 320 CSS px with 200% text');
    check(await app.locator('#discountForm button, #discountForm input').evaluateAll(elements => elements.every(element => element.getBoundingClientRect().height >= 48)), 'Discount controls retain at least 48 px height');
    await enlargedText.evaluate(element => element.remove());
    await app.emulateMedia({ reducedMotion: 'reduce' });
    check(await app.locator('#discountForm button').evaluate(element => parseFloat(getComputedStyle(element).transitionDuration) === 0), 'Discount respects Reduced Motion');
    await app.locator('#backButton').click();
    await app.waitForFunction(() => !document.querySelector('#view-dashboard').hidden);
    check(await app.locator('#nowRows [data-helper="discount"]').count() === 0, 'Successful discount use alone does not invent a dashboard reason');
    await app.evaluate(async () => (await import('/src/db.js')).put('places', { id: 'shopping', name: 'Einkaufszentrum', lat: 50, lon: 8, radius: 250, createdAt: Date.now() }));
    await open();
    await app.locator('#helperSettingsButton').click();
    await app.waitForSelector('#helperSettingsForm');
    check(await app.locator('input[name="place"]').count() === 1 && await app.locator('input[name="time"], input[name="interval"], [name="trackingWindow"]').count() === 0, 'Discount settings expose only its place capability');
    await app.locator('input[name="place"]').check();
    await app.locator('input[name="favorite"]').check();
    await app.locator('#helperSettingsForm button').click();
    await app.waitForFunction(() => !document.querySelector('#helperSettingsForm').dataset.saving);
    await app.locator('#backButton').click();
    await app.waitForSelector('#discountForm');
    await app.locator('#backButton').click();
    await app.waitForFunction(() => document.querySelector('#nowRows [data-helper="discount"] span')?.textContent === 'Einkaufszentrum');
    check(await app.evaluate(() => window.geoCalls === 1), 'Linked place uses the existing dashboard location query and stored name');
    await app.getByText('Favoriten', { exact: true }).click();
    check(await app.locator('#favoriteTiles [data-helper="discount"]').isVisible(), 'Discount favorite uses the existing shell');
    await app.locator('#nowRows [data-helper="discount"]').click();
    await app.waitForSelector('#discountForm');
    check(await app.evaluate(() => window.geoCalls === 1) && await app.locator('.discount-history li').count() === 5, 'Opening linked discount adds no own location query and restores history');
    await app.locator('#helperSettingsButton').click();
    await app.waitForSelector('#helperSettingsForm');
    const storedBeforeHiding = JSON.stringify(await data());
    await app.locator('input[name="visible"]').uncheck();
    await app.locator('#helperSettingsForm button').click();
    await app.waitForFunction(() => !document.querySelector('#helperSettingsForm').dataset.saving);
    await app.locator('#backButton').click();
    await app.waitForFunction(() => !document.querySelector('[data-helper="discount"]'));
    check(JSON.stringify(await data()) === storedBeforeHiding, 'Hiding discount removes dashboard links and retains its history');
    check(requests.every(url => url.startsWith('http://127.0.0.1:8080/')) && !requests.some(url => /[?&](price|discount)=/.test(url)), 'Discount causes no external or form-query requests');
    check(await app.evaluate(() => [...document.querySelectorAll('[hidden]')].every(element => getComputedStyle(element).display === 'none')), 'Discount hidden states stay outside layout');
    check(errors.length === 0, `No browser errors: ${errors.join(', ')}`);
    return results;
  } finally { await context.close(); }
}
