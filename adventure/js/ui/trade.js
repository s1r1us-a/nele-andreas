/* =====================================================================
   HANDEL-UI – WoW-artiges Handelsfenster im „Handel"-Tab (#view-trade).
   Zwei Angebotsspalten + eigenes Inventar zum Anbieten, Gebühr-Anzeige,
   „Bereit"/„Abbrechen". Reagiert live auf den Firebase-Trade-Knoten.
   ===================================================================== */
import { $, toast, fmtBig } from './dom.js';
import { state } from '../core/state.js';
import { isLocked, freeSlots, ensureItemSprite } from '../core/items.js';
import { getCoins } from '../core/coins.js';
import { rarityOf } from '../data/rarities.js';
import { bindTooltip, hideTooltip } from './tooltip.js';
import {
  watchPartnerPresence, partnerOnline, partnerKey, myKey,
  openTrade, listenTrade, setMyOffer, setAccept, cancelTrade,
  canAccept, feeFor, tradeData, FEE_PER_ITEM,
} from '../core/trade.js';

const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : '');
let _inited = false;
let _lastOpen = false;   // zum Erkennen eines abgeschlossenen/abgebrochenen Handels

export function initTradeTab(){
  if(_inited) return;
  _inited = true;
  watchPartnerPresence(() => { if(isTradeVisible()) renderTrade(); });
  listenTrade(onTradeUpdate);
}

function isTradeVisible(){
  const v = $('#view-trade');
  return v && v.classList.contains('active');
}

function onTradeUpdate(d){
  // Abschluss/Abbruch erkennen (war offen → jetzt weg/zu).
  const open = !!(d && d.open && !d.canceledBy);
  if(_lastOpen && !open){
    if(d && d.canceledBy && d.canceledBy !== myKey()) toast('✖️ Handel abgebrochen.');
    else if(!d) toast('✅ Handel abgeschlossen!');
  }
  _lastOpen = open;
  if(isTradeVisible()) renderTrade();
}

// Item-Objekt (ohne Sprite, aus dem Netz) → Anzeige-Sprite sicherstellen.
function withSprite(raw){
  const it = { ...raw };
  if(!it.sprite) ensureItemSprite(it);
  return it;
}

// Eine Item-Zelle in einen Container hängen (mit Tooltip + optional onClick).
function addCell(container, raw, onClick, extraCls){
  const it = withSprite(raw);
  const r = rarityOf(it.rarity);
  const cell = document.createElement('div');
  cell.className = 'trade-cell' + (extraCls ? ' ' + extraCls : '');
  cell.style.setProperty('--rc', r.color);
  cell.innerHTML = '<img src="' + it.sprite + '" alt="' + (it.name || '') + '">';
  bindTooltip(cell, it, { compare: true });
  if(onClick) cell.addEventListener('click', () => { hideTooltip(); onClick(it); });
  container.appendChild(cell);
}

