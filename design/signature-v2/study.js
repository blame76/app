// Presentation only: actual Notes renderers, static data, no storage or app bootstrap.
import { renderNotes } from '../../src/read-views.js';
import { renderNote } from '../../src/note-views.js';
import { noteTextClass } from '../../src/note-presentation.js';

const params = new URLSearchParams(location.search);
const direction = params.get('direction') === 'b' ? 'b' : 'a';
const screen = ['dashboard', 'notes', 'detail', 'pain'].includes(params.get('screen')) ? params.get('screen') : 'dashboard';
document.documentElement.dataset.direction = direction;
document.documentElement.dataset.screen = screen;
if (params.get('capture') === '1') document.documentElement.dataset.capture = 'true';
const href = (nextScreen, nextDirection = direction) => `?direction=${nextDirection}&screen=${nextScreen}`;
for (const link of document.querySelectorAll('[data-direction-link]')) {
  link.href = href(screen, link.dataset.directionLink);
  if (link.dataset.directionLink === direction) link.setAttribute('aria-current', 'page');
}
for (const link of document.querySelectorAll('[data-screen-link]')) {
  link.href = href(link.dataset.screenLink);
  if (link.dataset.screenLink === screen) link.setAttribute('aria-current', 'page');
}
const main = document.querySelector('#main');
document.querySelector('#brandButton').hidden = screen !== 'dashboard';
document.querySelector('#backButton').hidden = screen === 'dashboard';
document.querySelector('#focusTitle').hidden = screen === 'dashboard';
document.querySelector('#focusTitle').textContent = { dashboard: '', notes: 'Notizen', detail: 'Notiz', pain: 'Schmerz' }[screen];
document.querySelector('#helperSettingsButton').hidden = screen !== 'pain';
document.querySelector('.header-menu-wrap').hidden = screen === 'pain';
document.querySelector('#helperSettingsButton').onclick = () => demo('Helfer-Einstellungen');
document.querySelector('#brandButton').onclick = () => { location.href = href('dashboard'); };
document.querySelector('#backButton').onclick = () => { location.href = href(screen === 'detail' ? 'notes' : 'dashboard'); };
document.querySelector('#menuButton').onclick = () => { location.href = href('notes'); };
document.title = `0815 · Signature v2 ${direction.toUpperCase()} · ${screen}`;
const at = (day, hour, minute) => new Date(2026, 9, day, hour, minute).getTime();
const places = [{ id: 'home', name: 'Zuhause' }];
const notes = [
  { id: 'walk', type: 'note', text: 'Den langen Weg nach Hause nehmen.', createdAt: at(4, 16, 40), context: { timeBuckets: ['evening'], placeIds: ['home'] } },
  { id: 'dinner', type: 'note', text: 'Am Sonntag für alle kochen. Nicht viel planen. Ein großer Tisch reicht.', createdAt: at(4, 11, 25) },
  { id: 'quiet', type: 'note', text: 'Heute war der Kopf zum ersten Mal seit Tagen still. Vielleicht lag es am Spaziergang. Vielleicht daran, das Telefon zu Hause zu lassen.\n\nDas möchte ich öfter machen.', createdAt: at(3, 18, 10) },
  { id: 'book', type: 'note', text: 'Das Buch mit den blauen Seiten wiederfinden.', createdAt: at(3, 9, 15) }
];
const demo = label => {
  const status = document.querySelector('#studyStatus');
  status.textContent = `${label} · Designstudie, keine Speicherung.`;
  status.hidden = false;
};
if (screen === 'dashboard') {
  main.innerHTML = `<section id="view-dashboard" class="view" aria-labelledby="dashboardTitle">
    <h1 id="dashboardTitle" class="visually-hidden">Startseite</h1>
    <details class="home-accordion" open><summary>Jetzt</summary><div class="home-panel">
      <div id="nowRows" class="dashboard-rows">
        <button class="note-tile" type="button" data-note="walk"><span class="note-tile-heading"><span class="note-eyebrow">Notiz</span></span><strong class="${noteTextClass(notes[0].text)}">${notes[0].text}</strong><span class="note-tile-context">Abends · Zuhause</span></button>
        <button class="helper-tile" data-helper="pain" type="button"><strong>Schmerz</strong><span>Zuletzt verwendet</span></button>
        <button class="helper-tile" data-helper="drink" type="button" data-demo="Trinken"><strong>Trinken</strong><span>Intervall · 60 Min.</span></button>
        <button class="helper-tile" data-helper="discount" type="button" data-demo="Rabatt"><strong>Rabatt</strong><span>Abends</span></button>
      </div>
    </div></details>
    <details class="home-accordion"><summary>Favoriten</summary><div class="home-panel"><div class="tile-grid"><button class="helper-tile" data-helper="pain"><strong>Schmerz</strong></button></div></div></details>
    <details class="home-accordion"><summary>Alle Helfer</summary><div class="home-panel"><button class="helper-list-item" data-helper="pain"><span><strong>Schmerz</strong><small>Gesundheit</small></span><span aria-hidden="true">↗</span></button></div></details>
  </section>`;
}
if (screen === 'pain') {
  // Same fieldset, native radios and presentational output as the existing helper.
  main.innerHTML = `<section id="view-helper" class="view focus-view" aria-label="Helfer"><div id="helperHost" class="focus-host"><section class="pain"><div class="pain-content">
    <div class="pain-selected-area"><strong>Rücken</strong><button class="quiet" type="button" data-demo="Ort ändern">Ort ändern</button></div>
    <form class="stack" id="painEntryForm"><fieldset aria-describedby="pain-scale pain-intensity-hint"><legend tabindex="-1">Wie stark ist der Schmerz gerade?</legend>
      <p class="muted pain-question-hint" id="pain-intensity-hint">Wähle die Zahl, die gerade am ehesten passt.</p>
      <div class="pain-signature-value" aria-hidden="true"><output class="pain-value-number">4</output><span>von 10</span></div>
      <div class="pain-intensities">${Array.from({ length: 10 }, (_, i) => `<label class="pain-choice pain-number"><input type="radio" name="intensity" value="${i + 1}" ${i === 3 ? 'checked' : ''} required><span>${i + 1}</span></label>`).join('')}</div>
      <p class="muted pain-hint" id="pain-scale">1 = wenig · 10 = sehr stark</p>
    </fieldset><button type="submit">Speichern</button><button class="quiet" type="button" data-home>Zurück</button></form>
  </div></section></div></section>`;
  const form = document.querySelector('#painEntryForm');
  form.addEventListener('change', () => { form.querySelector('output').value = new FormData(form).get('intensity'); });
  form.addEventListener('submit', event => { event.preventDefault(); demo('Schmerz erfassen'); });
}
if (screen === 'notes') {
  main.innerHTML = '<section id="view-read" class="view focus-view"><div id="readHost" class="focus-host"></div></section>';
  renderNotes(document.querySelector('#readHost'), notes, places);
}
if (screen === 'detail') {
  main.innerHTML = '<section id="view-note" class="view focus-view"><div id="noteHost" class="focus-host"></div></section>';
  renderNote(document.querySelector('#noteHost'), notes[0], places, {
    edit: () => demo('Notiz bearbeiten'), context: () => demo('Verknüpfung ändern'), remove: () => demo('Notiz löschen')
  });
}
for (const button of document.querySelectorAll('[data-demo]')) button.onclick = () => demo(button.dataset.demo);
for (const button of document.querySelectorAll('[data-helper="pain"]')) button.onclick = () => { location.href = href('pain'); };
for (const button of document.querySelectorAll('[data-note]')) button.onclick = () => { location.href = href('detail'); };
for (const button of document.querySelectorAll('[data-home]')) button.onclick = () => { location.href = href('dashboard'); };
