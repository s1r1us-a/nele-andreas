// Wartungsmodus: Sperrt einzelne Seiten für alle Nutzer.
// Hört live auf admin/pageLocks/{pageKey}. Ist die aktuelle Seite gesperrt,
// legt sich ein Vollbild-Wartungsbildschirm über den Inhalt (kein Bypass,
// kein Auto-Redirect). index.html und profil.html sind ausgenommen.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDSkijSdMeV4WcsWGGXcQjVPwEvzDCZvW8",
  authDomain: "nele-und-andreas.firebaseapp.com",
  databaseURL: "https://nele-und-andreas-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "nele-und-andreas",
  storageBucket: "nele-und-andreas.firebasestorage.app",
  messagingSenderId: "694973604970",
  appId: "1:694973604970:web:331975714dca0cd32ad613"
};

// Seiten, die niemals gesperrt werden dürfen.
const EXCLUDED = ['', 'index.html', 'profil.html'];

const file = (location.pathname.split('/').pop() || '').toLowerCase();
if (!EXCLUDED.includes(file)) {
  const pageKey = file.replace(/\.html$/, '');

  const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
  const db  = getDatabase(app);

  let overlay = null;

  function buildOverlay() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes mtnc-spin { to { transform: rotate(360deg); } }
      #maintenanceOverlay {
        position: fixed; inset: 0; z-index: 2147483647;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        text-align: center; padding: 24px;
        background: rgba(253,232,237,0.97);
        backdrop-filter: blur(6px);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #b03a63;
      }
      #maintenanceOverlay .mtnc-gear {
        font-size: 76px; line-height: 1;
        animation: mtnc-spin 3.5s linear infinite;
        display: inline-block;
      }
      #maintenanceOverlay .mtnc-title {
        margin: 22px 0 10px; font-size: 32px; font-weight: 800;
      }
      #maintenanceOverlay .mtnc-text {
        max-width: 440px; font-size: 17px; line-height: 1.5;
        color: #9a4264; margin-bottom: 26px;
      }
      #maintenanceOverlay .mtnc-home {
        border: none; cursor: pointer;
        background: #e8779b; color: #fff;
        font-size: 16px; font-weight: 700;
        padding: 12px 26px; border-radius: 999px;
        box-shadow: 0 6px 16px rgba(232,119,155,0.4);
      }
      #maintenanceOverlay .mtnc-home:hover { background: #d9628a; }
    `;
    document.head.appendChild(style);

    const el = document.createElement('div');
    el.id = 'maintenanceOverlay';
    el.innerHTML =
      '<div class="mtnc-gear">⚙️</div>' +
      '<div class="mtnc-title">Wartungsmodus</div>' +
      '<div class="mtnc-text">Diese Seite wird gerade überarbeitet und ist ' +
      'so schnell wie möglich wieder verfügbar.</div>' +
      '<button class="mtnc-home" type="button">🏠 Zur Startseite</button>';
    el.querySelector('.mtnc-home').addEventListener('click', () => {
      location.href = 'index.html';
    });
    return el;
  }

  function showOverlay() {
    if (overlay) return;
    overlay = buildOverlay();
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  }

  function hideOverlay() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.body.style.overflow = '';
  }

  const auth = getAuth(app);
  let subscribed = false;

  function subscribeLock() {
    if (subscribed) return;
    subscribed = true;
    onValue(ref(db, 'admin/pageLocks/' + pageKey), snap => {
      const lock = snap.val();
      if (lock && lock.locked === true) showOverlay();
      else hideOverlay();
    }, err => {
      console.error('Wartungsmodus: Lesen von admin/pageLocks fehlgeschlagen:', err);
    });
  }

  onAuthStateChanged(auth, user => {
    if (user) subscribeLock();
    else hideOverlay();
  });
}
