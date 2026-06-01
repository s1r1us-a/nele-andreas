/* =====================================================================
   DÄMMERPFAD-BADGES – Brücke vom Spielzustand zur Vergabe.
   Baut aus dem aktiven Charakter-State die Metriken und ruft die
   geteilte (idempotente) Vergabe-Logik auf. Das Gewinn-Modal kommt aus
   dp-badge-notify.js (window.dpBadgeNotify), das in abenteuer.html
   eingebunden ist.
   ===================================================================== */
import { db, ref, get, set, userKey } from './firebase.js';
import { state } from './state.js';
import { grantDammerpfadBadges } from '../../../dammerpfad-badges.js';

// loud=true → Gewinn-Modal anzeigen (laufendes Spiel); loud=false → stiller
// Nachtrag bereits verdienter Badges (z. B. einmalig nach dem Laden).
export function checkAdventureBadges(loud = true){
  if(!userKey || !state) return;
  const s = state.stats || {}, d = s.drops || {};
  const metrics = {
    zone: state.zone || 0,
    bossesBeaten: state.bossesBeaten || 0,
    totalKills: (s.bossKills || 0) + (s.farmKills || 0),
    farmKills: s.farmKills || 0,
    duelWins: s.duelWins || 0,
    duelsPlayed: (s.duelWins || 0) + (s.duelLosses || 0),
    level: state.level || 1,
    goldEarned: s.goldEarned || 0,
    expeditionsDone: s.expeditionsDone || 0,
    dropsSelten: d.selten || 0,
    dropsEpisch: d.episch || 0,
    dropsLegendaer: d.legendaer || 0,
    dropsMythisch: d.mythisch || 0,
    daysPlayed: Math.floor((Date.now() - (s.createdAt || Date.now())) / 86400000),
    // towerBest wird im Abenteuer nicht getrackt → Turm-Badges vergibt turm.html.
  };
  const notify = loud && typeof window !== 'undefined' && window.dpBadgeNotify
    ? window.dpBadgeNotify : null;
  grantDammerpfadBadges(metrics, { db, ref, get, set, userKey, notify }).catch(()=>{});
}
