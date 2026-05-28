// Gemeinsame XP-/Level-Engine.
// Wird in den <script type="module">-Blöcken der jeweiligen Seiten importiert
// (Muster wie savings-helper.js) und bekommt db + userKey als Parameter.

import { ref, get, set, remove, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

export const MAX_LEVEL    = 1000;
export const COIN_PER_LEVEL = 500;   // Münzen pro Level-Up = Level × COIN_PER_LEVEL

// XP-Werte je Aktion (einzige Pflegestelle).
export const XP_VALUES = {
  heart_batch10:       5,
  autoclick_batch100:  3,
  game_start:          5,
  game_win:           25,
  game_loss:          10,
  uno_call:            3,
  slot_spin:           1,
  slot_jackpot:      200,
  slot_bigwin:        30,
  farm_feed:           2,
  farm_beehive:       50,
  farm_animal_bought: 40,
  farm_harvest:        3,
  farm_bakery:         8,
  farm_weaving:        8,
  farm_forge:          8,
  farm_mine_ore:       5,
  farm_breeding:     200,
  booster_bought:    150,
  booster_used:      100,
  box_bought:         50,
  theme_bought:       75
};

// Anzeige-Overrides fürs XP-Info-Modal, wenn der echte XP-Wert variabel ist
// (z. B. abhängig von Wachstumszeit oder Bet-Multiplikator). Wird vom Modal
// bevorzugt vor `+XP_VALUES[k]` angezeigt.
export const XP_DISPLAY = {
  farm_harvest:  '1–24 (je 5 Min Wachstumszeit)',
  farm_breeding: '200–5000 (je nach Seltenheit)',
  slot_spin:    '1 × Bet-Multiplikator',
  slot_jackpot: '200 × Bet-Multiplikator',
  slot_bigwin:  '30 × Bet-Multiplikator'
};

// XP pro geernteter Pflanze, skaliert mit Wachstumszeit (1 XP je 5 Min,
// mindestens 1). Hält die Belohnung fair: Radieschen (5 Min) → 1 XP,
// Blaubeere (2 h) → 24 XP.
export function xpForHarvest(growTimeSec) {
  const sec = Number(growTimeSec) || 0;
  return Math.max(1, Math.round(sec / 300));
}

// Deutsche Anzeigetexte für das XP-Info-Modal.
export const XP_LABELS = {
  heart_batch10:      '10 Momenten Klicks',
  autoclick_batch100: 'Auto-Klicker (je 100 Klicks)',
  game_start:         'Spiel gestartet',
  game_win:           'Spiel gewonnen',
  game_loss:          'Spiel verloren',
  uno_call:           'UNO: „Uno"-Ruf (1 Karte übrig)',
  slot_spin:          'Slot: Spin',
  slot_jackpot:       'Slot: Jackpot',
  slot_bigwin:        'Slot: Big-Win (≥ 50× Bet)',
  farm_feed:          'Farm: Tier gefüttert',
  farm_beehive:       'Farm: Bienenstock abholen',
  farm_animal_bought: 'Farm: Tier gekauft',
  farm_harvest:       'Farm: Pflanze geerntet (je nach Wachstumszeit)',
  farm_bakery:        'Farm: Bäckerei abgeholt',
  farm_weaving:       'Farm: Weberei abgeholt',
  farm_forge:         'Farm: Schmiede abgeholt',
  farm_mine_ore:      'Farm: Erz aus Mine abgeholt',
  farm_breeding:      'Farm: Baby im Labor gezüchtet (je nach Seltenheit)',
  booster_bought:     'Booster gekauft',
  booster_used:       'Booster verwendet',
  box_bought:         'Box gekauft',
  theme_bought:       'Theme gekauft'
};

// Level-Meilenstein-Badges. IDs landen bei Claim in shop/{key}/badges.
export const LEVEL_BADGES = {
  5:    { id: 'level_5',    emoji: '🌱', name: 'Herzklicker',  rarity: 'bronze'    },
  10:   { id: 'level_10',   emoji: '💫', name: 'Abenteurer',   rarity: 'common'    },
  20:   { id: 'level_20',   emoji: '🎮', name: 'Spieler',      rarity: 'common'    },
  30:   { id: 'level_30',   emoji: '🌟', name: 'Enthusiast',        rarity: 'common'    },
  40:   { id: 'level_40',   emoji: '⚔️', name: 'Kriegerin',         rarity: 'rare'      },
  50:   { id: 'level_50',   emoji: '🏅', name: 'Veteran',           rarity: 'rare'      },
  60:   { id: 'level_60',   emoji: '🦊', name: 'Fuchsgeist',        rarity: 'rare'      },
  70:   { id: 'level_70',   emoji: '🌊', name: 'Wellenreiterin',    rarity: 'rare'      },
  75:   { id: 'level_75',   emoji: '💎', name: 'Meister',           rarity: 'rare'      },
  80:   { id: 'level_80',   emoji: '🦄', name: 'Einhornreiterin',   rarity: 'legendary' },
  90:   { id: 'level_90',   emoji: '🐉', name: 'Drachenzähmerin',   rarity: 'legendary' },
  100:  { id: 'level_100',  emoji: '👑', name: 'Profi',             rarity: 'rare'      },
  110:  { id: 'level_110',  emoji: '🎭', name: 'Maskerade',         rarity: 'legendary' },
  120:  { id: 'level_120',  emoji: '🗝️', name: 'Schlüsselhüterin', rarity: 'legendary' },
  130:  { id: 'level_130',  emoji: '⚜️', name: 'Adelige',           rarity: 'legendary' },
  140:  { id: 'level_140',  emoji: '🏰', name: 'Burgherrin',        rarity: 'legendary' },
  150:  { id: 'level_150',  emoji: '🔥', name: 'Champion',          rarity: 'legendary' },
  160:  { id: 'level_160',  emoji: '🌌', name: 'Galaxien-Wanderin', rarity: 'mythic'    },
  170:  { id: 'level_170',  emoji: '☄️', name: 'Sternenfall',       rarity: 'mythic'    },
  180:  { id: 'level_180',  emoji: '🔮', name: 'Orakel',            rarity: 'mythic'    },
  190:  { id: 'level_190',  emoji: '🪐', name: 'Planetenherrin',    rarity: 'mythic'    },
  200:  { id: 'level_200',  emoji: '⚡', name: 'Legende',           rarity: 'legendary' },
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
    // XP-Booster: aktiver Booster multipliziert das gewonnene XP. Vier Stufen
    // (+50% / +100% / +150% / +200%) teilen sich den Slot boosters/<key>/active_xp.
    // Legacy-Datensätze ohne `multiplier` werden als +50% interpretiert.
    let effectiveAmount = amount;
    try {
      const boost = (await get(ref(db, `boosters/${userKey}/active_xp`))).val();
      if (boost && boost.activatedAt && Date.now() < boost.activatedAt + (boost.durationMs || 0)) {
        const mult = (typeof boost.multiplier === 'number' && boost.multiplier > 0) ? boost.multiplier : 1.5;
        effectiveAmount = Math.round(amount * mult);
      }
    } catch (e) { /* Booster-Lookup optional – im Zweifel ohne Bonus weiter */ }
    const res = await runTransaction(ref(db, `xp/${userKey}/total`), cur => {
      oldTotal = Number(cur) || 0;
      return oldTotal + effectiveAmount;
    });
    const newTotal = (res && res.snapshot && res.snapshot.val()) || (oldTotal + effectiveAmount);
    const oldLevel = levelFromTotal(oldTotal);
    const newLevel = levelFromTotal(newTotal);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('xp:gained', {
        detail: { amount: effectiveAmount, boosted: effectiveAmount !== amount }
      }));
      if (newLevel > oldLevel) {
        for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
          window.dispatchEvent(new CustomEvent('xp:levelup', {
            detail: { newLevel: lvl, prevLevel: lvl - 1, finalLevel: newLevel }
          }));
        }
      }
    }
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
