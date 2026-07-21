# Vacation Planer

Konzept und Live-Demo für einen gemeinsamen Vacation Planer.

## Idee

1. **Urlaub anlegen** – Zeitraum, Typ (z. B. Wohnmobil/Van), Infos
2. **Spots sammeln** – Stellplätze, Sehenswürdigkeiten, Orte, Freizeit, Versorgung
3. **Auf der Karte sehen** – filtern, auswählen, Maps- & Info-/Buchungslinks
4. **Tage planen** – Stops sortieren, bei Van-Urlauben Übernachtung pro Tag (frei/kostenpflichtig)
5. **Zusammenarbeiten** – Admin lädt ein, Member setzt Passwort + MFA

## Lokal starten

```bash
npm install
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000).

## Stack (geplant)

- Next.js + TypeScript
- Supabase (Postgres, Auth, RLS, MFA/TOTP)
