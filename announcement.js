// Globales Live-Meldungs-Modal.
// Andreas kann aus dem Admin-Panel (profil.html) eine Meldung an alle Spieler
// senden. Diese wird live als Modal auf jeder Seite angezeigt – egal wo sich
// der Spieler gerade befindet – und muss manuell weggeklickt werden.
// Hört live auf admin/announcement.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDSkijSdMeV4WcsWGGXcQjVPwEvzDCZvW8",
  authDomain: "nele-und-andreas.firebaseapp.com",
  databaseURL: "https://nele-und-andreas-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "nele-und-andreas",
  storageBucket: "nele-und-andreas.firebasestorage.app",
  messagingSenderId: "694973604970",
  appId: "1:694973604970:web:331975714dca0cd32ad613"
};

const app  = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getDatabase(app);

const STORE_KEY = 'announcementDismissedId';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------- Modal-DOM + Stil einmalig injizieren ----------
let overlayEl = null, cardEl = null, emojiEl = null, titleEl = null, textEl = null;

function ensureModal() {
  if (overlayEl) return;

  const style = document.createElement('style');
  style.textContent = `
    .anc-overlay {
      position: fixed; inset: 0; z-index: 2000000;
      display: none; align-items: center; justify-content: center;
      background: rgba(20,20,30,0.55);
      -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
      padding: 20px;
    }
    .anc-overlay.open { display: flex; }
    .anc-card {
      background: #fff;
      border: 1.5px solid rgba(0,0,0,0.08);
      border-top: 6px solid #3b82f6;
      border-radius: 22px;
      padding: 32px 28px 26px;
      max-width: 360px; width: 100%;
      text-align: center;
      box-shadow: 0 18px 60px rgba(0,0,0,0.3);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      animation: ancPop 0.4s cubic-bezier(0.22,1,0.36,1) both;
    }
    .anc-card.is-warning { border-top-color: #f59e0b; }
    @keyframes ancPop {
      0%   { transform: scale(0.7); opacity: 0; }
      70%  { transform: scale(1.03); }
      100% { transform: scale(1); opacity: 1; }
    }
    .anc-emoji { font-size: 48px; display: block; margin-bottom: 10px; }
    .anc-title {
      font-size: 22px; font-weight: 800;
      color: #1d4ed8; margin-bottom: 10px; line-height: 1.2;
    }
    .anc-card.is-warning .anc-title { color: #b45309; }
    .anc-text {
      font-size: 15px; line-height: 1.5; color: #334155;
      margin-bottom: 22px; word-break: break-word; white-space: pre-wrap;
    }
    .anc-btn {
      display: inline-block;
      background: #3b82f6;
      color: #fff; border: none; cursor: pointer;
      font-size: 15px; font-weight: 700;
      padding: 12px 34px; border-radius: 50px;
      box-shadow: 0 6px 18px rgba(59,130,246,0.4);
      transition: transform 0.15s;
    }
    .anc-card.is-warning .anc-btn {
      background: #f59e0b;
      box-shadow: 0 6px 18px rgba(245,158,11,0.4);
    }
    .anc-btn:active { transform: scale(0.96); }
  `;
  document.head.appendChild(style);

  overlayEl = document.createElement('div');
  overlayEl.className = 'anc-overlay';
  overlayEl.setAttribute('role', 'alertdialog');
  overlayEl.setAttribute('aria-modal', 'true');
  overlayEl.innerHTML = `
    <div class="anc-card" role="document">
      <span class="anc-emoji" id="ancEmoji">ℹ️</span>
      <div class="anc-title" id="ancTitle">Info</div>
      <div class="anc-text" id="ancText"></div>
      <button class="anc-btn" id="ancClose" type="button">Verstanden</button>
    </div>
  `;
  document.body.appendChild(overlayEl);

  cardEl  = overlayEl.querySelector('.anc-card');
  emojiEl = overlayEl.querySelector('#ancEmoji');
  titleEl = overlayEl.querySelector('#ancTitle');
  textEl  = overlayEl.querySelector('#ancText');
  overlayEl.querySelector('#ancClose').addEventListener('click', dismiss);
}

let current = null; // aktuell angezeigte Meldung

function showAnnouncement(a) {
  ensureModal();
  current = a;
  const warn = a.type === 'warning';
  cardEl.classList.toggle('is-warning', warn);
  emojiEl.textContent = warn ? '⚠️' : 'ℹ️';
  titleEl.textContent = warn ? 'Warnung' : 'Info';
  textEl.innerHTML = esc(a.text);
  overlayEl.classList.add('open');
}

function hide() {
  if (overlayEl) overlayEl.classList.remove('open');
}

function dismiss() {
  if (current) {
    try { localStorage.setItem(STORE_KEY, String(current.id)); } catch (e) {}
  }
  hide();
}

// ---------- Listener ----------
let subscribed = false;

function subscribeAnnouncement() {
  if (subscribed) return;
  subscribed = true;
  onValue(ref(db, 'admin/announcement'), snap => {
    const a = snap.val();
    if (!a || a.id == null || !a.text) { hide(); return; }
    let dismissedId = null;
    try { dismissedId = localStorage.getItem(STORE_KEY); } catch (e) {}
    if (dismissedId != null && String(a.id) === dismissedId) {
      hide();
      return;
    }
    showAnnouncement(a);
  }, err => {
    console.error('Live-Meldung: Lesen von admin/announcement fehlgeschlagen:', err);
  });
}

// Erst nach Login anzeigen (nicht auf dem Login-Screen). Gilt für beide Spieler.
onAuthStateChanged(auth, user => {
  if (user) subscribeAnnouncement();
  else hide();
});
