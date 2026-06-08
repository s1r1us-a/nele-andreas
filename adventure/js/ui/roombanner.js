/* =====================================================================
   THEMED-ROOM-BANNER: wiederverwendbarer Banner-Builder, generalisiert aus
   dem Schmiede-Banner (forge.js). Erzeugt ein dekoratives Banner (großes
   Icon, Gradient-Titel, Untertitel, schwebende Partikel, optionaler Chip)
   und gibt das Element zurück – der Aufrufer hängt es ein (prepend/append).

   Die Optik (Farben/Stimmung) kommt komplett aus CSS-Variablen, die über die
   Theme-Klasse `room-theme-<theme>` am umschließenden Panel gesetzt werden.
   Keine Abhängigkeiten zu render.js/trade.js → keine Zyklen.
   ===================================================================== */

// Erlaubte Partikel-Stile (steuern nur eine Modifier-Klasse + Keyframes im CSS).
const PARTICLE_TYPES = new Set(['embers', 'motes', 'sparkle', 'none']);

// Statische Banner-Texte sind keine User-Eingaben → unkritisch. `chip.text`
// ist typischerweise eine fmtBig()-Zahl. Zur Sicherheit escapen wir trotzdem
// die dynamischen Textfelder (Titel/Untertitel/Chip) gegen versehentliches HTML.
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g,
  c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

/**
 * Baut ein themed Room-Banner und gibt das <div> zurück.
 * @param {object}  o
 * @param {string}  o.icon       Emoji für das große, glühende Icon.
 * @param {string}  o.title      Gradient-Titel.
 * @param {string}  o.sub        Untertitel (Versalien/Sperrung via CSS).
 * @param {string}  o.theme      Theme-Key (z. B. 'shop') → Klasse room-theme-<key>.
 * @param {string} [o.particles] 'embers' | 'motes' | 'sparkle' | 'none'.
 * @param {number} [o.count]     Anzahl Partikel-Spans (max 8 positioniert).
 * @param {?object}[o.chip]      { icon, text } für den rechten Chip, sonst null.
 * @returns {HTMLDivElement}
 */
export function buildRoomBanner({ icon = '', title = '', sub = '',
    theme = '', particles = 'embers', count = 6, chip = null } = {}){
  const ptype = PARTICLE_TYPES.has(particles) ? particles : 'embers';
  const n = Math.max(0, Math.min(8, count|0));

  const el = document.createElement('div');
  el.className = 'room-banner' + (theme ? ' room-theme-' + theme : '');

  const sparks = ptype === 'none' ? ''
    : '<div class="rb-particles rb-particles--' + ptype + '" aria-hidden="true">' +
        '<span></span>'.repeat(n) +
      '</div>';

  const chipHtml = chip
    ? '<span class="rb-chip">' + esc(chip.icon) + ' ' + esc(chip.text) + '</span>'
    : '';

  el.innerHTML =
    sparks +
    '<div class="rb-glow" aria-hidden="true"></div>' +
    '<div class="rb-row">' +
      '<span class="rb-icon">' + esc(icon) + '</span>' +
      '<div class="rb-titles">' +
        '<h2 class="rb-title">' + esc(title) + '</h2>' +
        '<div class="rb-sub">' + esc(sub) + '</div>' +
      '</div>' +
      chipHtml +
    '</div>';

  return el;
}

/**
 * Setzt die Themed-Room-Optik auf ein Panel (idempotent). Entfernt zuvor eine
 * evtl. andere room-theme-* Klasse, falls dasselbe Panel je das Theme wechselt.
 * @param {HTMLElement} panel
 * @param {string} theme  Theme-Key (z. B. 'shop').
 */
export function applyRoomTheme(panel, theme){
  if(!panel) return;
  panel.classList.add('room-panel');
  for(const c of [...panel.classList]){
    if(c.startsWith('room-theme-') && c !== 'room-theme-' + theme) panel.classList.remove(c);
  }
  if(theme) panel.classList.add('room-theme-' + theme);
}

/**
 * Stellt sicher, dass ein Panel die Room-Optik UND genau ein Banner als erstes
 * direktes Kind hat – ohne es bei jedem Render neu zu bauen (Animation würde
 * sonst neu starten). Für Panels, deren innerer Inhalt separat re-gerendert
 * wird (Charakter-Header, Talentbaum), während das Panel selbst bestehen bleibt.
 * @param {HTMLElement} panel
 * @param {string} theme
 * @param {object}  opts   Argumente für buildRoomBanner().
 */
export function ensureRoomBanner(panel, theme, opts){
  if(!panel) return;
  applyRoomTheme(panel, theme);
  if(!panel.querySelector(':scope > .room-banner')){
    panel.insertBefore(buildRoomBanner(opts), panel.firstChild);
  }
}
