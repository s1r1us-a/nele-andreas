/* =====================================================================
   ACCOUNT-XP-BRÜCKE.
   Leitet die im Abenteuer verdiente Charakter-XP zusätzlich an die
   projektweite Account-XP (xp/<userKey>/total) weiter – dieselbe Engine
   wie Farm/Slot/UNO. awardXp feuert 'xp:gained'/'xp:levelup', auf die das
   globale Floating-Modal (level-up-feedback.js) reagiert.
   ===================================================================== */
import { db, userKey } from './firebase.js';
import { awardXp } from '../../../xp-helper.js';

// Fire-and-forget: 1:1 dieselbe XP-Menge auch dem Account gutschreiben.
export function awardAccountXp(amount){
  amount = Math.round(amount || 0);
  if(!amount || amount <= 0 || !userKey) return;
  awardXp(db, userKey, amount).catch(()=>{});
}
