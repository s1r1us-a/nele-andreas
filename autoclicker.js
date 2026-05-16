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
  let autoclickInterval    = null;
  let sabotageClickCounter = 0;

  function performAutoClick() {
    if (!userKey) return;

    // Sabotage-Gate: nur jeder 10. Klick zählt (wie index.html)
    if (isBoosterActive(activeSabotage)) {
      sabotageClickCounter++;
      if (sabotageClickCounter % 10 !== 0) return;
    }

    const momentBoost = isBoosterActive(activeMoments) ? 2 : 1;
    const coinAmount  = isBoosterActive(activeCoins)   ? 2 : 1;
    const now         = Date.now();
    const name        = userKey === 'andreas' ? 'Andreas' : 'Nele';
    const today       = getGermanDate();

    runTransaction(ref(db, 'moments/count'),                c => (c || 0) + momentBoost);
    runTransaction(ref(db, `moments/${userKey}`),           c => (c || 0) + momentBoost);
    runTransaction(ref(db, `moments/daily/${today}/${userKey}`), c => (c || 0) + momentBoost);
    runTransaction(ref(db, `coins/${userKey}`),             c => (c || 0) + coinAmount).catch(err => console.error('Coin-Fehler:', err));
    runTransaction(ref(db, `stats/${userKey}/coinsEarned`), c => (c || 0) + coinAmount).catch(err => console.error('Stats-Fehler:', err));
    set(ref(db, 'moments/lastClick'), { name, time: now });
  }

  function updateAutoclicker() {
    const active = isBoosterActive(activeAutoclicker);
    if (active && !autoclickInterval) {
      autoclickInterval = setInterval(() => {
        if (!isBoosterActive(activeAutoclicker)) { updateAutoclicker(); return; }
        performAutoClick();
      }, 200); // 5×/Sekunde
    } else if (!active && autoclickInterval) {
      clearInterval(autoclickInterval);
      autoclickInterval = null;
    }
    if (!isBoosterActive(activeSabotage)) sabotageClickCounter = 0;
  }

  onAuthStateChanged(auth, user => {
    if (!user || !user.email) {
      userKey = null;
      if (autoclickInterval) { clearInterval(autoclickInterval); autoclickInterval = null; }
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
