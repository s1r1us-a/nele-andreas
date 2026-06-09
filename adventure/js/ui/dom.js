/* =====================================================================
   DOM-HELFER: Selektor, Toast, Pop-ups, Formatierung.
   Keine Abhängigkeiten zu core/* → bricht potenzielle Zyklen.
   ===================================================================== */
export const $ = s => document.querySelector(s);
export const IS_TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

export function timeAgo(t){
  const s = Math.floor((Date.now()-t)/1000);
  if(s<60) return 'gerade'; if(s<3600) return Math.floor(s/60)+' Min';
  if(s<86400) return Math.floor(s/3600)+' Std'; return Math.floor(s/86400)+' T';
}
// mm:ss bzw. h:mm:ss aus Millisekunden
export function fmtRemain(ms){
  const s = Math.max(0, Math.ceil(ms/1000));
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  const pad = n => String(n).padStart(2,'0');
  return h>0 ? h+':'+pad(m)+':'+pad(sec) : m+':'+pad(sec);
}
export const fmtVal = (v, pct) => pct ? Math.round(v*100)+'%' : (''+v);
// Große Zahlen kompakt (1.2K / 3.4M / 5.6B) – für Boss-HP & Belohnungen.
export function fmtBig(n){
  n = Math.round(n);
  if(n >= 1e9) return (n/1e9).toFixed(n>=1e10?0:1).replace(/\.0$/,'')+'B';
  if(n >= 1e6) return (n/1e6).toFixed(n>=1e7?0:1).replace(/\.0$/,'')+'M';
  if(n >= 1e4) return (n/1e3).toFixed(0)+'K';
  return ''+n;
}

export function goldPop(x, y, text){
  const el = document.createElement('div');
  el.className = 'gold-pop'; el.textContent = text;
  el.style.left = (x-10)+'px'; el.style.top = (y-20)+'px';
  document.body.appendChild(el);
  setTimeout(()=> el.remove(), 1000);
}
// Spielinterner Bestätigungs-Dialog (ersetzt natives confirm()). Baut ein
// eigenes Overlay mit hohem z-index → liegt auch über offenen Modalen.
// Gibt ein Promise<boolean> zurück (true = bestätigt). title/body sind HTML –
// benutzergetragene Texte (z. B. Namen) müssen vom Aufrufer escaped werden.
export function confirmDialog({ title, body='', emoji='⚠️',
    confirmText='Bestätigen', cancelText='Abbrechen', danger=false } = {}){
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.className = 'cdlg-overlay';
    ov.innerHTML =
      '<div class="cdlg-card" role="alertdialog" aria-modal="true">'+
        '<div class="cdlg-emoji">'+emoji+'</div>'+
        '<div class="cdlg-title">'+(title||'')+'</div>'+
        (body ? '<div class="cdlg-body">'+body+'</div>' : '')+
        '<div class="cdlg-actions">'+
          '<button class="btn ghost" data-act="cancel">'+cancelText+'</button>'+
          '<button class="btn'+(danger?' danger':'')+'" data-act="ok">'+confirmText+'</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(()=> ov.classList.add('show'));
    const done = val => {
      document.removeEventListener('keydown', onKey);
      ov.classList.remove('show');
      setTimeout(()=> ov.remove(), 200);
      resolve(val);
    };
    const onKey = e => {
      if(e.key === 'Escape') done(false);
      else if(e.key === 'Enter') done(true);
    };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', e => { if(e.target === ov) done(false); });
    ov.querySelector('[data-act="cancel"]').addEventListener('click', ()=> done(false));
    ov.querySelector('[data-act="ok"]').addEventListener('click', ()=> done(true));
    ov.querySelector('[data-act="ok"]').focus();
  });
}
/* ---------------------------------------------------------------------
   Scroll-Sperre: Solange irgendein Overlay/Modal offen ist, darf die Seite
   im Hintergrund nicht scrollen. Zentral per MutationObserver, damit jedes
   Overlay (Modal, Charakter-Editor, Arena, Bestätigungs-Dialog) erfasst wird.
   --------------------------------------------------------------------- */
const OVERLAY_SELECTOR = '.overlay.show, .arena-overlay.show, .cdlg-overlay.show, .adv-intro-overlay:not(.fade-out)';
// Scroll-Position, die beim Sperren festgehalten wird. Der Body wird per
// position:fixed + top:-scrollY eingefroren (siehe CSS), damit die Seite beim
// Öffnen eines Modals NICHT nach oben springt; beim Entsperren wird genau
// hierher zurückgescrollt.
let _lockedScrollY = 0;
let _scrollLocked = false;
function refreshScrollLock(){
  const anyOpen = !!document.querySelector(OVERLAY_SELECTOR);
  if(anyOpen === _scrollLocked) return;   // kein Zustandswechsel → nichts tun
  if(anyOpen){
    _lockedScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.top = (-_lockedScrollY) + 'px';
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
  } else {
    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');
    document.body.style.top = '';
    window.scrollTo(0, _lockedScrollY);
  }
  _scrollLocked = anyOpen;
}
(function initScrollLock(){
  if(!document.body) { document.addEventListener('DOMContentLoaded', initScrollLock); return; }
  // Auswertung pro Frame bündeln: Kampf-VFX ändern viele Klassen – wir prüfen nur 1× je Frame.
  let queued = false;
  const schedule = () => {
    if(queued) return;
    queued = true;
    requestAnimationFrame(()=>{ queued = false; refreshScrollLock(); });
  };
  const obs = new MutationObserver(schedule);
  obs.observe(document.body, { subtree:true, childList:true, attributes:true, attributeFilter:['class'] });
  refreshScrollLock();
})();

let toastTimer = null;
export function toast(msg){
  let el = $('#toast');
  if(!el){ el = document.createElement('div'); el.id='toast';
    el.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);'+
      'background:#0b0910;border:1px solid var(--gold-dim);color:var(--gold-hi);'+
      'padding:10px 18px;border-radius:10px;z-index:130;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.5);'+
      // Rein informativ: darf darunterliegende Buttons NIE blockieren. Sonst
      // schluckt der ausgeblendete (opacity:0) Toast unten-mittig weiter Klicks
      // → „Buttons reagieren nach Bosskampf/Modalen erst nach ein paar Sekunden".
      'pointer-events:none;';
    document.body.appendChild(el); }
  el.textContent = msg; el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ el.style.transition='opacity .4s'; el.style.opacity='0'; }, 1800);
}
