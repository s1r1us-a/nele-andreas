/* =====================================================================
   HANDEL-UI – WoW-artiges Handelsfenster im „Handel"-Tab (#view-trade).
   Zwei Angebotsspalten + eigenes Inventar zum Anbieten, Gebühr-Anzeige,
   „Bereit"/„Abbrechen". Reagiert live auf den Firebase-Trade-Knoten.
   ===================================================================== */
import { $, toast, fmtBig, confirmDialog } from './dom.js';
import { state } from '../core/state.js';
import { isLocked, freeSlots, ensureItemSprite } from '../core/items.js';
import { getCoins } from '../core/coins.js';
import { rarityOf } from '../data/rarities.js';
import { MATERIALS, MATERIAL_BY_KEY } from '../data/materials.js';
import { bindTooltip, hideTooltip } from './tooltip.js';
import {
  watchPartnerPresence, partnerOnline, partnerKey, myKey,
  openTrade, listenTrade, setMyOffer, setMyMaterials, setAccept, cancelTrade,
  canAccept, feeFor, tradeData, FEE_PER_ITEM,
} from '../core/trade.js';

const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : '');
let _inited = false;
let _lastOpen = false;   // zum Erkennen eines abgeschlossenen/abgebrochenen Handels
let _notifyOpen = false; // verhindert mehrfache Vorschlag-Modale für denselben Handel

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

// ---- Hinweis auf eingehenden Handel (Badge am Tab + Live-Modal) -------
function showTradeBadge(){ const b = $('#tradeBadge'); if(b) b.hidden = false; }
function hideTradeBadge(){ const b = $('#tradeBadge'); if(b) b.hidden = true; }

// Direkt zum Handel-Tab springen (klickt den vorhandenen Tab → switchTab).
function goToTrade(){
  hideTradeBadge();
  const tab = $('.tab[data-view="trade"]');
  if(tab) tab.click();
}

// Live-Modal „<Partner> hat einen Handel vorgeschlagen" mit Schließen / Zum Handel.
function notifyIncomingTrade(){
  if(_notifyOpen) return;
  _notifyOpen = true;
  confirmDialog({
    emoji: '🤝',
    title: cap(partnerKey()) + ' hat einen Handel vorgeschlagen',
    body: 'Möchtest du jetzt handeln?',
    confirmText: 'Zum Handel',
    cancelText: 'Schließen',
  }).then(ok => { _notifyOpen = false; if(ok) goToTrade(); });
}

