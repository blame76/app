// Real theme settings, live renderers and IndexedDB. No alternate app or business fixtures.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', colorScheme: 'dark', timezoneId: 'Europe/Berlin', viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    window.visibleThemes = [];
    new MutationObserver(() => {
      if (document.body && getComputedStyle(document.body).visibility === 'visible') window.visibleThemes.push(document.documentElement.dataset.theme || 'missing');
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-theme', 'data-theme-loading'] });
  });
  const app = await context.newPage();
  const checks = [], errors = [], requests = [];
  const check = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
  app.on('pageerror', error => errors.push(error.message));
  app.on('request', request => requests.push(request.url()));
  async function ready() { await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' }); }
  async function home() { while (!await app.locator('#view-dashboard').isVisible()) await app.locator('#backButton').click(); await ready(); }
  async function settings() { await home(); await app.locator('#menuButton').click(); await app.locator('[data-view="settings"]').click(); await app.waitForSelector('#themeChoice'); }
  async function notes() { await home(); await app.locator('#menuButton').click(); await app.locator('[data-view="notes"]').click(); await app.waitForSelector('#readHost [data-note="one"]'); }
  async function open(id, selector) { await home(); await app.locator('.home-accordion').last().evaluate(el => { el.open = true; }); await app.locator(`#allHelperList [data-helper="${id}"]`).click(); await app.waitForSelector(selector); }
  async function storedTheme() { return app.evaluate(async () => (await (await import('/src/db.js')).get('settings', 'theme')).value); }
  async function choose(mode) {
    await app.locator(`input[name="theme"][value="${mode}"]`).check();
    await app.waitForFunction(value => document.documentElement.dataset.theme === value && !document.querySelector('#themeChoice').disabled, mode);
  }
  async function unchangedData() {
    return app.evaluate(async () => { const db = await import('/src/db.js'); return JSON.stringify([await Promise.all(['entries','places','people','helperRules'].map(name => db.list(name, {prune:false}))), (await db.list('settings')).filter(item => item.id !== 'theme')]); });
  }
  async function inspect(label) {
    await app.mouse.move(0, 0);
    check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: reflow`);
    const failures = await app.evaluate(() => {
      const rgb = s => s.match(/[\d.]+/g).slice(0,3).map(Number);
      const lum = c => c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
      return [...document.querySelectorAll('body *')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&!['SCRIPT','STYLE','OPTION'].includes(e.tagName)).map(e=>{
        const s=getComputedStyle(e);let a=e,b;while(a){b=getComputedStyle(a).backgroundColor;if(b!=='rgba(0, 0, 0, 0)'&&b!=='transparent')break;a=a.parentElement;}
        const x=lum(rgb(s.color)),y=lum(rgb(b));const ratio=(Math.max(x,y)+.05)/(Math.min(x,y)+.05);
        const large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700);
        return {text:e.textContent.slice(0,35),ratio,min:large?3:4.5};
      }).filter(v=>v.ratio<v.min);
    });
    check(failures.length === 0, `${label}: AA text contrast ${JSON.stringify(failures)}`);
  }
  async function shot(label) {
    const width = app.viewportSize().width;
    if (![390,1280].includes(width)) return;
    await app.mouse.move(0,0);
    await app.evaluate(() => { document.querySelector('#toast').hidden = true; });
    const framing = await app.addStyleTag({content:'body{display:flex;flex-direction:column;min-height:100vh}.app-header{width:100%}main{width:100%;flex:1;padding-bottom:3rem!important}.skip-link:not(:focus){visibility:hidden}.action-footer{position:relative!important;left:auto!important;right:auto!important;bottom:auto!important;transform:none!important;margin-top:auto}'});
    await app.waitForTimeout(220);
    await app.screenshot({ path: `/home/benjamin-lam/Projekte/blame76/app/design/signature/integrated/c-${width}-${label}.png`, fullPage: true, animations: 'allow' });
    await framing.evaluate(el=>el.remove());
  }
  try {
    await app.clock.setFixedTime(new Date('2026-10-04T16:00:00Z'));
    await app.goto('http://127.0.0.1:8080/'); await ready();
    check(await storedTheme() === 'dark' && await app.getAttribute('html','data-theme') === 'dark', 'First start migrates the previous dark appearance once');
    await app.emulateMedia({colorScheme:'light'});
    check(await app.getAttribute('html','data-theme') === 'dark', 'System changes do not change the saved mode');
    await settings();
    check(JSON.stringify(await app.locator('#themeChoice input').evaluateAll(els=>els.map(e=>[e.value,e.parentElement.textContent.trim()]))) === JSON.stringify([['light','Light'],['dark','Dark'],['signature','Signature']]), 'Design has exactly Light, Dark and Signature');
    await choose('light');
    await app.emulateMedia({colorScheme:'dark'});
    check(await app.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--surface-page').trim()) === '#f5f2eb', 'Explicit Light overrides a dark system');
    await choose('dark'); await app.emulateMedia({colorScheme:'light'});
    check(await app.evaluate(()=>getComputedStyle(document.documentElement).colorScheme) === 'dark', 'Explicit Dark retains native dark controls on a light system');
    await app.evaluate(async () => (await import('/src/db.js')).put('settings', {id:'sentinel',value:{keep:true}}));
    const before = await unchangedData();
    await app.evaluate(()=>{ window.themePut=IDBObjectStore.prototype.put; IDBObjectStore.prototype.put=function(){throw new DOMException('Quota','QuotaExceededError');}; });
    await app.locator('input[name="theme"][value="signature"]').check();
    await app.waitForFunction(()=>document.querySelector('#themeStatus').textContent.includes('nicht gespeichert')&&!document.querySelector('#themeChoice').disabled);
    await app.evaluate(()=>{IDBObjectStore.prototype.put=window.themePut;});
    check(await storedTheme() === 'dark' && await app.getAttribute('html','data-theme') === 'dark' && await app.locator('input[name="theme"][value="dark"]').isChecked(), 'Failed save keeps the persisted mode and restores the radio selection');
    await choose('signature');
    check(await storedTheme() === 'signature' && await unchangedData() === before, 'Theme save changes only the existing theme setting');
    await app.reload(); await ready();
    check(await app.getAttribute('html','data-theme') === 'signature', 'Signature survives a restart');
    check(await app.evaluate(()=>window.visibleThemes.length>0&&window.visibleThemes.every(value=>value==='signature')), 'Stored Signature is restored before the app becomes visible');
    check(await app.evaluate(()=>[...document.querySelectorAll('meta[name="theme-color"]')].every(m=>m.content==='#2447c7'&&!m.hasAttribute('media'))), 'Browser frame follows the explicit Signature color');
    await app.evaluate(async()=>{
      const db=await import('/src/db.js');const {HELPERS}=await import('/src/helpers/registry.js');const {helperDefaults}=await import('/src/helpers/contract.js');
      for(const helper of HELPERS){await db.put('helperRules',{...helperDefaults(helper),visible:true,favorite:true,timeBuckets:['evening']});await db.put('settings',{id:`usage:${helper.id}`,lastUsedAt:Date.now()-120000});}
      const texts=['Den langen Weg nach Hause nehmen.','Am Sonntag für alle kochen. Nicht viel planen. Ein großer Tisch reicht.','Heute war der Kopf zum ersten Mal seit Tagen still. Vielleicht lag es am Spaziergang. Vielleicht daran, das Telefon zu Hause zu lassen.\n\nDas möchte ich öfter machen.'];
      for(let i=0;i<3;i++)await db.put('entries',{id:['one','two','three'][i],type:'note',text:texts[i],createdAt:Date.now()-[120000,3600000,86400000][i],context:{timeBuckets:['evening']}});
    });
    await app.reload(); await ready();
    for (const width of [390,1280,320,768]) {
      await app.setViewportSize({width,height:width===390?844:960}); await home();
      await inspect(`${width}/dashboard`); await shot('dashboard');
      await open('pain','#painAreaForm');await app.locator('input[name="bodyArea"][value="Rücken"]').check();await app.locator('#painAreaForm button[type="submit"]').click();
      await app.locator('input[name="intensity"][value="4"]').check();
      check(await app.locator('.pain-value-number').textContent()==='4', `${width}: selected Pain value is shown`);
      check(await app.locator('.pain-number span').evaluateAll(els=>els.every(e=>e.getBoundingClientRect().width>=44&&e.getBoundingClientRect().height>=44)), `${width}: Pain number targets have full width and height`);
      await inspect(`${width}/pain`);await shot('pain');
      await notes();await inspect(`${width}/notes`);await shot('notes');
      await app.locator('#readHost [data-note="one"]').click();await app.waitForSelector('#noteEdit');await inspect(`${width}/detail`);await shot('detail');
      await settings();await inspect(`${width}/settings`);await shot('settings');
      await open('drink','#drinkRecord');await inspect(`${width}/drink`);await shot('drink');
      await open('discount','#discountForm');await inspect(`${width}/discount`);await shot('discount');
    }
    await app.setViewportSize({width:320,height:960});
    const zoom=await app.addStyleTag({content:':root {font-size:32px!important;}'});
    await home();await inspect('200%/dashboard');await notes();await inspect('200%/notes');
    await app.locator('#readHost [data-note="one"]').click();await inspect('200%/detail');
    await app.locator('#noteEdit').click();await inspect('200%/edit');await app.locator('#noteEditCancel').click();
    await settings();await inspect('200%/settings');
    await open('pain','#painAreaForm');await inspect('200%/pain area');await app.locator('input[name="bodyArea"][value="Rücken"]').check();await app.locator('#painAreaForm button[type="submit"]').click();await inspect('200%/pain intensity');
    await zoom.evaluate(el=>el.remove());
    await app.locator('input[name="intensity"][value="4"]').focus();await app.keyboard.press('ArrowRight');
    check(await app.locator('input[name="intensity"][value="5"]').isChecked()&&await app.locator('.pain-value-number').textContent()==='5','Keyboard radio selection updates the visual value');
    check(await app.locator('.pain-number:has(input:focus-visible)').evaluate(el=>getComputedStyle(el).outlineWidth==='3px'),'Pain keyboard focus remains visible');
    await app.emulateMedia({reducedMotion:'reduce'});
    check(await app.locator('.pain-number').evaluateAll(els=>els.every(e=>getComputedStyle(e).transitionDuration==='0s'&&getComputedStyle(e).animationName==='none')),'Signature respects Reduced Motion');
    await app.locator('#painEntryForm button[type="submit"]').click();await app.waitForFunction(()=>document.querySelector('.pain h2')?.textContent==='Rücken · 5 gespeichert');
    check(await app.evaluate(async()=> (await (await import('/src/db.js')).list('entries',{prune:false})).some(e=>e.helperId==='pain'&&e.intensity===5&&e.bodyArea==='Rücken')),'Signature Pain saves through the unchanged model');
    await app.locator('[data-pain="done"]').click();
    await notes();await app.locator('#readHost [data-note="one"]').click();await app.locator('#noteEdit').click();await app.locator('#noteEditText').fill('Ein Gedanke, den ich wieder lesen möchte.');await app.locator('#noteEditForm button[type="submit"]').click();await app.waitForSelector('#noteEdit');
    check(await app.locator('.note-text').textContent()==='Ein Gedanke, den ich wieder lesen möchte.','Signature uses the existing Notes edit lifecycle');
    await settings();await app.locator('input[name="theme"][value="light"]').focus();await app.keyboard.press('Space');await app.waitForFunction(()=>document.documentElement.dataset.theme==='light');
    check(await app.locator('input[name="theme"][value="light"]').evaluate(el=>getComputedStyle(el).outlineWidth==='3px'),'Design selection is keyboard accessible with a visible focus');
    check(requests.every(url=>url.startsWith('http://127.0.0.1:8080/')),'Signature loads only local resources');
    check(errors.length===0,`No browser errors: ${errors.join(', ')}`);
    return { checks, screenshots:14 };
  } catch(error) { throw new Error(`${error.message}; last checks: ${checks.slice(-5).join(' | ')}`); }
  finally { await context.close(); }
}
