/* =====================================================================
   HANDEL – Live-Trade Nele ↔ Andreas (WoW-artiges Handelsfenster).
   Beide bieten Inventar-Items an; ändert jemand sein Angebot, werden
   beide „Bereit"-Häkchen zurückgesetzt. Erst wenn BEIDE bestätigen,
   kommt der Handel zustande. Gebühr: 10.000 × Gesamtzahl getauschter
   Items – JEDER Spieler zahlt diese Summe.
   Echtzeit über Firebase (trades/dp/<pairId>), Muster wie das Duell.
   Jeder Client wendet beim Abschluss nur SEINE Hälfte auf den eigenen
   Spielstand an → keine Fremd-Schreibzugriffe, symmetrisch & konsistent.
   ===================================================================== */
import { db, ref, get, set, update, remove, onValue, onDisconnect, userKey } from './firebase.js';
import { otherKey } from './duel.js';
import { state, nextItemId, saveState } from './state.js';
import { freeSlots, isLocked, ensureItemSprite } from './items.js';
import { getCoins, spendCoins } from './coins.js';
import { renderAll } from '../ui/render.js';

export const FEE_PER_ITEM = 10000;
const PRESENCE_STALE_MS = 60 * 1000;

export function pairId(){ return [userKey, otherKey()].sort().join('_'); }
const NODE = () => 'trades/dp/' + pairId();

// Item fürs Netzwerk verschlanken: Sprite ist deterministisch (id/variant/
// rarity/typ) und wird beim Empfang neu gebaut → nicht mitschicken.
function stripForWire(it){ const { sprite, ...rest } = it; return rest; }

let _unsub = null, _data = null, _cb = null, _settling = false, _appliedRev = -1;

export function tradeData(){ return _data; }
export const myKey = () => userKey;
export const partnerKey = () => otherKey();

// ---- Online-Status des Partners (presence/<key>) ----------------------
let _online = false, _presUnsub = null;
export function partnerOnline(){ return _online; }
export function watchPartnerPresence(cb){
  if(_presUnsub) return;
  _presUnsub = onValue(ref(db, 'presence/' + otherKey()), snap => {
    const d = snap.val();
    _online = !!(d && typeof d.ts === 'number' && (Date.now() - d.ts) < PRESENCE_STALE_MS && d.state !== 'offline');
    if(cb) cb(_online);
  });
}

// ---- Sitzung ----------------------------------------------------------
export async function openTrade(){
  const node = NODE();
  const snap = await get(ref(db, node));
  const cur = snap.val();
  if(!cur || !cur.open || cur.canceledBy){
    await set(ref(db, node), {
      open: true, rev: 0, updatedAt: Date.now(), openedBy: userKey,
      offers: { [userKey]: { items: [], materials: {}, accepted: false }, [otherKey()]: { items: [], materials: {}, accepted: false } },
      settle: { [userKey]: false, [otherKey()]: false },
      canceledBy: null,
    });
  }
  // Verbindungsverlust → Handel sauber abbrechen.
  try { onDisconnect(ref(db, node)).update({ open: false, canceledBy: userKey }); } catch(e){}
}

export function listenTrade(cb){
  _cb = cb;
  if(_unsub) return _unsub;
  _unsub = onValue(ref(db, NODE()), snap => {
    _data = snap.val();
    if(!_data){ _settling = false; _appliedRev = -1; }   // Sitzung weg → Guards zurücksetzen
    else if(_data.open && !_data.canceledBy) maybeSettle();
    if(_cb) _cb(_data);
  });
  return _unsub;
}

export function stopTrade(){
  if(_unsub){ _unsub(); _unsub = null; }
  _cb = null; _data = null; _settling = false; _appliedRev = -1;
}

const myOffer    = () => (_data && _data.offers && _data.offers[userKey])    || { items: [], accepted: false };
const theirOffer = () => (_data && _data.offers && _data.offers[otherKey()]) || { items: [], accepted: false };

export function feeFor(d){
  d = d || _data;
  if(!d || !d.offers) return 0;
  const a = ((d.offers[userKey]    || {}).items || []).length;
  const b = ((d.offers[otherKey()] || {}).items || []).length;
  return FEE_PER_ITEM * (a + b);
}

// Mein Angebot setzen (Item-IDs aus dem eigenen Inventar). Reset beider Häkchen.
export async function setMyOffer(itemIds){
  const items = [];
  for(const id of itemIds){
    const it = state.inventory.find(x => x.id === id);
    if(it && !isLocked(it.id)) items.push(stripForWire(it));
  }
  await update(ref(db, NODE()), {
    [`offers/${userKey}/items`]: items,
    [`offers/${userKey}/accepted`]: false,
    [`offers/${otherKey()}/accepted`]: false,
    rev: ((_data && _data.rev) || 0) + 1,
    updatedAt: Date.now(),
  });
}