export function renderTrade(){
  const panel = $('#tradePanel');
  if(!panel) return;
  const partner = cap(partnerKey());

  if(!state || !state.character){
    panel.innerHTML = '<div class="trade-empty">Erst einen Charakter im Dämmerpfad erstellen.</div>';
    return;
  }

  const d = tradeData();
  const open = !!(d && d.open && !d.canceledBy);
  const online = partnerOnline();

  // Noch kein offener Handel → Startbildschirm.
  if(!open){
    panel.innerHTML =
      '<div class="trade-wrap">' +
        '<div class="trade-head">🤝 Handel mit ' + partner +
          ' <span class="trade-presence ' + (online ? 'on' : 'off') + '">●</span>' +
          '<span class="trade-pres-txt">' + (online ? 'online' : 'offline') + '</span></div>' +
        '<div class="trade-start-box">' +
          (online
            ? '<p class="sub">Tauscht live Items aus eurem Inventar. Gebühr: <b>🪙 ' + fmtBig(FEE_PER_ITEM) +
              '</b> pro getauschtem Item – jeder zahlt die Summe.</p>' +
              '<button class="btn" id="tradeStartBtn">🤝 Handel starten</button>'
            : '<p class="sub">' + partner + ' ist gerade offline – Handel ist nur möglich, wenn beide online sind.</p>') +
        '</div>' +
      '</div>';
    const startBtn = $('#tradeStartBtn');
    if(startBtn) startBtn.addEventListener('click', async () => { await openTrade(); renderTrade(); });
    return;
  }

  const me = myKey(), other = partnerKey();
  const myOff = (d.offers && d.offers[me]) || { items: [], accepted: false };
  const theirOff = (d.offers && d.offers[other]) || { items: [], accepted: false };
  const myIds = (myOff.items || []).map(it => it.id);
  const fee = feeFor(d);
  const coins = getCoins();
  const acc = canAccept();

  panel.innerHTML =
    '<div class="trade-wrap">' +
      '<div class="trade-head">🤝 Handel mit ' + partner +
        ' <span class="trade-presence ' + (online ? 'on' : 'off') + '">●</span></div>' +
      '<div class="trade-cols">' +
        '<div class="trade-col' + (myOff.accepted ? ' accepted' : '') + '">' +
          '<h3>Dein Angebot ' + (myOff.accepted ? '<span class="trade-ok">✓ Bereit</span>' : '') + '</h3>' +
          '<div class="trade-offer" id="tradeMyOffer"></div></div>' +
        '<div class="trade-col' + (theirOff.accepted ? ' accepted' : '') + '">' +
          '<h3>' + partner + 's Angebot ' + (theirOff.accepted ? '<span class="trade-ok">✓ Bereit</span>' : '') + '</h3>' +
          '<div class="trade-offer" id="tradeTheirOffer"></div></div>' +
      '</div>' +
      '<div class="trade-fee">Gebühr: <b>🪙 ' + fmtBig(fee) + '</b> · Dein Guthaben: 🪙 ' + fmtBig(coins) + '</div>' +
      '<div class="trade-actions">' +
        '<button class="btn" id="tradeAcceptBtn"' + ((!acc.ok && !myOff.accepted) ? ' disabled' : '') + '>' +
          (myOff.accepted ? 'Bereit ✓ (zurücknehmen)' : 'Bereit!') + '</button>' +
        '<button class="btn ghost" id="tradeCancelBtn">Abbrechen</button>' +
      '</div>' +
      (!acc.ok && !myOff.accepted ? '<div class="trade-warn">' + acc.reason + '</div>' : '') +
      '<h3 class="trade-inv-title">Dein Inventar – antippen zum Anbieten</h3>' +
      '<div class="trade-inv" id="tradeInv"></div>' +
    '</div>';

  // Angebote füllen
  const myWrap = $('#tradeMyOffer'), theirWrap = $('#tradeTheirOffer');
  (myOff.items || []).forEach(it => addCell(myWrap, it, item => toggleOffer(myIds, item.id)));
  (theirOff.items || []).forEach(it => addCell(theirWrap, it, null));
  if(!(myOff.items || []).length) myWrap.innerHTML = '<div class="trade-hint">leer</div>';
  if(!(theirOff.items || []).length) theirWrap.innerHTML = '<div class="trade-hint">leer</div>';

  // Inventar (anbietbare Items)
  const invWrap = $('#tradeInv');
  const tradeable = state.inventory.filter(it => !isLocked(it.id));
  if(!tradeable.length) invWrap.innerHTML = '<div class="trade-hint">Keine handelbaren Items.</div>';
  tradeable.forEach(it => {
    const offered = myIds.includes(it.id);
    addCell(invWrap, it, item => toggleOffer(myIds, item.id), offered ? 'offered' : '');
  });

  $('#tradeAcceptBtn').addEventListener('click', () => {
    if(myOff.accepted){ setAccept(false); return; }
    const c = canAccept();
    if(!c.ok){ toast('⚠️ ' + c.reason); return; }
    setAccept(true);
  });
  $('#tradeCancelBtn').addEventListener('click', () => { cancelTrade(); });
}

function toggleOffer(currentIds, id){
  const set = new Set(currentIds);
  if(set.has(id)) set.delete(id); else set.add(id);
  setMyOffer([...set]);
}
