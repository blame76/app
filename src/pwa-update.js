// Update the shell at a safe boundary, never in a helper, editor or open composer.
// Offline failures are expected; the existing cached release remains usable.
export function startPwaUpdates({ canReload, onDeferred, onRegistrationError }) {
  if (!('serviceWorker' in navigator)) return;
  const workers = navigator.serviceWorker;
  let controller = workers.controller;
  let registration;
  let checking = false;
  let pending = false;
  let reloading = false;
  let announced = false;
  const busyNodes = new Set();

  function tryReload() {
    for (const node of busyNodes) {
      if (node.getAttribute('aria-busy') !== 'true') busyNodes.delete(node);
    }
    if (!busyNodes.size) saves.disconnect();
    if (!pending || reloading || document.visibilityState !== 'visible') return;
    if (busyNodes.size || !canReload()) {
      if (!announced) { announced = true; onDeferred(); }
      return;
    }
    reloading = true;
    location.reload();
  }
  async function checkForUpdate() {
    tryReload();
    if (!registration || checking || document.visibilityState !== 'visible' || !navigator.onLine) return;
    checking = true;
    try { await registration.update(); } catch { /* Retry on next foreground/online check. */ }
    finally { checking = false; }
  }
  workers.addEventListener('controllerchange', () => {
    const next = workers.controller;
    // Initial installation claims the page too; it must not trigger a reload loop.
    if (controller && next && next !== controller) pending = true;
    controller = next;
    tryReload();
  });

  // Keep a reference to busy forms even if navigation detaches them before commit.
  // Observing the form itself also notices its completion after it is detached.
  const saves = new MutationObserver(() => tryReload());
  const observer = new MutationObserver(records => {
    for (const node of document.querySelectorAll('[aria-busy="true"]')) {
      if (!busyNodes.has(node)) { busyNodes.add(node); saves.observe(node, { attributes: true, attributeFilter: ['aria-busy'] }); }
    }
    for (const record of records) {
      if (record.type === 'attributes' && record.attributeName === 'aria-busy' && record.target.getAttribute('aria-busy') === 'true') {
        busyNodes.add(record.target);
        saves.observe(record.target, { attributes: true, attributeFilter: ['aria-busy'] });
      }
    }
    tryReload();
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'open', 'aria-busy'] });
  for (const name of ['focus', 'pageshow', 'online']) window.addEventListener(name, checkForUpdate);
  document.addEventListener('visibilitychange', checkForUpdate);
  // Background/suspended installed windows resume through the events above.
  window.setInterval(checkForUpdate, 60_000);
  workers.register('./sw.js', { type: 'module', updateViaCache: 'none' })
    .then(value => { registration = value; return checkForUpdate(); })
    .catch(onRegistrationError);
  return tryReload;
}
