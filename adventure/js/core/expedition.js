/* =====================================================================
   EXPEDITION (Abenteuer auf Zeit). Items werden beim Start gewürfelt
   (offline-sicher) und beim Abholen ins Inventar gelegt.
   ===================================================================== */
import { ITEMS_PER_EXPEDITION, POTION_BASE_CHANCE } from '../data/tuning.js';
import { rarityIndex } from '../data/rarities.js';
import { expeditionOf } from '../data/expeditions.js';
import { state, saveState } from './state.js';
import { rollItem, freeSlots, addLog, recordDrop } from './items.js';
import { gainXp } from './character.js';
import { toast } from '../ui/dom.js';
import { popFind } from '../ui/tooltip.js';
import { renderAll, flashFullBanner } from '../ui/render.js';
import { showRewardModal } from '../ui/modals.js';

export let findProgress = 0;
export function setFindProgress(v){ findProgress = v; }

export const expeditionActive = () => !!state.expedition;
export const expeditionReady  = () => !!state.expedition && Date.now() >= state.expedition.endsAt;

export function startExpedition(durKey){
  if(state.expedition) return;
  const exp = expeditionOf(durKey); if(!exp) return;
  const now = Date.now();
  const items = [];
  for(let i=0;i<ITEMS_PER_EXPEDITION;i++) items.push(rollItem(state.zone, exp.boost));
  state.expedition = { durKey, startedAt:now, endsAt:now + exp.ms, items };
  saveState(); renderAll();
}
export function cancelExpedition(){
  state.expedition = null;
  saveState(); renderAll();
}
export function collectExpedition(){
  if(!expeditionReady()) return;
  const items = state.expedition.items || [];
  if(freeSlots() < items.length){ flashFullBanner(); return; }
  const exp = expeditionOf(state.expedition.durKey);
  let xpGain = exp ? Math.round(16 + exp.boost*16) : 16;  // XP reduziert (Teil 3b)
  for(const it of items){
    state.inventory.push(it);
    addLog(it); recordDrop(it); popFind(it);
    state.totalFinds = (state.totalFinds||0) + 1;
    xpGain += rarityIndex(it.rarity)*3 + 2;
  }
  gainXp(xpGain);
  const potionChance = Math.min(0.6, POTION_BASE_CHANCE + (exp ? exp.boost*0.1 : 0));
  let potionGained = false;
  if(Math.random() < potionChance){ state.potions = (state.potions||0) + 1; potionGained = true; toast('🧪 Heiltrank gefunden!'); }
  state.zoneFinds = (state.zoneFinds||0) + items.length;
  state.stats.expeditionsDone++;
  const collected = items.slice();
  state.expedition = null;
  saveState(); renderAll();
  showRewardModal(collected, potionGained);
}
