/* =====================================================================
   TUNING – zentrale Balance-Zahlen (Phase 0, #4).
   Alle Stellschrauben an EINEM Ort, damit Balancing ohne Logik-Eingriffe geht.
   ===================================================================== */
export const ASSETS = 'adventure/assets/';
export const SAVE_KEY = 'idleAbenteuer_v1';
export const SAVE_VERSION = 7;            // erhöht bei Strukturänderungen → Migration
export const MAX_CHARACTERS = 5;          // max. Charaktere je Spieler (Roster)
export const RESPEC_COST = 500;           // Goldkosten zum Zurücksetzen der Talente
export const VARIANTS = 6;                // Sprite-Varianten je Slot (= Item-Typen je Slot)
export const INV_SLOTS = 30;             // Inventar-Obergrenze (von 20 erhöht, mehr Grind-Platz)
export const HEAL_PCT = 0.5;             // Heiltrank stellt 50 % der maximalen HP wieder her
export const POTION_BASE_CHANCE = 0.20;  // Basis-Chance auf einen Heiltrank je Expedition
export const ITEMS_PER_EXPEDITION = 2;   // genau zwei Items pro Abenteuer

export const BASE_STAT = { armor: 6, damage: 8 };  // Basiswert je Stattyp
export const ILVL_K = 0.12;                         // Item-Level-Skalierung
// Sanfte Glättung (Teil 3): konvexer Zusatz zur Item-Level-Kurve, bei Zone 0 = 0.
// Hält den per-Zone-Zuwachs im Spätspiel hoch, ohne das frühe Spielgefühl zu ändern.
// Bewusst niedrig, damit Gear-Kampfkraft die recPower nur annähert (Grind nötig).
export const ILVL_QUAD = 0.30;

// ---- Kampf-Schwierigkeit (Phase 1, #6–#8) --------------------------
export const COMBAT = {
  heroBaseHp: 100,
  heroHpPerArmor: 4,
  heroBaseAtk: 5,
  heroBaseCrit: 0.05,
  heroBaseCritMult: 2.0,
  swingBaseMs: 750,
  swingMinMs: 220,
  armorReduction: 0.3,        // flache Schadensreduktion je Rüstungspunkt
  bossCritChance: 0.12,
  bossReplyMs: 360,           // Pause bis der Boss zurückschlägt
  // Soft-Enrage (#7): Ab dieser Runde eskaliert JEDER Boss → erzwingt Mindest-DPS.
  enrageTurn: 45,
  enrageRamp: 1.07,           // Boss-Angriff ×1,07 pro Runde nach dem Enrage
  // „enrage"-Mechanik: harter, früherer Enrage für ausgewählte Bosse.
  hardEnrageTurn: 22,
  hardEnrageRamp: 1.12,
};

// ---- Endlos-Skalierung (#14): gestaffelt statt global flach ---------
export const ENDLESS = {
  // Faktor pro Stufe jenseits des letzten definierten Bosses.
  hpFactor: 1.6,
  atkFactor: 1.55,
  powFactor: 1.6,
};

// ---- Farmen (#17): Wiederholungskämpfe geben weniger -----------------
export const FARM = {
  goldMult: 0.5,
  xpMult: 0.4,
  dropRarityDrop: 1,   // garantierter Drop eine Stufe niedriger als beim Erstkill
};
