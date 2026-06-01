/* =====================================================================
   DÄMMERPFAD-BADGES – geteilter Katalog + Vergabe-Logik.
   Genutzt von: profil.html (Anzeige), index.html (Pillen-Lookup),
   adventure/js/core/badges.js (Vergabe im Spiel), turm.html (Turm-Badges).

   Datenmodell je Badge: { id, group, emoji, name, rarity, desc, test }
   - rarity: 'bronze' | 'common' | 'rare' | 'legendary' | 'mythic'
   - test(metrics): liefert true, wenn die Bedingung erfüllt ist.
   Speicherpfad der gewonnenen Badges: dammerpfad/<userKey>/badges/<id>
   ===================================================================== */

// Reihenfolge + Beschriftung der Untergruppen (für die Profil-Anzeige).
export const DP_GROUPS = [
  { key:'boss',    label:'Bosse',   emoji:'👑' },
  { key:'turm',    label:'Turm',    emoji:'🗼' },
  { key:'pvp',     label:'PvP',     emoji:'⚔️🆚' },
  { key:'sammeln', label:'Sammeln', emoji:'💎' },
];

export const DAMMERPFAD_BADGES = [
  // ---- Bosse 👑 -----------------------------------------------------
  { id:'dp_boss_first', group:'boss', emoji:'🗡️', name:'Erster Sieg',             rarity:'bronze',    desc:'Besiege deinen ersten Boss',                 test:m=>m.bossesBeaten>=1 },
  { id:'dp_zone_3',     group:'boss', emoji:'🌿', name:'Erste Schritte',          rarity:'bronze',    desc:'Erreiche Zone 3',                            test:m=>m.zone>=3 },
  { id:'dp_zone_5',     group:'boss', emoji:'🌲', name:'Waldläufer',              rarity:'common',    desc:'Erreiche Zone 5',                            test:m=>m.zone>=5 },
  { id:'dp_zone_8',     group:'boss', emoji:'🦇', name:'Höhlenforscher',          rarity:'common',    desc:'Erreiche Zone 8',                            test:m=>m.zone>=8 },
  { id:'dp_zone_10',    group:'boss', emoji:'🏔️', name:'Grenzgänger',             rarity:'rare',      desc:'Erreiche Zone 10',                           test:m=>m.zone>=10 },
  { id:'dp_zone_12',    group:'boss', emoji:'🌋', name:'Vulkanwanderer',          rarity:'rare',      desc:'Erreiche Zone 12',                           test:m=>m.zone>=12 },
  { id:'dp_zone_16',    group:'boss', emoji:'❄️', name:'Frostbezwinger',          rarity:'rare',      desc:'Erreiche Zone 16',                           test:m=>m.zone>=16 },
  { id:'dp_zone_20',    group:'boss', emoji:'🌑', name:'Schattenwandler',         rarity:'legendary', desc:'Erreiche Zone 20',                           test:m=>m.zone>=20 },
  { id:'dp_zone_28',    group:'boss', emoji:'🏜️', name:'Wüstensohn',              rarity:'legendary', desc:'Erreiche Zone 28',                           test:m=>m.zone>=28 },
  { id:'dp_zone_36',    group:'boss', emoji:'☁️', name:'Himmelsstürmer',          rarity:'legendary', desc:'Erreiche Zone 36',                           test:m=>m.zone>=36 },
  { id:'dp_zone_42',    group:'boss', emoji:'⭐', name:'Sternennarbe',            rarity:'mythic',    desc:'Erreiche Zone 42',                           test:m=>m.zone>=42 },
  { id:'dp_boss_all',   group:'boss', emoji:'👑', name:'Bezwinger der Dämmerung', rarity:'mythic',    desc:'Besiege alle Bosse (Zone 45)',               test:m=>m.zone>=45 },
  { id:'dp_endless',    group:'boss', emoji:'🌀', name:'Jenseits der Zeit',       rarity:'mythic',    desc:'Dringe in die endlosen Zonen vor (Zone 50)', test:m=>m.zone>=50 },
  { id:'dp_kills_10',   group:'boss', emoji:'⚔️', name:'Kämpfer',                 rarity:'common',    desc:'Besiege insgesamt 10 Bosse',                 test:m=>m.totalKills>=10 },
  { id:'dp_kills_50',   group:'boss', emoji:'🪓', name:'Schlächter',              rarity:'rare',      desc:'Besiege insgesamt 50 Bosse',                 test:m=>m.totalKills>=50 },
  { id:'dp_kills_150',  group:'boss', emoji:'💀', name:'Vernichter',              rarity:'legendary', desc:'Besiege insgesamt 150 Bosse',                test:m=>m.totalKills>=150 },
  { id:'dp_kills_500',  group:'boss', emoji:'☠️', name:'Legende des Schlachtfelds',rarity:'mythic',   desc:'Besiege insgesamt 500 Bosse',                test:m=>m.totalKills>=500 },
  { id:'dp_farm_50',    group:'boss', emoji:'↻',  name:'Farmer',                  rarity:'rare',      desc:'Farme 50 Bosse',                             test:m=>m.farmKills>=50 },
  { id:'dp_farm_200',   group:'boss', emoji:'🌾', name:'Erntemeister',            rarity:'legendary', desc:'Farme 200 Bosse',                            test:m=>m.farmKills>=200 },

  // ---- Turm 🗼 ------------------------------------------------------
  { id:'dp_turm_1',  group:'turm', emoji:'🚪', name:'Turmbesucher',         rarity:'bronze',    desc:'Räume Turm-Stockwerk 1',  test:m=>m.towerBest>=1 },
  { id:'dp_turm_3',  group:'turm', emoji:'🪜', name:'Kletterer',            rarity:'common',    desc:'Räume Stockwerk 3',       test:m=>m.towerBest>=3 },
  { id:'dp_turm_5',  group:'turm', emoji:'🧗', name:'Aufsteiger',           rarity:'common',    desc:'Räume Stockwerk 5',       test:m=>m.towerBest>=5 },
  { id:'dp_turm_8',  group:'turm', emoji:'🗼', name:'Turmbezwinger',        rarity:'rare',      desc:'Räume Stockwerk 8',       test:m=>m.towerBest>=8 },
  { id:'dp_turm_10', group:'turm', emoji:'🏯', name:'Höhenrausch',          rarity:'rare',      desc:'Räume Stockwerk 10',      test:m=>m.towerBest>=10 },
  { id:'dp_turm_12', group:'turm', emoji:'🌪️', name:'Schwindelfrei',        rarity:'rare',      desc:'Räume Stockwerk 12',      test:m=>m.towerBest>=12 },
  { id:'dp_turm_15', group:'turm', emoji:'🌫️', name:'Wolkenwandler',        rarity:'legendary', desc:'Räume Stockwerk 15',      test:m=>m.towerBest>=15 },
  { id:'dp_turm_18', group:'turm', emoji:'⚡', name:'Sturmreiter',          rarity:'legendary', desc:'Räume Stockwerk 18',      test:m=>m.towerBest>=18 },
  { id:'dp_turm_20', group:'turm', emoji:'🌌', name:'Spitze des Wahnsinns', rarity:'mythic',    desc:'Räume Stockwerk 20',      test:m=>m.towerBest>=20 },
  { id:'dp_turm_25', group:'turm', emoji:'♾️', name:'Endlos-Steiger',       rarity:'mythic',    desc:'Räume Stockwerk 25',      test:m=>m.towerBest>=25 },

  // ---- PvP ⚔️🆚 -----------------------------------------------------
  { id:'dp_pvp_play',  group:'pvp', emoji:'🤝', name:'Erste Begegnung',     rarity:'bronze',    desc:'Bestreite dein erstes Duell', test:m=>m.duelsPlayed>=1 },
  { id:'dp_pvp_first', group:'pvp', emoji:'🤺', name:'Herausforderer',      rarity:'bronze',    desc:'Gewinne dein erstes Duell',   test:m=>m.duelWins>=1 },
  { id:'dp_pvp_3',     group:'pvp', emoji:'🗡️', name:'Streithahn',          rarity:'common',    desc:'Gewinne 3 Duelle',            test:m=>m.duelWins>=3 },
  { id:'dp_pvp_5',     group:'pvp', emoji:'⚔️', name:'Duellant',            rarity:'common',    desc:'Gewinne 5 Duelle',            test:m=>m.duelWins>=5 },
  { id:'dp_pvp_10',    group:'pvp', emoji:'🛡️', name:'Gladiator',           rarity:'rare',      desc:'Gewinne 10 Duelle',           test:m=>m.duelWins>=10 },
  { id:'dp_pvp_20',    group:'pvp', emoji:'🏅', name:'Champion',            rarity:'rare',      desc:'Gewinne 20 Duelle',           test:m=>m.duelWins>=20 },
  { id:'dp_pvp_25',    group:'pvp', emoji:'👑', name:'Arena-Meister',       rarity:'legendary', desc:'Gewinne 25 Duelle',           test:m=>m.duelWins>=25 },
  { id:'dp_pvp_50',    group:'pvp', emoji:'🔥', name:'Unbesiegbar',         rarity:'legendary', desc:'Gewinne 50 Duelle',           test:m=>m.duelWins>=50 },
  { id:'dp_pvp_100',   group:'pvp', emoji:'🌟', name:'Legende der Arena',   rarity:'mythic',    desc:'Gewinne 100 Duelle',          test:m=>m.duelWins>=100 },

  // ---- Sammeln 💎 ---------------------------------------------------
  { id:'dp_level_10',   group:'sammeln', emoji:'🌱', name:'Lehrling',     rarity:'bronze',    desc:'Erreiche Heldenstufe 10',            test:m=>m.level>=10 },
  { id:'dp_level_25',   group:'sammeln', emoji:'⭐', name:'Erfahren',     rarity:'common',    desc:'Erreiche Heldenstufe 25',            test:m=>m.level>=25 },
  { id:'dp_level_50',   group:'sammeln', emoji:'🌟', name:'Veteran',      rarity:'rare',      desc:'Erreiche Heldenstufe 50',            test:m=>m.level>=50 },
  { id:'dp_level_75',   group:'sammeln', emoji:'💫', name:'Großmeister',  rarity:'legendary', desc:'Erreiche Heldenstufe 75',            test:m=>m.level>=75 },
  { id:'dp_level_100',  group:'sammeln', emoji:'✨', name:'Ikone',        rarity:'mythic',    desc:'Erreiche Heldenstufe 100',           test:m=>m.level>=100 },
  { id:'dp_exp_10',     group:'sammeln', emoji:'🧭', name:'Entdecker',    rarity:'common',    desc:'Schließe 10 Expeditionen ab',        test:m=>m.expeditionsDone>=10 },
  { id:'dp_exp_50',     group:'sammeln', emoji:'🗺️', name:'Weltenbummler',rarity:'rare',      desc:'Schließe 50 Expeditionen ab',        test:m=>m.expeditionsDone>=50 },
  { id:'dp_selten_20',  group:'sammeln', emoji:'🔵', name:'Sammler',      rarity:'common',    desc:'Finde 20 seltene Gegenstände',       test:m=>m.dropsSelten>=20 },
  { id:'dp_episch_10',  group:'sammeln', emoji:'🟣', name:'Kenner',       rarity:'rare',      desc:'Finde 10 epische Gegenstände',       test:m=>m.dropsEpisch>=10 },
  { id:'dp_legend_5',   group:'sammeln', emoji:'🟧', name:'Schatzjäger',  rarity:'rare',      desc:'Finde 5 legendäre Gegenstände',      test:m=>m.dropsLegendaer>=5 },
  { id:'dp_legend_25',  group:'sammeln', emoji:'🏆', name:'Hortmeister',  rarity:'legendary', desc:'Finde 25 legendäre Gegenstände',     test:m=>m.dropsLegendaer>=25 },
  { id:'dp_mythic_1',   group:'sammeln', emoji:'🌈', name:'Mythenfund',   rarity:'legendary', desc:'Finde einen mythischen Gegenstand',  test:m=>m.dropsMythisch>=1 },
  { id:'dp_mythic_10',  group:'sammeln', emoji:'💠', name:'Mythensammler',rarity:'mythic',    desc:'Finde 10 mythische Gegenstände',     test:m=>m.dropsMythisch>=10 },
  { id:'dp_gold_10k',   group:'sammeln', emoji:'💰', name:'Sparfuchs',    rarity:'common',    desc:'Verdiene insgesamt 10.000 Münzen',   test:m=>m.goldEarned>=10000 },
  { id:'dp_gold_100k',  group:'sammeln', emoji:'🪙', name:'Goldgräber',   rarity:'rare',      desc:'Verdiene insgesamt 100.000 Münzen',  test:m=>m.goldEarned>=100000 },
  { id:'dp_gold_1m',    group:'sammeln', emoji:'🤑', name:'Krösus',       rarity:'legendary', desc:'Verdiene insgesamt 1.000.000 Münzen',test:m=>m.goldEarned>=1000000 },
  { id:'dp_days_7',     group:'sammeln', emoji:'📅', name:'Stammgast',    rarity:'common',    desc:'Spiele an 7 verschiedenen Tagen',    test:m=>m.daysPlayed>=7 },
  { id:'dp_days_30',    group:'sammeln', emoji:'🗓️', name:'Treue Seele',  rarity:'legendary', desc:'Spiele an 30 verschiedenen Tagen',   test:m=>m.daysPlayed>=30 },
];

