# Sicherheits-Anleitung: Schatzkammer / Supabase-Storage

Diese Anleitung beschreibt, **warum** der aktuelle Zustand unsicher ist und
**wie** der Supabase-Storage der Schatzkammer (`upload.html`) abgesichert wird.
Es wurde bewusst noch **kein Code geändert** – diese Datei ist die
Umsetzungs-Anleitung.

---

## 1. Das Problem

Die Schatzkammer speichert alle Dateien in einem **öffentlichen** Supabase-
Bucket `nele-andreas`. Aktueller Aufbau (in `upload.html`):

| Punkt | Status | Codestelle |
|------|--------|------------|
| Login / Identität | **Firebase** (E-Mail/Passwort) | `upload.html:1245`, `:1222` |
| Erlaubte Konten | `nele.busse@web.de`, `raederich@outlook.com` | `keyForEmail()` |
| Storage-Key | öffentlicher `sb_publishable_*`-Key, **im HTML sichtbar** | `upload.html:1094` |
| Supabase-Auth | **gibt es nicht** | – |
| Zugriffsprüfung | `canWrite()` – läuft nur im Browser | `upload.html` |
| Downloads | `getPublicUrl()` → **dauerhaft öffentliche Links** | `upload.html:1461` |

### Warum das unsicher ist

- **Der Anon-Key ist öffentlich.** Er steht im Quelltext der Seite. Jeder
  Besucher hat ihn. Ein „geheimer" Schlüssel im Browser existiert nicht.
- **`canWrite()` ist reine Kosmetik.** Die Funktion blendet im Frontend nur
  Buttons aus. Wer den (öffentlichen) Key nutzt, ist nicht an diese
  JavaScript-Prüfung gebunden.
- **`getPublicUrl()` erzeugt unbefristete öffentliche URLs.** Wer einen Link
  hat – oder Pfade errät (`nele/...`, `andreas/...`, `gemeinsam/...`,
  Legacy-Dateien direkt im Root) – kann Dateien **ohne Login** herunterladen.
- **Auflisten/Schreiben/Löschen** hängen allein an den Bucket-Policies. Ist
  der Bucket öffentlich bzw. erlaubt er `anon`, kann **jeder** mit dem
  sichtbaren Key listen, laden, hochladen und löschen.
- **Die „privaten" Truhen sind nicht privat.** Die Trennung Nele / Andreas /
  Gemeinsam existiert nur im Frontend.

---

## 2. Grundprinzip

> **Alles, was im Browser läuft, ist öffentlich.**

Ein Anon-Key allein kann niemals absichern. Echte Sicherheit entsteht **nur
serverseitig erzwungen** – entweder durch

- **RLS-Policies (Row Level Security) zusammen mit echter Auth-Session**, oder
- einen **Server-/Edge-Proxy**, der jede Anfrage prüft.

Da die App rein statisch ist (kein eigener Server) und Firebase für die
Identität nutzt, ist der praktikabelste sichere Weg: **die zwei bekannten
Nutzer zusätzlich bei Supabase anmelden** und den Zugriff per **RLS** an die
Supabase-Auth-E-Mail binden.

---

## 3. Empfohlene Lösung: Privater Bucket + Supabase-Auth + RLS + signierte URLs

> Reihenfolge-Hinweis: Schritte **A–C verändern das Backend** und werden die
> App **vorübergehend funktionsunfähig machen**, bis die Client-Anpassungen
> aus **Schritt D** ausgerollt sind. Plane A–D als **ein** Rollout.

### Schritt A — Bucket privat schalten

1. Supabase-Konsole → **Storage** → Bucket **`nele-andreas`**.
2. Bucket-Einstellungen → Option **„Public bucket"** **deaktivieren**.
3. Speichern.

Damit funktioniert `getPublicUrl()` nicht mehr → in Schritt D auf
`createSignedUrl()` umstellen.

### Schritt B — Zwei Supabase-Auth-Nutzer anlegen

Konsole → **Authentication** → **Users** → **Add user** (zweimal):

| E-Mail | Hinweis |
|--------|---------|
| `nele.busse@web.de` | Passwort setzen (sicher, notieren) |
| `raederich@outlook.com` | Passwort setzen (sicher, notieren) |

„Auto-Confirm user" aktivieren, damit kein Bestätigungs-Mail-Flow nötig ist.

> Damit der Login in `upload.html` einfach bleibt, empfiehlt sich für jedes
> Konto **dasselbe Passwort wie bei Firebase** – dann kann der bestehende
> Login-Dialog 1:1 für beide Systeme genutzt werden (Schritt D).

### Schritt C — RLS-Policies auf `storage.objects`

Konsole → **SQL Editor** → folgendes Skript ausführen. Es setzt voraus, dass
RLS auf `storage.objects` aktiv ist (bei Supabase standardmäßig der Fall).

