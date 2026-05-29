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
export const DEFAULT_CHARACTER = { gender:'w', hairId:'lang', hairColor:'#f5d04a' };
export const SKIN_TONE = '#f0c9a8';
