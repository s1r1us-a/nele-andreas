/* =====================================================================
   STAT-ERKLÄRUNGEN – kurze Hilfetexte (als title-Tooltip & im Onboarding).
   Eine Quelle für alle Werte-Erklärungen, v.a. die Kampfkraft.
   ===================================================================== */
export const STAT_HELP = {
  kampfkraft:    'Kampfkraft: gewichtete Gesamtsumme all deiner Werte (Schaden, Rüstung, Krit, Tempo …). Eine einzige Vergleichszahl – steht sie über der empfohlenen Boss-Kampfkraft, hast du gute Chancen.',
  klasse:        'Klasse: bei der Erstellung gewählt und dauerhaft. Bestimmt tragbare Rüstung (Heiler=Stoff, Schurke=+Leder, Verteidiger=+Platte) und die Schadensschule (Heiler magisch, sonst physisch).',
  gegenstandsstufe: 'Gegenstandsstufe (Ø): Durchschnittliche Stufe deiner angelegten Items. Höhere Stufen = stärkere Grundwerte. Steigt mit dem Zonen-Fortschritt.',
  leben:         'Leben: Maximale Trefferpunkte im Bosskampf. Wächst durch Rüstung, Lebenspunkte-Affixe und dein Level.',
  schaden:       'Schaden: Grundschaden pro Treffer (vor Krit). Kommt von Waffe, Schaden-Affixen und Level.',
  dps:           'DPS: Schaden pro Sekunde – kombiniert Schaden, Krit und Angriffstempo. Die wichtigste Zahl gegen den Enrage-Timer der Bosse.',
  kritphys:      'Physischer Krit: Krit-Chance für physische Klassen (Schurke, Verteidiger). Wirkt nur, wenn deine Klasse physischen Schaden macht.',
  kritmagic:     'Magischer Krit: Krit-Chance für magische Klassen (Heiler). Wirkt nur, wenn deine Klasse magischen Schaden macht. Kommt vor allem von Stoffrüstung.',
  kritschaden:   'Krit-Schaden: Multiplikator eines kritischen Treffers (z.B. 200 % = doppelter Schaden).',
  angriffstempo: 'Angriffstempo: Wie oft du pro Sekunde zuschlägst. Mehr Tempo = mehr DPS.',
  ruestung:      'Rüstung: Senkt erlittenen Schaden pro Treffer und erhöht dein Leben.',
  schadensreduktion: 'Schadensreduktion: Fester Abzug vom Schaden jedes gegnerischen Treffers (aus Rüstung & Block).',
  lebensraub:    'Lebensraub: Heilt dich um einen Anteil des ausgeteilten Schadens.',
  ausweichen:    'Ausweichen: Chance, einem gegnerischen Treffer komplett auszuweichen.',
  vielseitigkeit:'Vielseitigkeit: Erhöht deinen Schaden (und wirkt leicht defensiv) – ein Allrounder-Wert.',
  dornen:        'Dornen: Reflektiert einen festen Schaden zurück, wenn du getroffen wirst.',
  block:         'Block: Zusätzlicher fester Schadensabzug pro gegnerischem Treffer.',
};

/* =====================================================================
   STAT_INFO – EINE Quelle pro Bundle-Wert (wie in recomputeTotals):
   { label, pct, help }. Verbindet Anzeige-Label (nutzerfreundlich),
   Format (Prozent/flach) und Erklärung. Genutzt von Talenten (auto-
   generierte Beschreibung) und der UI (Werte-Zeilen, Tooltips, Legende).
   pct stammt aus AFFIX_DEFS; Labels hier bewusst kurz/sprechend.
   ===================================================================== */
import { AFFIX_DEFS } from './affixes.js';
const _info = (key, label, helpKey) => ({
  label, pct: !!(AFFIX_DEFS[key] && AFFIX_DEFS[key].pct), help: STAT_HELP[helpKey] || '',
});
export const STAT_INFO = {
  damage:      _info('damage',      'Schaden',         'schaden'),
  maxHp:       _info('maxHp',       'Leben',           'leben'),
  armor:       _info('armor',       'Rüstung',         'ruestung'),
  critPhys:    _info('critPhys',    'Physischer Krit', 'kritphys'),
  critMagic:   _info('critMagic',   'Magischer Krit',  'kritmagic'),
  critDamage:  _info('critDamage',  'Krit-Schaden',    'kritschaden'),
  attackSpeed: _info('attackSpeed', 'Angriffstempo',   'angriffstempo'),
  lifesteal:   _info('lifesteal',   'Lebensraub',      'lebensraub'),
  dodge:       _info('dodge',       'Ausweichen',      'ausweichen'),
  versatility: _info('versatility', 'Vielseitigkeit',  'vielseitigkeit'),
  thorns:      _info('thorns',      'Dornen',          'dornen'),
  block:       _info('block',       'Block',           'block'),
};