```sql
-- Saubere Basis: evtl. alte, zu offene Policies dieses Buckets entfernen.
-- (Vorher in Konsole unter Storage > Policies prüfen und ggf. Namen anpassen.)

-- ============ GEMEINSAME TRUHE: beide Konten dürfen alles ============
create policy "kammer_gemeinsam_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'nele-andreas'
  and (storage.foldername(name))[1] = 'gemeinsam'
  and auth.email() in ('nele.busse@web.de','raederich@outlook.com')
);

create policy "kammer_gemeinsam_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'nele-andreas'
  and (storage.foldername(name))[1] = 'gemeinsam'
  and auth.email() in ('nele.busse@web.de','raederich@outlook.com')
);

create policy "kammer_gemeinsam_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'nele-andreas'
  and (storage.foldername(name))[1] = 'gemeinsam'
  and auth.email() in ('nele.busse@web.de','raederich@outlook.com')
)
with check (
  bucket_id = 'nele-andreas'
  and (storage.foldername(name))[1] = 'gemeinsam'
  and auth.email() in ('nele.busse@web.de','raederich@outlook.com')
);

create policy "kammer_gemeinsam_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'nele-andreas'
  and (storage.foldername(name))[1] = 'gemeinsam'
  and auth.email() in ('nele.busse@web.de','raederich@outlook.com')
);

-- ============ NELES TRUHE: nur Nele ============
create policy "kammer_nele_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'nele-andreas'
  and (storage.foldername(name))[1] = 'nele'
  and auth.email() = 'nele.busse@web.de'
);

create policy "kammer_nele_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'nele-andreas'
  and (storage.foldername(name))[1] = 'nele'
  and auth.email() = 'nele.busse@web.de'
);

create policy "kammer_nele_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'nele-andreas'
  and (storage.foldername(name))[1] = 'nele'
  and auth.email() = 'nele.busse@web.de'
)
with check (
  bucket_id = 'nele-andreas'
  and (storage.foldername(name))[1] = 'nele'
  and auth.email() = 'nele.busse@web.de'
);

create policy "kammer_nele_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'nele-andreas'
  and (storage.foldername(name))[1] = 'nele'
  and auth.email() = 'nele.busse@web.de'
);

-- ============ ANDREAS' TRUHE: nur Andreas ============
create policy "kammer_andreas_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'nele-andreas'
  and (storage.foldername(name))[1] = 'andreas'
  and auth.email() = 'raederich@outlook.com'
);

create policy "kammer_andreas_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'nele-andreas'
  and (storage.foldername(name))[1] = 'andreas'
  and auth.email() = 'raederich@outlook.com'
);

create policy "kammer_andreas_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'nele-andreas'
  and (storage.foldername(name))[1] = 'andreas'
  and auth.email() = 'raederich@outlook.com'
)
with check (
  bucket_id = 'nele-andreas'
  and (storage.foldername(name))[1] = 'andreas'
  and auth.email() = 'raederich@outlook.com'
);

create policy "kammer_andreas_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'nele-andreas'
  and (storage.foldername(name))[1] = 'andreas'
  and auth.email() = 'raederich@outlook.com'
);
```

**Wirkung:**

- Nicht eingeloggt (`anon`): **kein** Zugriff (keine Policy trifft zu).
- `nele.busse@web.de`: voller Zugriff auf `nele/**` + `gemeinsam/**`,
  **kein** Zugriff auf `andreas/**`.
- `raederich@outlook.com`: voller Zugriff auf `andreas/**` +
  `gemeinsam/**`, **kein** Zugriff auf `nele/**`.

