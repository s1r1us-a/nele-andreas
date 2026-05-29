/* =====================================================================
   COINS – Anbindung an das globale Münz-System (/coins, /stats).
   ACHTUNG: Noch DEAKTIVIERT. Die Firebase-Logik steht bereits, wird aber
   erst ganz zum Schluss durch COINS_ENABLED = true scharf geschaltet.
   Solange das Flag false ist, sind alle Funktionen No-Ops und rühren
   weder /coins noch /stats an.
   ===================================================================== */
import { db, ref, runTransaction, userKey } from './firebase.js';

// Master-Schalter – bewusst noch aus (Coin-System kommt zum Schluss).
export const COINS_ENABLED = false;

// Münzen gutschreiben (+ Lebenszeit-Statistik). No-Op solange deaktiviert.
export async function awardCoins(amount){
  amount = Math.round(amount || 0);
  if(!COINS_ENABLED || !userKey || amount <= 0) return;
  await runTransaction(ref(db, `coins/${userKey}`),               c => (c || 0) + amount);
  await runTransaction(ref(db, `stats/${userKey}/coinsEarned`),   c => (c || 0) + amount);
}

// Münzen abziehen (+ Lebenszeit-Statistik). No-Op solange deaktiviert.
export async function spendCoins(amount){
  amount = Math.round(amount || 0);
  if(!COINS_ENABLED || !userKey || amount <= 0) return false;
  await runTransaction(ref(db, `coins/${userKey}`),             c => (c || 0) - amount);
  await runTransaction(ref(db, `stats/${userKey}/coinsSpent`),  c => (c || 0) + amount);
  return true;
}
