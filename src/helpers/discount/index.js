import { calculateDiscount, discountResult, validateDiscountEntry, saveCalculation } from './model.js';

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const percent = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

export default {
  id: 'discount', label: 'Rabatt', category: 'Einkaufen', defaultVisible: true,
  contexts: ['place'],
  validateEntry: validateDiscountEntry,
  offlineAssets: ['./src/helpers/discount/model.js', './src/helpers/discount/styles.css'],
  async mount({ root, api, signal }) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = new URL('./styles.css', import.meta.url).href;
    root.append(css);
    const entries = await api.listEntries();
    if (signal.aborted) return;
    entries.forEach(validateDiscountEntry);
    const host = document.createElement('div');
    host.className = 'discount';
    host.innerHTML = `
      <form id="discountForm" class="stack">
        <div class="form-grid two">
          <label>Preis (€)<input name="price" type="text" inputmode="decimal" placeholder="75,00" required autocomplete="off"></label>
          <label>Rabatt (%)<input name="discount" type="text" inputmode="decimal" placeholder="30" required autocomplete="off"></label>
        </div>
        <button type="submit">Berechnen</button>
      </form>
      <section class="discount-result" aria-labelledby="discountResult" hidden>
        <p class="muted">Ergebnis</p>
        <h2 id="discountResult" tabindex="-1"></h2>
        <p id="discountSavings"></p>
      </section>
      <section class="discount-history" aria-labelledby="discountHistoryTitle" hidden>
        <h2 id="discountHistoryTitle">Zuletzt berechnet</h2>
        <ol></ol>
      </section>`;
    root.append(host);
    const form = host.querySelector('form');
    const button = form.querySelector('button');
    const fields = [...form.querySelectorAll('input')];
    const result = host.querySelector('.discount-result');
    const history = host.querySelector('.discount-history');
    let saving = false;
    function showHistory(entry) {
      const calculations = entry?.calculations || [];
      history.hidden = !calculations.length;
      const rows = calculations.map(calculation => {
        const row = document.createElement('li');
        row.textContent = `${euro.format(calculation.priceCents / 100)} · ${percent.format(calculation.discountBasisPoints / 100)} % → ${euro.format(discountResult(calculation).finalCents / 100)}`;
        return row;
      });
      history.querySelector('ol').replaceChildren(...rows);
    }
    showHistory(entries[0]);
    form.addEventListener('input', event => {
      event.target.setCustomValidity('');
      result.hidden = true;
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (saving || signal.aborted) return;
      const values = new FormData(form);
      let calculation;
      try { calculation = calculateDiscount(values.get('price'), values.get('discount')); }
      catch (error) {
        if (['price', 'discount'].includes(error.field)) {
          const field = form.elements.namedItem(error.field);
          field.setCustomValidity(error.message);
          field.reportValidity();
          field.focus();
        } else api.toast('Berechnung nicht möglich. Bitte erneut versuchen.');
        return;
      }
      saving = true;
      button.disabled = true;
      fields.forEach(field => { field.disabled = true; });
      try {
        const { entry, usageError } = await saveCalculation(api, calculation);
        if (signal.aborted) return;
        const amounts = discountResult(calculation);
        host.querySelector('#discountResult').textContent = euro.format(amounts.finalCents / 100);
        host.querySelector('#discountSavings').textContent = `${euro.format(amounts.savedCents / 100)} weniger`;
        showHistory(entry);
        result.hidden = false;
        host.querySelector('#discountResult').focus();
        if (usageError) api.toast('Berechnung gespeichert. „Zuletzt verwendet“ konnte nicht aktualisiert werden.');
      } catch (error) {
        if (!signal.aborted) api.toast(error.name === 'QuotaExceededError'
          ? 'Browser-Speicher voll. Berechnung konnte nicht gespeichert werden. Deine Eingabe bleibt erhalten.'
          : 'Berechnung konnte nicht gespeichert werden. Deine Eingabe bleibt erhalten. Bitte erneut versuchen.');
      } finally {
        saving = false;
        button.disabled = false;
        fields.forEach(field => { field.disabled = false; });
      }
    });
    form.elements.namedItem('price').focus();
    return () => { css.remove(); };
  }
};
