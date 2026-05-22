// Gemeinsame XP-/Level-Engine.
// Wird in den <script type="module">-Blöcken der jeweiligen Seiten importiert
// (Muster wie savings-helper.js) und bekommt db + userKey als Parameter.

import { ref, get, set, remove, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

export const MAX_LEVEL    = 1000;
export const COIN_PER_LEVEL = 500;   // Münzen pro Level-Up = Level × COIN_PER_LEVEL

// XP-Werte je Aktion (einzige Pflegestelle).
export const XP_VALUES = {
  heart_batch10:      5,
  autoclick_batch100: 3,
  game_start:         5,
  game_win:          25,
  game_loss:         10,
  uno_call:           3,
  slot_spin:          1,
  slot_jackpot:      20,
  farm_feed:          2,
  farm_beehive:      15,
  quiz_correct:       5,
  quiz_perfect:      20,
  booster_bought:     5
};

// Deutsche Anzeigetexte für das XP-Info-Modal.
export const XP_LABELS = {
  heart_batch10:      '10 Herzklicks',
  autoclick_batch100: 'Auto-Klicker (je 100 Klicks)',
  game_start:         'Spiel gestartet',
  game_win:           'Spiel gewonnen',
  game_loss:          'Spiel verloren',
  uno_call:           'UNO: „Uno"-Ruf (1 Karte übrig)',
  slot_spin:          'Slot: Spin',
  slot_jackpot:       'Slot: Jackpot',
  farm_feed:          'Farm: Tier gefüttert',
  farm_beehive:       'Farm: Bienenstock abholen',
  quiz_correct:       'Quiz: richtige Antwort',
  quiz_perfect:       'Quiz: Perfektrunde',
  booster_bought:     'Booster gekauft'
};

// Level-Meilenstein-Badges. IDs landen bei Claim in shop/{key}/badges.
export const LEVEL_BADGES = {
  5:    { id: 'level_5',    emoji: '🌱', name: 'Herzklicker',  rarity: 'bronze'    },
  10:   { id: 'level_10',   emoji: '💫', name: 'Abenteurer',   rarity: 'common'    },
  20:   { id: 'level_20',   emoji: '🎮', name: 'Spieler',      rarity: 'common'    },
  30:   { id: 'level_30',   emoji: '🌟', name: 'Enthusiast',   rarity: 'common'    },
  50:   { id: 'level_50',   emoji: '🏅', name: 'Veteran',      rarity: 'rare'      },
  75:   { id: 'level_75',   emoji: '💎', name: 'Meister',      rarity: 'rare'      },
  100:  { id: 'level_100',  emoji: '👑', name: 'Profi',        rarity: 'rare'      },
  150:  { id: 'level_150',  emoji: '🔥', name: 'Champion',     rarity: 'legendary' },
  200:  { id: 'level_200',  emoji: '⚡', name: 'Legende',      rarity: 'legendary' },
  300:  { id: 'level_300',  emoji: '🌈', name: 'Auserwählter', rarity: 'legendary' },
  500:  { id: 'level_500',  emoji: '🦋', name: 'Transzendent', rarity: 'mythic'    },
  750:  { id: 'level_750',  emoji: '🌙', name: 'Mondgott',     rarity: 'mythic'    },
  1000: { id: 'level_1000', emoji: '✨', name: 'Ikone',        rarity: 'mythic'    }
};

// XP, die der Aufstieg VON Level n AUF n+1 kostet.
export function xpForLevel(n) {
  return Math.round(100 * Math.pow(n, 1.5) / 50) * 50;
}

// Aktuelles Level aus der Gesamt-XP.
export function levelFromTotal(totalXp) {
  const total = Number.isFinite(Number(totalXp)) ? Number(totalXp) : 0;
  let level = 1;
  let cumulative = 0;
  while (cumulative + xpForLevel(level) <= total) {
    cumulative += xpForLevel(level);
    level++;
    if (level >= MAX_LEVEL) break;
  }
  return level;
}

// XP-Fortschritt innerhalb des aktuellen Levels.
export function currentXpInLevel(totalXp, level) {
  const total = Number.isFinite(Number(totalXp)) ? Number(totalXp) : 0;
  let cumulative = 0;
  for (let i = 1; i < level; i++) cumulative += xpForLevel(i);
  return total - cumulative;
}

// Vergibt XP. Race-sicher via runTransaction. Liefert Level-Up-Info zurück,
// damit die aufrufende Seite einen Toast zeigen kann (rein kosmetisch).
export async function awardXp(db, userKey, amount) {
  if (!userKey || !amount || amount <= 0) {
    console.warn('XP: awardXp mit ungültigen Argumenten', { userKey, amount });
    return { leveledUp: false };
  }
  let oldTotal = 0;
  try {
    const res = await runTransaction(ref(db, `xp/${userKey}/total`), cur => {
      oldTotal = Number(cur) || 0;
      return oldTotal + amount;
    });
    const newTotal = (res && res.snapshot && res.snapshot.val()) || (oldTotal + amount);
    const oldLevel = levelFromTotal(oldTotal);
    const newLevel = levelFromTotal(newTotal);
    return { leveledUp: newLevel > oldLevel, oldLevel, newLevel };
  } catch (e) {
    console.warn('XP: awardXp fehlgeschlagen', e);
    return { leveledUp: false, error: true };
  }
}

// Erzeugt fehlende unclaimed-Belohnungseinträge. Nur auf dem EIGENEN Profil
// aufrufen. Idempotent: set() überschreibt identische Einträge gefahrlos.
// Liefert die neu freigeschalteten Level zurück.
export async function reconcileRewards(db, userKey) {
  if (!userKey) return [];
  try {
    const totalSnap = await get(ref(db, `xp/${userKey}/total`));
    const total = totalSnap.val() || 0;
    const deserved = levelFromTotal(total);
    const claimedSnap = await get(ref(db, `xp/${userKey}/claimedLevel`));
    const claimed = claimedSnap.val() || 1;
    if (deserved <= claimed) return [];
    const newLevels = [];
    for (let lvl = claimed + 1; lvl <= deserved; lvl++) {
      const badge = LEVEL_BADGES[lvl] || null;
      await set(ref(db, `xp/${userKey}/unclaimed/${lvl}`), {
        coins: lvl * COIN_PER_LEVEL,
        badgeId: badge ? badge.id : null
      });
      newLevels.push(lvl);
    }
    await set(ref(db, `xp/${userKey}/claimedLevel`), deserved);
    return newLevels;
  } catch (e) {
    console.warn('XP: reconcileRewards fehlgeschlagen', e);
    return [];
  }
}

// Holt eine einzelne Belohnung ab: Münzen gutschreiben, Badge anhängen,
// unclaimed-Eintrag entfernen. Atomar pro Teilschritt via runTransaction.
export async function claimReward(db, userKey, level, reward) {
  if (!userKey || !reward) return;
  const coins = reward.coins || 0;
  if (coins > 0) {
    await runTransaction(ref(db, `coins/${userKey}`), c => (c || 0) + coins);
    await runTransaction(ref(db, `stats/${userKey}/coinsEarned`), c => (c || 0) + coins);
  }
  if (reward.badgeId) {
    await runTransaction(ref(db, `shop/${userKey}/badges`), arr => {
      const list = Array.isArray(arr) ? arr.slice() : [];
      if (!list.includes(reward.badgeId)) list.push(reward.badgeId);
      return list;
    });
  }
  await remove(ref(db, `xp/${userKey}/unclaimed/${level}`));
}