// Angebotene Materialien einer Seite (Map key→Menge, nur >0).
const matsTotal = m => Object.values(m||{}).reduce((s,n)=> s + (Number(n)||0), 0);

// Mein Material-Angebot setzen (Map key→Menge). Reset beider Häkchen. Mengen
// werden defensiv auf den eigenen Bestand begrenzt; 0/Leeres entfällt.
export async function setMyMaterials(matsObj){
  const clean = {};
  const have = state.materials || {};
  for(const [k,v] of Object.entries(matsObj||{})){
    const n = Math.max(0, Math.min(Number(v)||0, have[k]||0));
    if(n > 0) clean[k] = n;
  }
  await update(ref(db, NODE()), {
    [`offers/${userKey}/materials`]: clean,
    [`offers/${userKey}/accepted`]: false,
    [`offers/${otherKey()}/accepted`]: false,
    rev: ((_data && _data.rev) || 0) + 1,
    updatedAt: Date.now(),
  });
}

// Prüfung vor „Bereit": bezahlbar + genug Inventarplatz + nicht leer.
export function canAccept(){
  if(!_data) return { ok: false, reason: 'Keine Sitzung' };
  const mine = myOffer().items || [], theirs = theirOffer().items || [];
  const myMats = matsTotal(myOffer().materials), theirMats = matsTotal(theirOffer().materials);
  if(mine.length === 0 && theirs.length === 0 && myMats === 0 && theirMats === 0)
    return { ok: false, reason: 'Leeres Angebot' };
  if(getCoins() < feeFor())                    return { ok: false, reason: 'Nicht genug Coins' };
  if(freeSlots() + mine.length < theirs.length) return { ok: false, reason: 'Inventar voll' };
  return { ok: true };
}

export async function setAccept(v){
  await update(ref(db, NODE()), {
    [`offers/${userKey}/accepted`]: !!v,
    updatedAt: Date.now(),
  });
}

export async function cancelTrade(){
  try { await update(ref(db, NODE()), { open: false, canceledBy: userKey, updatedAt: Date.now() }); } catch(e){}
}

// ---- Settlement: jeder Client wendet seine Hälfte genau einmal an -----
async function maybeSettle(){
  const d = _data;
  if(!d || !d.offers || _settling) return;
  const me = userKey, other = otherKey();
  const mine = d.offers[me] || {}, theirs = d.offers[other] || {};
  if(!mine.accepted || !theirs.accepted) return;

  // Beide fertig → Knoten aufräumen (egal wer zuletzt war).
  if(d.settle && d.settle[me] && d.settle[other]){
    try { await remove(ref(db, NODE())); } catch(e){}
    return;
  }
  if((d.settle && d.settle[me]) || _appliedRev === d.rev) return;  // schon angewandt

  _settling = true;
  const fee = feeFor(d);
  const paid = await spendCoins(fee);                 // atomar; scheitert ⇒ Abbruch
  if(!paid){
    _settling = false;
    try { await update(ref(db, NODE()), { open: false, canceledBy: me, updatedAt: Date.now() }); } catch(e){}
    return;
  }
  // Eigene angebotene Items entfernen …
  const giveIds = new Set((mine.items || []).map(it => it.id));
  state.inventory = state.inventory.filter(it => !giveIds.has(it.id));
  // … Items des anderen aufnehmen (neue lokale ID + Sprite neu bauen).
  for(const raw of (theirs.items || [])){
    const it = { ...raw };
    it.id = nextItemId();
    ensureItemSprite(it);
    state.inventory.push(it);
  }
  // Materialien verrechnen: eigene angebotene abziehen, fremde gutschreiben.
  if(!state.materials) state.materials = {};
  for(const [k,n] of Object.entries(mine.materials || {}))
    state.materials[k] = Math.max(0, (state.materials[k]||0) - (Number(n)||0));
  for(const [k,n] of Object.entries(theirs.materials || {}))
    state.materials[k] = (state.materials[k]||0) + (Number(n)||0);
  saveState();
  renderAll();          // Inventar/Stats sofort aktualisieren (nicht erst nach Reload).
  _appliedRev = d.rev;
  try { await update(ref(db, NODE()), { [`settle/${me}`]: true, updatedAt: Date.now() }); } catch(e){}
  if(d.settle && d.settle[other]){ try { await remove(ref(db, NODE())); } catch(e){} }
  _settling = false;
}