> **Legacy-Root-Dateien:** Dateien direkt im Bucket-Root (ohne
> `gemeinsam/`-Präfix; vom alten Code als „gemeinsam" gelistet) werden von
> obigen Policies **nicht** abgedeckt und wären dann **nicht mehr
> zugreifbar**. Empfehlung: einmalig in den Ordner `gemeinsam/` verschieben
> (Konsole → Storage → Datei → Move). Erst danach ist die Liste in der App
> wieder vollständig. Alternativ – nur falls Verschieben unmöglich – eine
> zusätzliche, eng gefasste SELECT-Policy für genau diese Dateinamen; davon
> wird wegen der schwer eingrenzbaren Pfade abgeraten.

### Schritt D — Notwendige Client-Anpassungen (später umzusetzen)

Damit die App mit privatem Bucket + RLS wieder funktioniert, muss
`upload.html` angepasst werden (hier nur beschrieben):

1. **Supabase-Login zusätzlich zum Firebase-Login**
   - Stelle: Login-Handler bei `upload.html:1245`
     (`signInWithEmailAndPassword(auth, …)`).
   - Ergänzen: nach erfolgreichem Firebase-Login zusätzlich
     `await supabase.auth.signInWithPassword({ email, password })`.
   - Schlägt der Supabase-Login fehl → Fehlermeldung anzeigen und Vorgang
     abbrechen (sonst „leere"/fehlschlagende Storage-Aufrufe).
   - `onAuthStateChanged` (`upload.html:1222`): erst weiterarbeiten, wenn
     **auch** eine Supabase-Session besteht
     (`supabase.auth.getSession()`), sonst Login-Overlay zeigen.

2. **Logout für beide Systeme**
   - Stelle: `logoutBtn … signOut(auth)` bei `upload.html:1254`.
   - Ergänzen: zusätzlich `await supabase.auth.signOut()`.

3. **Downloads über signierte URLs statt öffentlicher URLs**
   - Stelle: `getPublicUrl(fullPath)` bei `upload.html:1461`.
   - Ersetzen durch
     `await supabase.storage.from(BUCKET).createSignedUrl(fullPath, 3600)`
     (Gültigkeit z. B. 1 Stunde). Rückgabe ist asynchron → die Render-
     Schleife der Dateiliste muss `await` berücksichtigen (z. B. Links erst
     beim Klick erzeugen oder Liste asynchron aufbauen).
   - „Öffnen"- und „⬇"-Links entsprechend auf die signierte URL setzen.

4. **List/Upload/Delete** (`:1327`, `:1518`, `:1548`) brauchen **keine**
   Code-Änderung – sie laufen automatisch über die nun authentifizierte
   Supabase-Session und werden durch die RLS-Policies abgesichert.

5. **`canWrite()` bleibt** als reine UX-Hilfe (Buttons ausblenden) erhalten;
   die echte Durchsetzung liegt jetzt in den RLS-Policies.

---

## 4. Alternative (maximal sicher): Edge-Function-Proxy

Falls die Identität zwingend allein bei Firebase bleiben soll:

- Bucket privat lassen, **keine** `anon`/`authenticated`-Policies.
- Eine **Supabase Edge Function** (oder andere Serverless-Funktion):
  1. Client schickt das **Firebase-ID-Token** mit.
  2. Funktion **verifiziert** das Token serverseitig (Firebase Admin /
     JWKS).
  3. Nur bei gültigem Token + erlaubtem Pfad führt sie die Storage-Operation
     mit dem **Service-Role-Key** aus (Key bleibt geheim auf dem Server).
- Vorteil: stärkste Trennung, kein zweites Login.
- Nachteil: Serverless-Deployment + Secret-Verwaltung + mehr Code/Wartung.

Wann sinnvoll: wenn kein zweites (Supabase-)Login akzeptabel ist oder mehr
als zwei Nutzer / dynamische Rechte kommen.

---

## 5. Was NICHT hilft (Anti-Patterns)

- **Nur `createSignedUrl()`** bei weiterhin offenem/anon-erlaubtem Bucket –
  jeder mit dem öffentlichen Key kann selbst signieren.
- **Den Anon-Key „verstecken"/obfuskieren** – er muss zum Laden im Browser
  vorliegen, ist also immer auslesbar.
- **RLS-Policies ohne echte Auth-Session** – ohne `authenticated`-Rolle
  greift `auth.email()` nicht; Policies wären wirkungslos oder müssten
  `anon` erlauben (= keine Sicherheit).
- **Sich auf `canWrite()` / verstecktes UI verlassen** – Frontend-Prüfungen
  sind kein Schutz.

---

## 6. Abnahme-Checkliste (nach A–D)

- [ ] **Inkognito, nicht eingeloggt:** eine zuvor bekannte Datei-URL bzw.
      `getPublicUrl`/`list` → liefert **403/400** (kein Zugriff).
- [ ] **Als Nele eingeloggt:** `nele/**` lesen/schreiben **ok**;
      `andreas/**` → **verweigert**; `gemeinsam/**` **ok**.
- [ ] **Als Andreas eingeloggt:** spiegelbildlich (Andreas ok, `nele/**`
      verweigert, gemeinsam ok).
- [ ] **Ohne Supabase-Session** (nur Firebase) schlägt `list/upload/delete`
      fehl → App zeigt sauberen Fehler / erzwingt Re-Login.
- [ ] **Downloads** funktionieren über signierte URLs und laufen nach Ablauf
      (TTL) ab.
- [ ] **Upload / Beutel anlegen / Löschen** funktionieren für die jeweils
      berechtigte Person.
- [ ] **Legacy-Root-Dateien** wurden nach `gemeinsam/` migriert und sind
      wieder sichtbar.

---

## 7. Offener Restpunkt (außerhalb dieses Auftrags)

Die **Firebase Realtime Database** (`treasure/meta`, `treasure/log`) hat
laut Repo **keine** Sicherheitsregeln (`database.rules.json` fehlt) und ist
damit potenziell offen lesbar/schreibbar. Das wurde hier bewusst
**ausgeklammert**, sollte aber separat ebenfalls abgesichert werden
(Regeln, die nur die beiden bekannten, authentifizierten Konten zulassen).