export const DP_BADGE_BY_ID = Object.fromEntries(DAMMERPFAD_BADGES.map(b => [b.id, b]));

// Defensive Metrik-Normalisierung: fehlende Felder = 0.
function norm(m){
  m = m || {};
  const n = {};
  for(const k of ['zone','bossesBeaten','totalKills','farmKills','duelWins',
    'duelsPlayed','towerBest','level','goldEarned','expeditionsDone',
    'dropsSelten','dropsEpisch','dropsLegendaer','dropsMythisch','daysPlayed']){
    n[k] = Number(m[k]) || 0;
  }
  return n;
}

// IDs aller laut Metriken verdienten Badges.
export function earnedBadgeIds(metrics){
  const m = norm(metrics);
  return DAMMERPFAD_BADGES.filter(b => { try { return b.test(m); } catch { return false; } }).map(b => b.id);
}

// Idempotente Vergabe. Firebase-Funktionen werden injiziert, da Abenteuer-Spiel
// und Profilseite unterschiedliche DB-Instanzen nutzen. notify(def) zeigt das
// Gewinn-Modal (oder null = stumm, z. B. beim nachträglichen Verbuchen).
// Gibt die Liste der NEU vergebenen Badge-Definitionen zurück.
export async function grantDammerpfadBadges(metrics, { db, ref, get, set, userKey, notify } = {}){
  if(!db || !ref || !get || !set || !userKey) return [];
  const newly = [];
  for(const id of earnedBadgeIds(metrics)){
    try {
      const r = ref(db, `dammerpfad/${userKey}/badges/${id}`);
      const snap = await get(r);
      if(snap.exists()) continue;
      const def = DP_BADGE_BY_ID[id];
      await set(r, { unlockedAt: Date.now(), name: def.name, rarity: def.rarity, source: 'dammerpfad' });
      newly.push(def);
    } catch { /* einzelne Schreibfehler ignorieren */ }
  }
  if(notify && typeof notify === 'function') newly.forEach(def => { try { notify(def); } catch {} });
  return newly;
}
