// Gemeinsame, headless Auto-Klicker-Engine.
// Eingebunden auf allen Seiten AUSSER index.html (dort übernimmt die
// bestehende Logik). Sorgt dafür, dass ein aktiver Auto-Klicker-Booster
// auch weiterklickt, während man in einem anderen Spiel/auf einer anderen
// Seite ist – Verhalten 1:1 wie performClick({auto:true}) in index.html.

import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, runTransaction, set, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Auf der Moment-Seite (index.html) nichts tun – dort klickt die
// vorhandene Logik bereits, sonst würde doppelt geklickt.
if (!document.getElementById('heartBtn')) {

  const firebaseConfig = {
    apiKey: "AIzaSyDSkijSdMeV4WcsWGGXcQjVPwEvzDCZvW8",
    authDomain: "nele-und-andreas.firebaseapp.com",
    databaseURL: "https://nele-und-andreas-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "nele-und-andreas",
    storageBucket: "nele-und-andreas.firebasestorage.app",
    messagingSenderId: "694973604970",
    appId: "1:694973604970:web:331975714dca0cd32ad613"
  };

  const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const db   = getDatabase(app);
  const auth = getAuth(app);

  function displayName(email) {
    if (email.toLowerCase() === 'raederich@outlook.com') return 'Andreas';
    if (email.toLowerCase() === 'nele.busse@web.de')     return 'Nele';
    return email.split('@')[0];
  }

  function isBoosterActive(data) {
    if (!data || !data.activatedAt) return false;
    return Date.now() < data.activatedAt + data.durationMs;
  }

  function getGermanDate() {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
  }

  let userKey              = null;
  let activeAutoclicker    = null;
  let activeMoments        = null;
  let activeCoins          = null;
  let activeSabotage       = null;
  let autoclickInterval      = null;
  let autoclickFlushInterval = null;
  let sabotageClickCounter   = 0;
  let pendMoments            = 0;   // akkumulierte Momente bis zum Flush
  let pendCoins              = 0;
  let pendLastClick          = null;

  // Headless: kein sichtbarer Zähler -> nur akkumulieren, gebündelt schreiben.
  function autoClickTick() {
    if (!userKey) return;

    // Sabotage-Gate: nur jeder 10. Klick zählt (wie index.html)
    if (isBoosterActive(activeSabotage)) {
      sabotageClickCounter++;
      if (sabotageClickCounter % 10 !== 0) return;
    }

    const momentBoost = isBoosterActive(activeMoments) ? 2 : 1;
    const coinAmount  = isBoosterActive(activeCoins)   ? 2 : 1;
    pendMoments  += momentBoost;
    pendCoins    += coinAmount;
    pendLastClick = { name: userKey === 'andreas' ? 'Andreas' : 'Nele', time: Date.now() };
  }

  function flushAutoclicks() {
    if (!userKey) return;
    const m = pendMoments, c = pendCoins;
    if (m <= 0 && c <= 0) return;
    const today = getGermanDate();
    if (m > 0) {
      runTransaction(ref(db, 'moments/count'),                     v => (v || 0) + m);
      runTransaction(ref(db, `moments/${userKey}`),                v => (v || 0) + m);
      runTransaction(ref(db, `moments/daily/${today}/${userKey}`), v => (v || 0) + m);
    }
    if (c > 0) {
      runTransaction(ref(db, `coins/${userKey}`),             v => (v || 0) + c).catch(err => console.error('Coin-Fehler:', err));
      runTransaction(ref(db, `stats/${userKey}/coinsEarned`), v => (v || 0) + c).catch(err => console.error('Stats-Fehler:', err));
    }
    if (pendLastClick) set(ref(db, 'moments/lastClick'), pendLastClick);
    pendMoments = 0; pendCoins = 0;
  }

  function updateAutoclicker() {
    const active = isBoosterActive(activeAutoclicker);
    if (active && !autoclickInterval) {
      pendMoments = 0; pendCoins = 0; pendLastClick = null;
      autoclickInterval = setInterval(() => {
        if (!isBoosterActive(activeAutoclicker)) { updateAutoclicker(); return; }
        autoClickTick();
      }, 100); // 10×/Sekunde
      autoclickFlushInterval = setInterval(flushAutoclicks, 1000);
    } else if (!active && autoclickInterval) {
      clearInterval(autoclickInterval);
      autoclickInterval = null;
      if (autoclickFlushInterval) { clearInterval(autoclickFlushInterval); autoclickFlushInterval = null; }
      flushAutoclicks();
    }
    if (!isBoosterActive(activeSabotage)) sabotageClickCounter = 0;
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) flushAutoclicks(); });
  window.addEventListener('pagehide', flushAutoclicks);

  onAuthStateChanged(auth, user => {
    if (!user || !user.email) {
      flushAutoclicks();
      userKey = null;
      if (autoclickInterval) { clearInterval(autoclickInterval); autoclickInterval = null; }
      if (autoclickFlushInterval) { clearInterval(autoclickFlushInterval); autoclickFlushInterval = null; }
      return;
    }
    userKey = displayName(user.email).toLowerCase();

    onValue(ref(db, `boosters/${userKey}/active_autoclicker`), snap => {
      activeAutoclicker = snap.val() || null;
      updateAutoclicker();
    });
    onValue(ref(db, `boosters/${userKey}/active_moments`), snap => {
      activeMoments = snap.val() || null;
    });
    onValue(ref(db, `boosters/${userKey}/active_coins`), snap => {
      activeCoins = snap.val() || null;
    });
    onValue(ref(db, `boosters/${userKey}/active_sabotage`), snap => {
      activeSabotage = snap.val() || null;
      if (!isBoosterActive(activeSabotage)) sabotageClickCounter = 0;
    });
  });
}
