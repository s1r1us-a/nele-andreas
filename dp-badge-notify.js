/* =====================================================================
   DÄMMERPFAD BADGE-GEWINN-MODAL – selbst-injizierendes Overlay.
   Stellt window.dpBadgeNotify(def) bereit (Warteschlange für mehrere
   Badges nacheinander). def = { emoji, name, rarity, desc }.
   Eingebunden auf abenteuer.html und turm.html.
   Muster angelehnt an announcement.js / message-notify.js.
   ===================================================================== */
(function(){
  if(window.dpBadgeNotify) return;  // nur einmal initialisieren

  const RARITY = {
    bronze:    { label:'Bronze',    color:'#c8924f', glow:'rgba(200,146,79,.55)' },
    common:    { label:'Gewöhnlich',color:'#b8b8c4', glow:'rgba(184,184,196,.55)' },
    rare:      { label:'Selten',    color:'#5b8fe0', glow:'rgba(91,143,224,.6)' },
    legendary: { label:'Legendär',  color:'#f0962e', glow:'rgba(240,150,46,.6)' },
    mythic:    { label:'Mythisch',  color:'#c7a3ff', glow:'rgba(199,163,255,.65)' },
  };

  const css = `
  .dpb-overlay{position:fixed;inset:0;z-index:2000050;display:none;align-items:center;
    justify-content:center;padding:20px;background:rgba(8,6,14,.72);backdrop-filter:blur(5px);
    opacity:0;transition:opacity .2s ease;}
  .dpb-overlay.open{display:flex;opacity:1;}
  .dpb-card{position:relative;background:linear-gradient(180deg,#241d31,#1a1525);
    border:2px solid var(--dpb-color,#c7a3ff);border-radius:18px;padding:30px 26px 22px;
    max-width:380px;width:100%;text-align:center;
    box-shadow:0 0 0 1px rgba(255,255,255,.05),0 20px 60px rgba(0,0,0,.6),
      0 0 38px var(--dpb-glow,rgba(199,163,255,.55));
    transform:scale(.8);transition:transform .26s cubic-bezier(.22,1,.36,1);
    font-family:'Quicksand',system-ui,sans-serif;color:#e9e2d4;}
  .dpb-overlay.open .dpb-card{transform:scale(1);}
  .dpb-head{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#a99fb5;margin-bottom:6px;}
  .dpb-emoji{font-size:62px;line-height:1;margin:6px 0 10px;
    filter:drop-shadow(0 4px 12px var(--dpb-glow,rgba(199,163,255,.55)));
    animation:dpbPop .5s cubic-bezier(.22,1,.36,1) both;}
  .dpb-name{font-family:'Cinzel',serif;font-weight:700;font-size:22px;
    color:var(--dpb-color,#c7a3ff);margin-bottom:6px;}
  .dpb-desc{font-size:14px;color:#cfc6d6;line-height:1.45;margin-bottom:10px;}
  .dpb-rarity{display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;
    letter-spacing:.5px;padding:3px 12px;border-radius:999px;border:1px solid var(--dpb-color,#c7a3ff);
    color:var(--dpb-color,#c7a3ff);margin-bottom:20px;}
  .dpb-btn{font-family:'Cinzel',serif;font-weight:700;cursor:pointer;border:none;
    color:#1a1525;background:linear-gradient(180deg,#f2cd6b,#d4a84b);
    padding:11px 26px;border-radius:10px;box-shadow:0 2px 0 #8a6e2e;font-size:15px;}
  .dpb-btn:hover{filter:brightness(1.07);}
  @keyframes dpbPop{0%{transform:scale(.3) rotate(-12deg);opacity:0;}
    60%{transform:scale(1.15) rotate(4deg);}100%{transform:scale(1) rotate(0);opacity:1;}}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const ov = document.createElement('div');
  ov.className = 'dpb-overlay';
  ov.setAttribute('role','alertdialog');
  ov.setAttribute('aria-modal','true');
  ov.innerHTML =
    '<div class="dpb-card">'+
      '<div class="dpb-head">🌙 Badge gewonnen!</div>'+
      '<div class="dpb-emoji" id="dpbEmoji">🏅</div>'+
      '<div class="dpb-name" id="dpbName"></div>'+
      '<div class="dpb-desc" id="dpbDesc"></div>'+
      '<div class="dpb-rarity" id="dpbRarity"></div>'+
      '<div><button class="dpb-btn" id="dpbBtn">Super! ✨</button></div>'+
    '</div>';
  const attach = () => { document.body.appendChild(ov); };
  if(document.body) attach(); else document.addEventListener('DOMContentLoaded', attach);

  const queue = [];
  let showing = false;

  function render(def){
    const r = RARITY[def.rarity] || RARITY.common;
    const card = ov.querySelector('.dpb-card');
    card.style.setProperty('--dpb-color', r.color);
    card.style.setProperty('--dpb-glow', r.glow);
    ov.querySelector('#dpbEmoji').textContent  = def.emoji || '🏅';
    ov.querySelector('#dpbName').textContent    = def.name || 'Badge';
    ov.querySelector('#dpbDesc').textContent    = def.desc || '';
    ov.querySelector('#dpbRarity').textContent  = r.label;
    // Emoji-Pop-Animation neu auslösen.
    const em = ov.querySelector('#dpbEmoji');
    em.style.animation = 'none'; void em.offsetWidth; em.style.animation = '';
    ov.classList.add('open');
  }
  function next(){
    if(showing) return;
    const def = queue.shift();
    if(!def){ showing = false; return; }
    showing = true;
    render(def);
  }
  function close(){
    ov.classList.remove('open');
    setTimeout(()=>{ showing = false; next(); }, 200);
  }
  ov.querySelector('#dpbBtn').addEventListener('click', close);
  ov.addEventListener('click', e => { if(e.target === ov) close(); });

  window.dpBadgeNotify = function(def){
    if(!def) return;
    queue.push(def);
    if(!showing) next();
  };
})();
