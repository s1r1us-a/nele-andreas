/* =====================================================================
   SET-HÄNDLER (Tab „⚜️ Sets"). Verkauft die 7 Teile des klassen-eigenen
   Sets gegen Tribut-Siegel (Sonderwährung, von Bossen gedroppt). Gekaufte
   Teile sind Legendär → in der Schmiede unbegrenzt aufwertbar.
   Reine UI – nutzt die isolierte Logik aus core/sets.js.
   ===================================================================== */
import { state } from '../core/state.js';
import { classOf, classLabelOf } from '../data/classes.js';
import { SLOTS, SLOT_ICON } from '../data/slots.js';
import { SET_SLOTS, SET_TOKEN, setForClass, setPieceCost, setPieceName } from '../data/sets.js';
import { getSetTokens, buySetPiece, ownsSetPiece, activeSetInfo } from '../core/sets.js';
import { buildItemSVG, elementOf } from '../core/item-art.js';
import { $, fmtBig, toast } from './dom.js';

// Vorschau-Sprite eines Set-Teils (ohne ein echtes Item anzulegen).
function previewSprite(set, slotKey){
  return buildItemSVG(SLOTS[slotKey].art, SET_SLOTS.indexOf(slotKey), 'legendaer',
                      elementOf(SET_SLOTS.indexOf(slotKey)), null, set.material, null, set.themeKey);
}

// Ist das Teil bereits angelegt?
function isEquipped(setId, slotKey){
  return Object.values(state.equipped||{}).some(it => it && it.setId===setId && it.setSlot===slotKey);
}

export function renderSetShop(){
  const panel = $('#setShopPanel');
  if(!panel) return;
  panel.classList.add('setshop-room');
  panel.innerHTML = '';

  if(!state || !state.character){
    const hint = document.createElement('p');
    hint.className = 'inv-hint';
    hint.textContent = 'Erstelle zuerst einen Charakter, um dein Klassen-Set freizuschalten.';
    panel.appendChild(hint);
    return;
  }

  const set = setForClass(classOf(state).id);
  const tokens = getSetTokens();

  // ---- Banner -------------------------------------------------------
  const banner = document.createElement('div');
  banner.className = 'setshop-banner theme-'+(set ? set.themeKey : 'molten');
  banner.innerHTML =
    '<div class="ss-embers" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>'+
    '<div class="ss-row">'+
      '<span class="ss-crest">⚜️</span>'+
      '<div class="ss-titles"><h2 class="ss-title">Set-Händler</h2>'+
        '<div class="ss-sub">Tribut · Macht · Klassen-Sets</div></div>'+
      '<span class="ss-tokens">'+SET_TOKEN.icon+' '+fmtBig(tokens)+'</span>'+
    '</div>';
  panel.appendChild(banner);

  if(!set){
    const hint = document.createElement('p');
    hint.className = 'inv-hint';
    hint.textContent = 'Wähle zuerst eine Klasse, um dein Klassen-Set freizuschalten.';
    panel.appendChild(hint);
    return;
  }

  const note = document.createElement('p');
  note.className = 'forge-note';
  note.innerHTML = '⚜️ Sammle <b>Tribut-Siegel</b> durch Bosssiege und kaufe hier die 7 Teile des <b>'+set.name+
    '</b>-Sets deiner Klasse ('+classLabelOf(state)+'). Set-Teile sind <b>Legendär</b> – in der Schmiede '+
    '<b>unbegrenzt</b> aufwertbar.';
  panel.appendChild(note);

  // ---- Set-Boni-Übersicht ------------------------------------------
  const info = activeSetInfo(state);
  const bonusCard = document.createElement('div');
  bonusCard.className = 'setshop-bonus';
  bonusCard.innerHTML =
    '<div class="ssb-head" style="color:'+set.accent+'">'+set.name+
      ' <span class="ssb-count">'+info.count+' / '+SET_SLOTS.length+' Teile</span></div>'+
    '<div class="ssb-lore">'+set.lore+'</div>'+
    '<div class="ssb-list">'+ info.bonuses.map(bn =>
      '<div class="ssb-tier'+(bn.active?' active':'')+'">'+
        '<span class="ssb-need">('+bn.need+')</span> '+
        '<b>'+bn.name+'</b> – <span class="ssb-desc">'+bn.desc+'</span>'+
        (bn.active?'<span class="ssb-on">✓ aktiv</span>':'')+
      '</div>').join('')+
    '</div>';
  panel.appendChild(bonusCard);

  // ---- Set-Teile-Grid ----------------------------------------------
  const grid = document.createElement('div');
  grid.className = 'setshop-grid';
  for(const slotKey of SET_SLOTS){
    const owned = ownsSetPiece(state, set.id, slotKey);
    const equipped = isEquipped(set.id, slotKey);
    const cost = setPieceCost(slotKey);
    const afford = tokens >= cost;
    const cell = document.createElement('div');
    cell.className = 'ss-item'+(owned?' owned':'');
    let btn;
    if(equipped)   btn = '<button class="btn ghost" disabled>🎽 Angelegt</button>';
    else if(owned) btn = '<button class="btn ghost" disabled>✓ Im Besitz</button>';
    else btn = '<button class="btn ss-buy" data-slot="'+slotKey+'"'+(afford?'':' disabled style="opacity:.5;cursor:not-allowed"')+'>'+
               SET_TOKEN.icon+' '+cost+' kaufen</button>';
    cell.innerHTML =
      '<div class="ss-icon"><img src="'+previewSprite(set, slotKey)+'" alt="'+setPieceName(set, slotKey)+'">'+
        '<span class="ss-slot-ic">'+(SLOT_ICON[slotKey]||'')+'</span></div>'+
      '<div class="ss-name">'+(SLOTS[slotKey].base)+'</div>'+
      '<div class="ss-cost">'+(owned?'<span class="ss-have">erworben</span>':SET_TOKEN.icon+' '+cost+' '+SET_TOKEN.name)+'</div>'+
      btn;
    grid.appendChild(cell);
  }
  panel.appendChild(grid);

  grid.querySelectorAll('.ss-buy').forEach(b => b.addEventListener('click', async ()=>{
    b.disabled = true;
    const res = buySetPiece(b.dataset.slot);
    if(res.ok){
      toast('⚜️ '+res.item.name+' erworben! Im Inventar bereit zum Anlegen.');
      const { renderAll } = await import('./render.js');
      renderAll();
    } else {
      if(res.reason === 'tokens') toast('⚜️ Nicht genug Tribut-Siegel.');
      else if(res.reason === 'owned') toast('Du besitzt dieses Teil bereits.');
      else toast('Kauf nicht möglich.');
      b.disabled = false;
    }
  }));
}
