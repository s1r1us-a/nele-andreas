/* =====================================================================
   CHARAKTER-EDITOR: Geschlecht, Frisuren, Haarfarben.
   ===================================================================== */
export const GENDERS = [ { id:'w', label:'Weiblich', icon:'♀' }, { id:'m', label:'Männlich', icon:'♂' } ];
export const HAIR_STYLES = [
  { id:'kurz',          label:'Kurz' },
  { id:'lang',          label:'Lang' },
  { id:'dutt',          label:'Dutt' },
  { id:'pferdeschwanz', label:'Pferdeschwanz' },
  { id:'locken',        label:'Locken' },
  { id:'kahl',          label:'Glatze' },
];
export const HAIR_COLORS = [
  { label:'Blond',   color:'#f5d04a' },
  { label:'Braun',   color:'#6b3f1d' },
  { label:'Schwarz', color:'#1b1b22' },
  { label:'Rot',     color:'#c0392b' },
  { label:'Blau',    color:'#3b82f6' },
  { label:'Weiß',    color:'#eef0f5' },
  { label:'Pink',    color:'#f472b6' },
  { label:'Grün',    color:'#22c55e' },
  { label:'Lila',    color:'#a855f7' },
];
export const SKIN_TONES = [
  { label:'Hell',     color:'#f3d3b3' },
  { label:'Mittel',   color:'#e8b58a' },
  { label:'Gebräunt', color:'#c98a5b' },
  { label:'Dunkel',   color:'#8a5a3b' },
  { label:'Tief',     color:'#5e3a26' },
];
export const EYE_COLORS = [
  { label:'Braun', color:'#5b3a2e' },
  { label:'Blau',  color:'#3b6fa0' },
  { label:'Grün',  color:'#3f7a4e' },
  { label:'Grau',  color:'#5f6b73' },
];
export const SKIN_TONE = '#f0c9a8';  // Fallback für Altstände ohne skinTone
export const EYE_DEFAULT = '#5b3a2e';
export const DEFAULT_CHARACTER = { gender:'w', hairId:'lang', hairColor:'#f5d04a', skinTone:'#f3d3b3', eyeColor:'#5b3a2e' };
