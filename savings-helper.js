import { ref, runTransaction, push } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { awardXp, XP_VALUES } from "./xp-helper.js";

const SPAR_RATE = 0.01;

export async function contributeToTopf(db, userKey, amount, quelle = 'unbekannt') {
  const beitrag = Math.floor(amount * SPAR_RATE);
  if (beitrag <= 0) return;
  try {
    await Promise.all([
      runTransaction(ref(db, 'savings/topf'), c => (c || 0) + beitrag),
      runTransaction(ref(db, 'savings/totalEver'), c => (c || 0) + beitrag)
    ]);
    await push(ref(db, 'savings/beitraege'), {
      von: userKey,
      ausgabe: amount,
      beitrag,
      quelle,
      sparRate: SPAR_RATE,
      timestamp: Date.now()
    });
    awardXp(db, userKey, XP_VALUES.savings_contrib);
  } catch (e) {
    console.warn('Sparschwein: Einzahlung fehlgeschlagen', e);
  }
}
