// Isolated presentation fixtures. No app bootstrap, storage writes or worker registration.
import { renderNotes } from '../../src/read-views.js';
import { renderNote } from '../../src/note-views.js';

const params = new URLSearchParams(location.search);
const direction = ['a', 'b', 'c'].includes(params.get('direction')) ? params.get('direction') : 'a';
const screen = ['dashboard', 'pain', 'notes', 'detail'].includes(params.get('screen')) ? params.get('screen') : 'dashboard';
document.documentElement.dataset.direction = direction;
document.documentElement.dataset.screen = screen;
if (params.get('capture') === '1') {
  document.querySelector('.review-bar').hidden = true;
  document.documentElement.dataset.capture = 'true';
}
const href = (nextScreen, nextDirection = direction) => `?direction=${nextDirection}&screen=${nextScreen}`;
for (const link of document.querySelectorAll('[data-direction-link]')) {
  link.href = href(screen, link.dataset.directionLink);
  if (link.dataset.directionLink === direction) link.setAttribute('aria-current', 'page');
}
for (const link of document.querySelectorAll('[data-screen-link]')) {
  link.href = href(link.dataset.screenLink);
  if (link.dataset.screenLink === screen) link.setAttribute('aria-current', 'page');
}
document.querySelector('#brandButton').href = href('dashboard');
document.querySelector('#backButton').href = href(screen === 'detail' ? 'notes' : 'dashboard');
document.querySelector('#headerAction').href = href('notes');
document.querySelector('#backButton').hidden = screen === 'dashboard';
document.querySelector('#brandButton').hidden = screen !== 'dashboard';
document.querySelector('#focusTitle').textContent = { dashboard: '', pain: 'Schmerz', notes: 'Notizen', detail: 'Notiz' }[screen];
document.querySelector('#focusTitle').hidden = screen === 'dashboard';
document.title = `0815 · ${direction.toUpperCase()} · ${ { dashboard: 'Jetzt', pain: 'Schmerz', notes: 'Notizen', detail: 'Notizdetail' }[screen] }`;
const main = document.querySelector('#main');
const now = new Date();
const at = (offset, hour, minute) => {
  const date = new Date(now); date.setDate(date.getDate() + offset); date.setHours(hour, minute, 0, 0); return date.getTime();
};
const places = [{ id: 'home', name: 'Zuhause', latitude: 52.52, longitude: 13.405 }];
const notes = [
  { id: 'walk', type: 'note', text: 'Den langen Weg nach Hause nehmen.', createdAt: at(0, 16, 40), context: { timeBuckets: ['evening'], placeIds: ['home'] } },
  { id: 'dinner', type: 'note', text: 'Am Sonntag für alle kochen. Nicht viel planen. Ein großer Tisch reicht.', createdAt: at(0, 11, 25) },
  { id: 'quiet', type: 'note', text: 'Heute war der Kopf zum ersten Mal seit Tagen still. Vielleicht lag es am Spaziergang. Vielleicht daran, das Telefon zu Hause zu lassen.\n\nDas möchte ich öfter machen.', createdAt: at(-1, 18, 10) },
  { id: 'book', type: 'note', text: 'Das Buch mit den blauen Seiten wiederfinden.', createdAt: at(-1, 9, 15) }
];
const demo = label => {
  const status = document.querySelector('#studyStatus');
  status.textContent = `${label} · Designstudie, es werden keine Daten gespeichert.`;
  status.hidden = false;
};
if (screen === 'dashboard') {
  main.innerHTML = `<section id="view-dashboard" class="view" aria-labelledby="dashboardTitle">
    <h1 id="dashboardTitle" class="visually-hidden">Startseite</h1>
    <details class="home-accordion" open><summary>Jetzt</summary><div class="home-panel">
      <div id="nowRows" class="dashboard-rows">
        <button class="note-tile" type="button" data-note="walk"><span class="note-tile-heading"><span class="note-eyebrow">Notiz</span></span><strong class="note-text note-short">Den langen Weg nach Hause nehmen.</strong><span class="note-tile-context">Abends · Zuhause</span></button>
        <a class="helper-tile" data-helper="pain" href="${href('pain')}"><span class="tile-name">Schmerz</span><span class="tile-reason">Zuletzt verwendet</span><span class="tile-arrow" aria-hidden="true">↗</span></a>
        <button class="helper-tile" data-helper="drink" type="button" data-demo="Trinken"><span class="tile-name">Trinken</span><span class="tile-reason">Intervall erreicht</span><span class="tile-arrow" aria-hidden="true">↗</span></button>
        <button class="helper-tile" data-helper="discount" type="button" data-demo="Rabatt"><span class="tile-name">Rabatt</span><span class="tile-reason">Favorit</span><span class="tile-arrow" aria-hidden="true">↗</span></button>
      </div>
    </div></details>
    <details class="home-accordion"><summary>Favoriten</summary><div class="home-panel"><a class="list-link" href="${href('pain')}">Schmerz <span aria-hidden="true">↗</span></a></div></details>
    <details class="home-accordion"><summary>Alle Helfer</summary><div class="home-panel"><a class="list-link" href="${href('pain')}">Schmerz <span aria-hidden="true">↗</span></a><button class="list-link" type="button" data-demo="Trinken">Trinken</button><button class="list-link" type="button" data-demo="Rabatt">Rabatt</button></div></details>
  </section>`;
}
if (screen === 'pain') {
  // Mirrors pain-selected-area / painEntryForm / fieldset / radio labels from the live helper.
  // The output is the sole proposed DOM addition, a presentational value with no stored state.
  main.innerHTML = `<section id="view-helper" class="view focus-view" aria-label="Helfer"><div id="helperHost" class="focus-host"><section class="pain">
    <div class="pain-content"><div class="pain-selected-area"><strong>Rücken</strong><button class="quiet" type="button" data-demo="Ort ändern">Ort ändern</button></div>
    <form class="stack" id="painEntryForm"><fieldset aria-describedby="pain-scale"><legend tabindex="-1">Wie stark ist der Schmerz gerade?</legend>
    <p class="muted pain-question-hint">Wähle die Zahl, die gerade am ehesten passt.</p>
    <div class="pain-value"><output id="painValue" for="intensity-1 intensity-2 intensity-3 intensity-4 intensity-5 intensity-6 intensity-7 intensity-8 intensity-9 intensity-10" aria-live="off">4</output><span>von 10</span></div>
    <div class="pain-intensities">${Array.from({length:10}, (_,i) => `<label class="pain-choice pain-number"><input id="intensity-${i+1}" type="radio" name="intensity" value="${i+1}" ${i===3?'checked':''} required><span>${i+1}</span></label>`).join('')}</div>
    <p class="muted pain-hint" id="pain-scale">1 = wenig · 10 = sehr stark</p></fieldset>
    <div class="pain-actions"><button type="submit">Speichern</button><a class="quiet back-link" href="${href('dashboard')}">Zurück</a></div>
    </form></div></section></div></section>`;
  document.querySelector('#painEntryForm').addEventListener('change', event => { document.querySelector('#painValue').value = event.target.value; });
  document.querySelector('#painEntryForm').addEventListener('submit', event => { event.preventDefault(); demo('Speichern'); });
}
if (screen === 'notes') {
  main.innerHTML = `<section id="view-read" class="view focus-view" aria-labelledby="focusTitle"><div id="readHost" class="focus-host"></div></section>`;
  renderNotes(document.querySelector('#readHost'), notes, places);
}
if (screen === 'detail') {
  main.innerHTML = `<section id="view-note" class="view focus-view" aria-labelledby="focusTitle"><div id="noteHost" class="focus-host"></div></section>`;
  renderNote(document.querySelector('#noteHost'), notes[0], places, { edit: () => demo('Bearbeiten'), context: () => demo('Verknüpfung ändern'), remove: () => demo('Löschen') });
}
document.addEventListener('click', event => {
  if (event.target.closest('[data-note]')) location.href = href('detail');
  const trigger = event.target.closest('[data-demo]');
  if (trigger) demo(trigger.dataset.demo);
});
