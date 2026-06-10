/* ESM-Loader-Stub: ersetzt core/firebase.js (lädt aus https-URLs, im Node nicht
   verfügbar) durch ein leeres Modul, damit avatar.js → state.js headless
   importierbar ist. NUR fürs Preview-Rendering (tools/gen-set-previews.mjs).
   Verwendung: node --import ./adventure/tools/firebase-stub-loader.mjs … */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register('./firebase-stub-loader-hooks.mjs', pathToFileURL('./adventure/tools/'));
