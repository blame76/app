import { validateDrinkEntry, orderedEntries, todayEntries, relativeTime, saveDrink } from './model.js';

const dateTime = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
const clockTime = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

export default {
  id: 'drink', label: 'Trinken', category: 'Wohlbefinden', defaultVisible: true,
  contexts: ['interval'],
  defaults: { interval: { value: 1, unit: 'hour' }, earlyBy: { value: 15, unit: 'minute' } },
  retention: { defaultWindow: 'always' },
  validateEntry: validateDrinkEntry,
  offlineAssets: ['./src/helpers/drink/model.js', './src/helpers/drink/styles.css'],
  async mount({ root, api, signal }) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = new URL('./styles.css', import.meta.url).href;
    root.append(css);
    let entries = await api.listEntries();
    if (signal.aborted) return;
    entries.forEach(validateDrinkEntry);
    const host = document.createElement('div');
    host.className = 'drink';
    host.innerHTML = `
      <h2 id="drinkQuestion" class="section-title" tabindex="-1">Gerade etwas getrunken?</h2>
      <section class="drink-last" aria-labelledby="drinkLastTitle" hidden>
        <h2 id="drinkLastTitle">Zuletzt dokumentiert</h2>
        <p><time id="drinkLast" tabindex="-1"></time></p>
      </section>
      <button id="drinkRecord" type="button">Ja</button>
      <section class="drink-history" aria-labelledby="drinkTodayTitle" hidden>
        <h2 id="drinkTodayTitle">Heute</h2>
        <ol></ol>
      </section>`;
    root.append(host);
    const button = host.querySelector('button');
    const question = host.querySelector('#drinkQuestion');
    const last = host.querySelector('.drink-last');
    const time = host.querySelector('#drinkLast');
    const history = host.querySelector('.drink-history');
    let saving = false;
    function render() {
      const latest = orderedEntries(entries)[0];
      question.hidden = !!latest;
      last.hidden = !latest;
      button.textContent = latest ? 'Ja, gerade' : 'Ja';
      button.setAttribute('aria-describedby', latest ? 'drinkLastTitle drinkLast' : 'drinkQuestion');
      if (latest) {
        time.dateTime = new Date(latest.recordedAt).toISOString();
        time.title = dateTime.format(latest.recordedAt);
        time.textContent = relativeTime(latest.recordedAt);
      }
      const today = todayEntries(entries);
      history.hidden = !today.length;
      history.querySelector('ol').replaceChildren(...today.map(entry => {
        const row = document.createElement('li');
        const recorded = document.createElement('time');
        recorded.dateTime = new Date(entry.recordedAt).toISOString();
        recorded.textContent = clockTime.format(entry.recordedAt);
        recorded.title = dateTime.format(entry.recordedAt);
        row.append(recorded);
        return row;
      }));
    }
    render();
    button.addEventListener('click', async () => {
      if (saving || signal.aborted) return;
      saving = true;
      button.setAttribute('aria-busy', 'true');
      button.disabled = true;
      try {
        const { entry, usageError } = await saveDrink(api);
        if (signal.aborted) return;
        // Committed data drives feedback; a later metadata failure never triggers a retry.
        entries = [entry, ...entries];
        render();
        time.focus();
        if (usageError) api.toast('Getränk dokumentiert. Der Intervallzeitpunkt konnte nicht aktualisiert werden.');
      } catch (error) {
        if (!signal.aborted) api.toast(error.name === 'QuotaExceededError'
          ? 'Browser-Speicher voll. Getränk konnte nicht dokumentiert werden.'
          : 'Getränk konnte nicht dokumentiert werden. Bitte erneut versuchen.');
      } finally { saving = false; button.removeAttribute('aria-busy'); button.disabled = false; }
    });
    (entries.length ? time : question).focus();
    return () => { css.remove(); };
  }
};
