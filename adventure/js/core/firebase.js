/* =====================================================================
   FIREBASE – Anbindung an die gemeinsame Realtime-DB (nele-und-andreas).
   Erkennt per Auth, welcher Spieler (Andreas/Nele) eingeloggt ist und
   stellt db + Helfer für state.js / coins.js bereit.
   ===================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, get, set, update, remove, push, runTransaction, onValue }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Identische Projekt-Konfiguration wie in index.html / farm.html / …
const firebaseConfig = {
  apiKey: "AIzaSyDSkijSdMeV4WcsWGGXcQjVPwEvzDCZvW8",
  authDomain: "nele-und-andreas.firebaseapp.com",
  databaseURL: "https://nele-und-andreas-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "nele-und-andreas",
  storageBucket: "nele-und-andreas.firebasestorage.app",
  messagingSenderId: "694973604970",
  appId: "1:694973604970:web:331975714dca0cd32ad613"
};

const app = initializeApp(firebaseConfig);
export const db   = getDatabase(app);
export const auth = getAuth(app);
export { ref, get, set, update, remove, push, runTransaction, onValue };

// E-Mail → Anzeigename (Mapping wie in index.html).
export function displayName(email){
  if(!email) return null;
  const e = email.toLowerCase();
  if(e === 'raederich@outlook.com') return 'Andreas';
  if(e === 'nele.busse@web.de')     return 'Nele';
  if(e === 'dev@dev.com')           return 'Dev';
  return email.split('@')[0];
}

// Aktueller Spieler-Schlüssel ('andreas' / 'nele'). Live-Binding für Importeure.
export let userKey = null;

// Wartet auf den Auth-Status. Eingeloggt → resolved mit userKey.
// Nicht eingeloggt → Redirect auf die Hub-Seite (dort ist der Login).
export function initAuth(){
  return new Promise(resolve => {
    let done = false;
    onAuthStateChanged(auth, user => {
      if(user){
        const name = displayName(user.email);
        userKey = (name || 'gast').toLowerCase();
        if(!done){ done = true; resolve(userKey); }
      } else if(!done){
        done = true;
        window.location.href = 'index.html';
      }
    });
  });
}
