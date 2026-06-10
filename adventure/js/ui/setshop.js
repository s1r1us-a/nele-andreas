/* =====================================================================
   SET-HÄNDLER (Tab „⚜️ Sets"). Verkauft die 7 Teile des klassen-eigenen
   Sets gegen Tribut-Siegel (Sonderwährung, von Bossen gedroppt). Gekaufte
   Teile sind Legendär → in der Schmiede unbegrenzt aufwertbar.
   Reine UI – nutzt die isolierte Logik aus core/sets.js.
   ===================================================================== */
import { state } from '../core/state.js';
import { classOf, classLabelOf } from '../data/classes.js';
import { SLOTS, SLOT_ICON } from '../data/slots.js';
import { SET_SLOTS, SET_TOKEN, SET_TOKEN_CAP, setForClass, setPieceCost, setPieceName } from '../data/sets.js';
import { getSetTokens, buySetPiece, ownsSetPiece, activeSetInfo, previewSetPiece, setPieceIlvl } from '../core/sets.js';
import { shopWeaponsForClass } from '../data/shopweapons.js';
import { buyShopWeapon, ownsShopWeapon, previewShopWeapon } from '../core/shopweapons.js';
import { buildItemSVG, elementOf } from '../core/item-art.js';
import { AFFIX_DEFS } from '../data/affixes.js';
import { bindTooltip } from './tooltip.js';
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
      '<span class="ss-tokens'+(tokens>=SET_TOKEN_CAP?' ss-tokens-max':'')+'" title="Maximal '+SET_TOKEN_CAP+' Tribut-Siegel">'+SET_TOKEN.icon+' '+fmtBig(tokens)+' / '+SET_TOKEN_CAP+'</span>'+
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

    // Stats wie bei normalen Items anzeigen (Hover + Tap/Klick): Vorschau-Item
    // mit den deterministischen Werten – inkl. der festen Affixe, die man beim Kauf erhält.
    const preview = previewSetPiece(set.id, slotKey, setPieceIlvl(state));
    if(preview){
      const focus = AFFIX_DEFS[set.flavorAffix];
      const note = (focus ? '🎯 Fokus: '+focus.label+' · ' : '')+'⚜️ Feste Affixe';
      cell.classList.add('ss-has-tip');
      bindTooltip(cell, preview, { tap:true, note });
    }
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

  // ---- Spezial-Waffen-Bereich --------------------------------------
  // Klassengebundene Legendär-Waffen (Einmalkauf gegen Tribut-Siegel).
  const weapons = shopWeaponsForClass(classOf(state).id);
  if(weapons.length){
    const wHead = document.createElement('h3');
    wHead.className = 'setshop-weapons-head';
    wHead.innerHTML = '⚔️ Waffen';
    panel.appendChild(wHead);

    const wNote = document.createElement('p');
    wNote.className = 'forge-note';
    wNote.innerHTML = 'Legendäre Klassen-Waffen – einmalig gegen <b>Tribut-Siegel</b> erhältlich, '+
      'danach <b>unbegrenzt</b> in der Schmiede aufwertbar.';
    panel.appendChild(wNote);

    const wGrid = document.createElement('div');
    wGrid.className = 'setshop-grid';
    const wIlvl = setPieceIlvl(state);
    for(const def of weapons){
      const owned = ownsShopWeapon(state, def.key);
      const afford = tokens >= def.cost;
      const cell = document.createElement('div');
      cell.className = 'ss-item'+(owned?' owned':'');
      const sprite = buildItemSVG(def.art, def.variant|0, 'legendaer',
        (def.element==='ice'?'ice':'fire'), def.orb, def.material, null, null, def.special);
      let btn;
      if(owned) btn = '<button class="btn ghost" disabled>✓ Im Besitz</button>';
      else btn = '<button class="btn ss-buy-weapon" data-wkey="'+def.key+'"'+
                 (afford?'':' disabled style="opacity:.5;cursor:not-allowed"')+'>'+
                 SET_TOKEN.icon+' '+def.cost+' kaufen</button>';
      cell.innerHTML =
        '<div class="ss-icon"><img src="'+sprite+'" alt="'+def.name+'">'+
          '<span class="ss-slot-ic">'+(def.slotKey==='schild'?'🤚':'⚔️')+'</span></div>'+
        '<div class="ss-name">'+def.name+'</div>'+
        '<div class="ss-cost">'+(owned?'<span class="ss-have">erworben</span>':SET_TOKEN.icon+' '+def.cost+' '+SET_TOKEN.name)+'</div>'+
        btn;
      wGrid.appendChild(cell);

      const preview = previewShopWeapon(def, wIlvl);
      if(preview){ cell.classList.add('ss-has-tip'); bindTooltip(cell, preview, { tap:true, note:'⚔️ Feste Affixe' }); }
    }
    panel.appendChild(wGrid);

    wGrid.querySelectorAll('.ss-buy-weapon').forEach(b => b.addEventListener('click', async ()=>{
      b.disabled = true;
      const res = buyShopWeapon(b.dataset.wkey);
      if(res.ok){
        toast('⚔️ '+res.item.name+' erworben! Im Inventar bereit zum Anlegen.');
        const { renderAll } = await import('./render.js');
        renderAll();
      } else {
        if(res.reason === 'tokens') toast('⚜️ Nicht genug Tribut-Siegel.');
        else if(res.reason === 'owned') toast('Du besitzt diese Waffe bereits.');
        else if(res.reason === 'class') toast('Diese Waffe gehört einer anderen Klasse.');
        else toast('Kauf nicht möglich.');
        b.disabled = false;
      }
    }));
  }
}
