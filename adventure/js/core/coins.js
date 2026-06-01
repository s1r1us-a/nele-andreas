/* =====================================================================
   COINS – Anbindung an das globale Münz-System (/coins, /stats).
   Das Abenteuer nutzt KEINE eigene Währung mehr: „Gold" ist vollständig
   durch das projektweite Münz-Wallet ersetzt (geteilt mit Farm/Slot/Shop).
     coins/<userKey>              – aktueller Münzstand
     stats/<userKey>/coinsEarned  – Lebenszeit verdient
     stats/<userKey>/coinsSpent   – Lebenszeit ausgegeben
   ===================================================================== */
import { db, ref, runTransaction, onValue, userKey } from './firebase.js';

// Master-Schalter. Scharf, sobald das Spiel ans Wallet angebunden ist.
export const COINS_ENABLED = true;

// Lokaler Live-Cache des Münzstands. Wird per watchCoins() aus Firebase
// gespiegelt und erlaubt synchrone Prüfungen (z. B. Respec/Wetteinsatz),
// ohne im UI-Pfad auf eine Transaktion warten zu müssen.
let _coins = 0;
export function getCoins(){ return _coins; }

// Live-Listener auf coins/<userKey>. cb(neuerStand) wird bei jeder Änderung
// aufgerufen (für die Topbar-Anzeige). Erst NACH initAuth() aufrufen.
export function watchCoins(cb){
  if(!userKey) return;
  onValue(ref(db, `coins/${userKey}`), snap => {
    _coins = Number(snap.val()) || 0;
    if(cb) cb(_coins);
  });
}

// Münzen gutschreiben (+ Lebenszeit-Statistik).
export async function awardCoins(amount){
  amount = Math.round(amount || 0);
  if(!COINS_ENABLED || !userKey || amount <= 0) return;
  await runTransaction(ref(db, `coins/${userKey}`),               c => (c || 0) + amount);
  await runTransaction(ref(db, `stats/${userKey}/coinsEarned`),   c => (c || 0) + amount);
}

// Münzen abziehen (+ Lebenszeit-Statistik). Bricht ab, wenn das Guthaben nicht
// reicht (Rückgabe false) – die „ausgegeben"-Statistik wächst nur bei echtem Abzug.
export async function spendCoins(amount){
  amount = Math.round(amount || 0);
  if(!COINS_ENABLED || !userKey || amount <= 0) return false;
  const res = await runTransaction(ref(db, `coins/${userKey}`), c => {
    c = c || 0;
    if(c < amount) return;        // Transaktion abbrechen → kein Abzug
    return c - amount;
  });
  if(!res || !res.committed) return false;   // nicht genug Münzen
  await runTransaction(ref(db, `stats/${userKey}/coinsSpent`),  c => (c || 0) + amount);
  return true;
}