function onTradeUpdate(d){
  const open = !!(d && d.open && !d.canceledBy);
  // Eingehenden Vorschlag des Partners erkennen (Übergang nach „offen").
  if(open && !_lastOpen && d.openedBy && d.openedBy === partnerKey()){
    showTradeBadge();
    if(!isTradeVisible()) notifyIncomingTrade();
  }
  // Abschluss/Abbruch erkennen (war offen → jetzt weg/zu).
  if(_lastOpen && !open){
    if(d && d.canceledBy && d.canceledBy !== myKey()) toast('✖️ Handel abgebrochen.');
    else if(!d) toast('✅ Handel abgeschlossen!');
    hideTradeBadge();
  }
  _lastOpen = open;
  if(isTradeVisible()){ hideTradeBadge(); renderTrade(); }
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
  hideTradeBadge();   // Tab ist offen → Hinweis nicht mehr nötig.
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
      '<h3 class="trade-inv-title">⚒️ Deine Materialien – Menge anbieten</h3>' +
      '<div class="trade-mats" id="tradeMats"></div>' +
    '</div>';

  // Angebote füllen (Items + Material-Chips)
  const myWrap = $('#tradeMyOffer'), theirWrap = $('#tradeTheirOffer');
  const myMats = myOff.materials || {}, theirMats = theirOff.materials || {};
  (myOff.items || []).forEach(it => addCell(myWrap, it, item => toggleOffer(myIds, item.id)));
  (theirOff.items || []).forEach(it => addCell(theirWrap, it, null));
  renderMatChips(myWrap, myMats);
  renderMatChips(theirWrap, theirMats);
  if(!(myOff.items || []).length && !matCount(myMats)) myWrap.innerHTML = '<div class="trade-hint">leer</div>';
  if(!(theirOff.items || []).length && !matCount(theirMats)) theirWrap.innerHTML = '<div class="trade-hint">leer</div>';

  // Inventar (anbietbare Items)
  const invWrap = $('#tradeInv');
  const tradeable = state.inventory.filter(it => !isLocked(it.id));
  if(!tradeable.length) invWrap.innerHTML = '<div class="trade-hint">Keine handelbaren Items.</div>';
  tradeable.forEach(it => {
    const offered = myIds.includes(it.id);
    addCell(invWrap, it, item => toggleOffer(myIds, item.id), offered ? 'offered' : '');
  });

  // Material-Picker (eigene Kategorie): pro Material eine Zeile mit −/Menge/+.
  const matsWrap = $('#tradeMats');
  let anyMat = false;
  MATERIALS.forEach(m => {
    const have = (state.materials && state.materials[m.key]) || 0;
    const offered = myMats[m.key] || 0;
    if(have <= 0 && offered <= 0) return;   // nichts anzubieten
    anyMat = true;
    const max = have;                        // Bestand wird erst beim Abschluss abgezogen
    const row = document.createElement('div');
    row.className = 'trade-mat-row';
    row.innerHTML =
      '<span class="tmr-icon">' + m.icon + '</span>' +
      '<span class="tmr-name">' + m.name + '</span>' +
      '<span class="tmr-have">Bestand: ' + fmtBig(have) + '</span>' +
      '<div class="tmr-step">' +
        '<button class="btn ghost tmr-minus"' + (offered<=0?' disabled':'') + '>−</button>' +
        '<span class="tmr-amt">' + offered + '</span>' +
        '<button class="btn ghost tmr-plus"' + (offered>=max?' disabled':'') + '>+</button>' +
      '</div>';
    const setAmt = n => { const next = { ...myMats }; if(n>0) next[m.key]=n; else delete next[m.key]; setMyMaterials(next); };
    row.querySelector('.tmr-minus').addEventListener('click', () => setAmt(Math.max(0, offered-1)));
    row.querySelector('.tmr-plus').addEventListener('click', () => setAmt(Math.min(max, offered+1)));
    matsWrap.appendChild(row);
  });
  if(!anyMat) matsWrap.innerHTML = '<div class="trade-hint">Keine Materialien zum Anbieten.</div>';

  $('#tradeAcceptBtn').addEventListener('click', () => {
    if(myOff.accepted){ setAccept(false); return; }
    const c = canAccept();
    if(!c.ok){ toast('⚠️ ' + c.reason); return; }
    setAccept(true);
  });
  $('#tradeCancelBtn').addEventListener('click', () => { cancelTrade(); });
}

// Anzahl angebotener Material-Einheiten (für Leer-Erkennung).
function matCount(matsObj){ return Object.values(matsObj||{}).reduce((s,n)=> s+(Number(n)||0), 0); }

// Angebotene Materialien als Chips in eine Angebotsspalte hängen.
function renderMatChips(wrap, matsObj){
  for(const [k,n] of Object.entries(matsObj||{})){
    const m = MATERIAL_BY_KEY[k]; if(!m || !n) continue;
    const chip = document.createElement('div');
    chip.className = 'trade-mat-chip';
    chip.title = m.name;
    chip.textContent = m.icon + ' ' + n;
    wrap.appendChild(chip);
  }
}

function toggleOffer(currentIds, id){
  const set = new Set(currentIds);
  if(set.has(id)) set.delete(id); else set.add(id);
  setMyOffer([...set]);
}
