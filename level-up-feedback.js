// Globales Feedback für XP-Events.
// Hört auf 'xp:gained' (Floating-Text) und 'xp:levelup' (Fullscreen-Modal),
// die in xp-helper.js dispatched werden. Diese Datei wird auf JEDER Seite
// importiert, die XP vergibt oder anzeigt - registriert sich selbst.

const STYLE_TAG_ID = '__levelup_feedback_styles__';
const STYLES = `
@keyframes xpFloatUp {
  0%   { transform: translate(calc(-50% + var(--drift, 0px)), -92%)  scale(0.55) rotate(var(--rot, 0deg)); opacity: 0; }
  20%  { transform: translate(calc(-50% + var(--drift, 0px)), -118%) scale(1.18) rotate(calc(var(--rot, 0deg) * 0.4)); opacity: 1; }
  80%  { transform: translate(calc(-50% + var(--drift, 0px)), -180%) scale(1)    rotate(0deg); opacity: 1; }
  100% { transform: translate(calc(-50% + var(--drift, 0px)), -240%) scale(0.9)  rotate(0deg); opacity: 0; }
}
@keyframes xpSparkle {
  0%   { transform: scale(0)   rotate(0deg);   opacity: 0; }
  30%  { transform: scale(1.4) rotate(90deg);  opacity: 1; }
  70%  { transform: scale(1)   rotate(180deg); opacity: 1; }
  100% { transform: scale(0)   rotate(270deg); opacity: 0; }
}
.xp-float {
  position: fixed;
  z-index: 2147483000;
  pointer-events: none;
  font-family: 'Quicksand', system-ui, sans-serif;
  font-weight: 800;
  font-size: 20px;
  padding: 6px 14px;
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(135deg, #ec4899, #f5a3b5);
  box-shadow: 0 4px 14px rgba(236,72,153,0.45), 0 0 22px rgba(255,138,198,0.45);
  text-shadow: 0 1px 2px rgba(0,0,0,0.25);
  animation: xpFloatUp 1.2s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
  white-space: nowrap;
  will-change: transform, opacity;
  transform: translate(-50%, -100%);
}
.xp-float.boosted {
  background: linear-gradient(135deg, #fbbf24, #f59e0b, #fde047);
  color: #4a2e00;
  box-shadow: 0 4px 18px rgba(251,191,36,0.6), 0 0 28px rgba(253,224,71,0.6);
  text-shadow: 0 1px 1px rgba(255,255,255,0.5);
}
.xp-float.boosted::before {
  content: '✨';
  position: absolute;
  top: -14px;
  right: -10px;
  font-size: 18px;
  animation: xpSparkle 1.2s ease-out forwards;
  pointer-events: none;
  filter: drop-shadow(0 0 6px rgba(253,224,71,0.85));
  transform-origin: center;
}
@keyframes levelupOverlayIn  { from { opacity: 0; } to { opacity: 1; } }
@keyframes levelupOverlayOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes levelupCardIn {
  0%   { transform: scale(0.6) translateY(40px); opacity: 0; }
  60%  { transform: scale(1.06) translateY(-8px); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
@keyframes levelupCardFloat {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}
@keyframes levelupBannerHolo {
  0%   { background-position: 0% 50%; filter: hue-rotate(0deg); }
  100% { background-position: 300% 50%; filter: hue-rotate(40deg); }
}
@keyframes levelupBannerPulse {
  0%, 100% { transform: scale(1); text-shadow: 0 0 24px rgba(255,138,198,0.6), 0 0 48px rgba(251,191,36,0.4); }
  50%      { transform: scale(1.05); text-shadow: 0 0 36px rgba(255,138,198,0.9), 0 0 64px rgba(251,191,36,0.7); }
}
@keyframes levelupHalo {
  0%   { transform: translate(-50%, -50%) rotate(0deg); }
  100% { transform: translate(-50%, -50%) rotate(360deg); }
}
@keyframes levelupNumberPop {
  0%   { transform: scale(0.4) rotate(-8deg); opacity: 0; }
  60%  { transform: scale(1.15) rotate(2deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes levelupConfettiFall {
  0%   { opacity: 1; transform: translateY(0) rotate(0deg); }
  100% { opacity: 0; transform: translateY(110vh) rotate(720deg); }
}
@keyframes levelupBtnGlow {
  0%, 100% { box-shadow: 0 6px 22px rgba(236,72,153,0.55), 0 0 32px rgba(255,138,198,0.45); }
  50%      { box-shadow: 0 8px 30px rgba(236,72,153,0.85), 0 0 48px rgba(251,191,36,0.6); }
}
.levelup-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999990;
  background: radial-gradient(ellipse at center, rgba(40,10,40,0.72) 0%, rgba(0,0,0,0.85) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: levelupOverlayIn 0.25s ease forwards;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.levelup-overlay.levelup-closing { animation: levelupOverlayOut 0.25s ease forwards; }
.levelup-confetti-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.levelup-confetti-piece {
  position: absolute;
  pointer-events: none;
  border-radius: 3px;
  animation: levelupConfettiFall linear forwards;
}
.levelup-confetti-emoji {
  position: absolute;
  pointer-events: none;
  animation: levelupConfettiFall linear forwards;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
}
.levelup-card {
  position: relative;
  z-index: 2;
  max-width: 480px;
  width: 100%;
  padding: 38px 32px 30px;
  border-radius: 28px;
  background: linear-gradient(135deg, #fff5fa 0%, #ffeef5 50%, #fff0e8 100%);
  border: 3px solid rgba(255,255,255,0.85);
  box-shadow: 0 20px 60px rgba(236,72,153,0.4), 0 0 80px rgba(255,138,198,0.5), inset 0 0 22px rgba(255,255,255,0.6);
  text-align: center;
  animation: levelupCardIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
             levelupCardFloat 3.2s ease-in-out infinite 0.6s;
  font-family: 'Quicksand', system-ui, sans-serif;
}
.levelup-card::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 140%;
  height: 140%;
  background: conic-gradient(from 0deg, transparent 0deg, rgba(255,138,198,0.25) 60deg, transparent 120deg, rgba(251,191,36,0.25) 180deg, transparent 240deg, rgba(167,139,250,0.25) 300deg, transparent 360deg);
  border-radius: 50%;
  z-index: -1;
  animation: levelupHalo 6s linear infinite;
  pointer-events: none;
}
.levelup-banner {
  font-family: 'Dancing Script', 'Quicksand', cursive;
  font-size: clamp(42px, 9vw, 72px);
  font-weight: 900;
  letter-spacing: 2px;
  background: linear-gradient(90deg, #ec4899, #fbbf24, #4ecdc4, #a78bfa, #ec4899);
  background-size: 300% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-bottom: 18px;
  animation: levelupBannerHolo 3s linear infinite, levelupBannerPulse 1.6s ease-in-out infinite;
}
.levelup-level-display {
  margin: 8px 0 18px;
  animation: levelupNumberPop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards 0.2s;
  opacity: 0;
}
.levelup-level-label {
  font-size: 16px;
  font-weight: 600;
  color: #9b4d6b;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.levelup-level-number {
  font-family: 'Dancing Script', 'Quicksand', cursive;
  font-size: clamp(38px, 8vw, 60px);
  font-weight: 900;
  color: #d4286f;
  text-shadow: 0 2px 12px rgba(212,40,111,0.4), 0 0 28px rgba(255,138,198,0.5);
}
.levelup-congrats {
  font-size: 17px;
  font-weight: 600;
  color: #6b3a52;
  margin: 6px 0 22px;
  line-height: 1.4;
}
.levelup-close-btn {
  display: inline-block;
  padding: 14px 42px;
  font-family: 'Quicksand', system-ui, sans-serif;
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #ec4899, #d4286f);
  border: 2px solid rgba(255,255,255,0.7);
  border-radius: 999px;
  cursor: pointer;
  letter-spacing: 1px;
  text-transform: uppercase;
  animation: levelupBtnGlow 1.8s ease-in-out infinite;
  transition: transform 0.15s ease;
}
.levelup-close-btn:hover  { transform: scale(1.06); }
.levelup-close-btn:active { transform: scale(0.96); }
html[data-theme="ultra-performance"] .levelup-overlay,
html[data-theme="ultra-performance"] .levelup-card,
html[data-theme="ultra-performance"] .levelup-banner,
html[data-theme="ultra-performance"] .levelup-level-display,
html[data-theme="ultra-performance"] .levelup-close-btn,
html[data-theme="ultra-performance"] .xp-float { animation: none !important; }
html[data-theme="ultra-performance"] .levelup-card::before { display: none !important; }
html[data-theme="ultra-performance"] .levelup-level-display,
html[data-theme="ultra-performance"] .xp-float { opacity: 1 !important; }
html[data-theme="ultra-performance"] .levelup-banner {
  color: #ec4899 !important;
  -webkit-background-clip: initial !important;
  background-clip: initial !important;
  background: none !important;
}
`;

function injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_TAG_ID)) return;
  const tag = document.createElement('style');
  tag.id = STYLE_TAG_ID;
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}
injectStyles();

const FLOAT_LIFETIME_MS     = 1200;
const FLOAT_STACK_OFFSET_PX = 24;
const CONFETTI_RESPAWN_MS   = 900;
const POINTER_FRESH_MS      = 1500;
const BUCKET_CELL_PX        = 40;

const levelUpQueue = [];
let modalOpen = false;
let activeConfettiInterval = null;
let activeModalEl = null;

// Letzte Pointer-Position merken, damit jedes xp:gained-Event seinen Ursprung
// am Klick statt oben rechts hat. capture: true, damit stopPropagation in
// Spielen (Slot/UNO) den Listener nicht aushebelt.
const lastPointer = { x: 0, y: 0, t: 0 };
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => {
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    lastPointer.t = Date.now();
  }, { capture: true, passive: true });
}

function resolveOrigin() {
  if (Date.now() - lastPointer.t < POINTER_FRESH_MS) {
    return { x: lastPointer.x, y: lastPointer.y };
  }
  const heart = typeof document !== 'undefined' ? document.getElementById('heartBtn') : null;
  if (heart) {
    const r = heart.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  const vw = (typeof window !== 'undefined' ? window.innerWidth  : 800);
  const vh = (typeof window !== 'undefined' ? window.innerHeight : 600);
  return { x: vw / 2, y: vh - 120 };
}

// Mehrere XP-Events am selben Ort stapeln sich nach oben statt sich exakt zu
// überlagern. Bucket-Größe 40 px gruppiert nahe Klicks zusammen.
const stackBuckets = new Map();
function bucketKey(x, y) {
  return Math.round(x / BUCKET_CELL_PX) + ',' + Math.round(y / BUCKET_CELL_PX);
}

function showFloatingXp(amount, boosted) {
  const { x, y } = resolveOrigin();
  const key = bucketKey(x, y);
  const stackIdx = stackBuckets.get(key) || 0;
  stackBuckets.set(key, stackIdx + 1);

  const drift = ((Math.random() * 30 - 15) | 0);
  const rot   = (Math.random() * 12 - 6).toFixed(1);

  const el = document.createElement('div');
  el.className = 'xp-float' + (boosted ? ' boosted' : '');
  el.textContent = (boosted ? '✨ +' : '+') + amount + ' XP';
  el.style.setProperty('--drift', drift + 'px');
  el.style.setProperty('--rot', rot + 'deg');
  el.style.left = x + 'px';
  el.style.top  = Math.max(80, y - 12 - stackIdx * FLOAT_STACK_OFFSET_PX) + 'px';
  document.body.appendChild(el);

  setTimeout(() => {
    el.remove();
    const n = (stackBuckets.get(key) || 1) - 1;
    if (n <= 0) stackBuckets.delete(key); else stackBuckets.set(key, n);
  }, FLOAT_LIFETIME_MS);
}

function spawnConfettiBurst() {
  const colors = ['#e8738a','#f5a3b5','#d4a061','#a78bfa','#4ecdc4','#fbbf24','#ec4899','#22c55e','#fde047','#60a5fa'];
  const emojis = ['🎉','✨','🎊','⭐','💖','🌟'];
  const layer  = activeModalEl ? activeModalEl.querySelector('.levelup-confetti-layer') : null;
  if (!layer) return;
  for (let i = 0; i < 35; i++) {
    const useEmoji = Math.random() < 0.32;
    const el = document.createElement('div');
    const dur   = 1.8 + Math.random() * 2.2;
    const delay = Math.random() * 0.4;
    const left  = Math.random() * 100;
    const top   = -20 - Math.random() * 60;
    if (useEmoji) {
      el.className = 'levelup-confetti-emoji';
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      el.style.cssText = `font-size:${16 + Math.random() * 22}px;left:${left}vw;top:${top}px;animation-duration:${dur}s;animation-delay:${delay}s;transform:rotate(${Math.random()*360}deg);`;
    } else {
      el.className = 'levelup-confetti-piece';
      const size = 6 + Math.random() * 11;
      el.style.cssText = `width:${size}px;height:${size*(0.4+Math.random()*0.6)}px;left:${left}vw;top:${top}px;background:${colors[Math.floor(Math.random()*colors.length)]};animation-duration:${dur}s;animation-delay:${delay}s;transform:rotate(${Math.random()*360}deg);border-radius:${Math.random()>0.5?'50%':'3px'};`;
    }
    layer.appendChild(el);
    setTimeout(() => el.remove(), (dur + delay) * 1000 + 200);
  }
}

function closeLevelUpModal() {
  if (!activeModalEl) return;
  if (activeConfettiInterval) {
    clearInterval(activeConfettiInterval);
    activeConfettiInterval = null;
  }
  activeModalEl.classList.add('levelup-closing');
  const el = activeModalEl;
  activeModalEl = null;
  setTimeout(() => {
    el.remove();
    modalOpen = false;
    processQueue();
  }, 260);
}

function openLevelUpModal(detail) {
  modalOpen = true;
  const overlay = document.createElement('div');
  overlay.className = 'levelup-overlay';
  overlay.innerHTML = `
    <div class="levelup-confetti-layer"></div>
    <div class="levelup-card" role="dialog" aria-modal="true" aria-label="Level Up">
      <div class="levelup-banner">LEVEL UP!</div>
      <div class="levelup-level-display">
        <div class="levelup-level-label">Du hast erreicht</div>
        <div class="levelup-level-number">Level ${detail.newLevel}</div>
      </div>
      <div class="levelup-congrats">🎉 Glückwunsch! 🎉</div>
      <button type="button" class="levelup-close-btn">Weiter</button>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeLevelUpModal();
  });
  overlay.querySelector('.levelup-close-btn').addEventListener('click', closeLevelUpModal);
  document.body.appendChild(overlay);
  activeModalEl = overlay;
  spawnConfettiBurst();
  activeConfettiInterval = setInterval(spawnConfettiBurst, CONFETTI_RESPAWN_MS);
}

function processQueue() {
  if (modalOpen || levelUpQueue.length === 0) return;
  const next = levelUpQueue.shift();
  openLevelUpModal(next);
}

window.addEventListener('xp:gained', (e) => {
  const d = e.detail || {};
  if (!d.amount || d.amount <= 0) return;
  showFloatingXp(d.amount, !!d.boosted);
});

window.addEventListener('xp:levelup', (e) => {
  const d = e.detail || {};
  if (!d.newLevel) return;
  levelUpQueue.push(d);
  processQueue();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalOpen) closeLevelUpModal();
});
