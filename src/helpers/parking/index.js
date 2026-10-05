import { POSITION_ID, validateParkingEntry, saveParking } from './model.js';

const dateTime = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' });
const clockTime = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

export default {
  id: 'parking', label: 'Parken', category: 'Mobilität',
  validateEntry: validateParkingEntry,
  offlineAssets: ['./src/helpers/parking/model.js'],
  async mount({ root, api, signal }) {
    const entries = await api.listEntries();
    if (signal.aborted) return;
    entries.forEach(validateParkingEntry);
    let active = entries[0];
    let busy = false;
    const host = document.createElement('div');
    host.className = 'stack';
    root.append(host);

    async function perform(action) {
      if (busy || signal.aborted) return;
      busy = true;
      host.setAttribute('aria-busy', 'true');
      const controls = [...host.querySelectorAll('button, input, textarea')];
      controls.forEach(control => { control.disabled = true; });
      try { await action(); }
      catch {
        if (!signal.aborted) api.toast('Aktion nicht abgeschlossen. Vorhandener Parkplatz und Eingaben bleiben erhalten. Bitte erneut versuchen.');
      } finally {
        busy = false;
        host.removeAttribute('aria-busy');
        controls.forEach(control => { control.disabled = false; });
      }
    }

    function render() {
      host.innerHTML = `
        <h2 id="parkingTitle" class="section-title" tabindex="-1">${active ? 'Geparkt' : 'Parkplatz merken'}</h2>
        ${active ? '<p id="parkingSince"></p><p id="parkingNote" class="note-text"></p><button id="parkingShow" type="button" class="secondary">Parkplatz anzeigen</button><div id="parkingPosition" class="stack" hidden></div><button id="parkingEdit" type="button" class="secondary">Notiz bearbeiten</button>' : ''}
        <form id="parkingForm" class="stack">
          ${active ? '' : '<label>Notiz (optional)<textarea name="note" rows="2" maxlength="500" placeholder="Ebene 3 · Aufzug B"></textarea></label>'}
          <p id="parkingPrivacy" class="muted">Beim Parkplatz merken wird der Standort nur nach deiner Aktion abgefragt und lokal gespeichert. Dein Browser kann dafür einen Standortdienst des Herstellers verwenden.</p>
          <button type="submit" aria-describedby="parkingPrivacy">${active ? 'Parkplatz neu merken' : 'Parkplatz merken'}</button>
        </form>
        ${active ? '<button id="parkingDelete" type="button" class="quiet danger-text">Parkplatz löschen</button>' : ''}`;
      if (active) {
        const time = document.createElement('time');
        time.dateTime = new Date(active.createdAt).toISOString();
        time.title = dateTime.format(active.createdAt);
        time.textContent = `seit ${clockTime.format(active.createdAt)} · ${dateOnly.format(active.createdAt)}`;
        host.querySelector('#parkingSince').append(time);
        host.querySelector('#parkingNote').textContent = active.note || '';
        host.querySelector('#parkingShow').addEventListener('click', () => {
          const position = host.querySelector('#parkingPosition');
          position.hidden = false;
          position.textContent = `Breitengrad ${active.lat.toFixed(6)} · Längengrad ${active.lon.toFixed(6)}. Gemeldete Genauigkeit: etwa ${Math.round(active.accuracy)} Meter.`;
          position.tabIndex = -1;
          position.focus();
        });
        host.querySelector('#parkingEdit').addEventListener('click', edit);
        host.querySelector('#parkingDelete').addEventListener('click', () => perform(async () => {
          await api.deleteEntry(POSITION_ID);
          if (signal.aborted) return;
          active = undefined;
          render();
        }));
      }
      const form = host.querySelector('form');
      form.addEventListener('submit', event => {
        event.preventDefault();
        const note = active ? '' : form.elements.note.value;
        perform(async () => {
          let position;
          try { position = await api.getPosition(); }
          catch {
            if (!signal.aborted) api.toast('Standort nicht verfügbar. Bitte die Standortfreigabe im Browser prüfen. Dein bisheriger Parkplatz bleibt erhalten.');
            return;
          }
          if (signal.aborted) return;
          const result = await saveParking(api, position, note);
          if (signal.aborted) return;
          active = result.entry;
          render();
          if (result.usageError) api.toast('Parkplatz gespeichert. Der Nutzungszeitpunkt konnte nicht aktualisiert werden.');
        });
      });
      host.querySelector('#parkingTitle').focus();
    }

    function edit() {
      host.innerHTML = '<form class="stack"><label>Notiz<textarea name="note" rows="3" maxlength="500"></textarea></label><button type="submit">Notiz speichern</button><button id="parkingCancel" class="quiet" type="button">Abbrechen</button></form>';
      const form = host.querySelector('form');
      form.elements.note.value = active.note || '';
      form.elements.note.focus();
      api.setBackAction(() => { if (busy) return; render(); api.setBackAction(null); }, 'Parken');
      host.querySelector('#parkingCancel').addEventListener('click', () => api.goBack());
      form.addEventListener('submit', event => {
        event.preventDefault();
        const next = { ...active, note: form.elements.note.value.trim() };
        perform(async () => {
          const saved = await api.saveEntry(next);
          if (signal.aborted) return;
          active = saved;
          api.setBackAction(null);
          render();
        });
      });
    }
    render();
  }
};
