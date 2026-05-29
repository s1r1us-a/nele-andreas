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
let toastTimer = null;
export function toast(msg){
  let el = $('#toast');
  if(!el){ el = document.createElement('div'); el.id='toast';
    el.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);'+
      'background:#0b0910;border:1px solid var(--gold-dim);color:var(--gold-hi);'+
      'padding:10px 18px;border-radius:10px;z-index:130;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.5);';
    document.body.appendChild(el); }
  el.textContent = msg; el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ el.style.transition='opacity .4s'; el.style.opacity='0'; }, 1800);
}
