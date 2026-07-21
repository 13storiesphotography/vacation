# Vacation Planer

Konzept und Live-Demo für einen gemeinsamen Vacation Planer.

## Idee

1. **Urlaub anlegen** – Zeitraum, Typ (z. B. Wohnmobil/Van), Infos
2. **Spots sammeln** – Stellplätze, Sehenswürdigkeiten, Orte, Freizeit, Versorgung
3. **Auf der Karte sehen** – filtern, auswählen, Maps- & Info-/Buchungslinks
4. **Tage planen** – Stops sortieren, bei Van-Urlauben Übernachtung pro Tag (frei/kostenpflichtig)
5. **Zusammenarbeiten** – Admin lädt ein, Member setzt Passwort + MFA

## Live auf GitHub Pages

Nach einmaligem Aktivieren unter **Settings → Pages → Source: GitHub Pages**  
(Build/Deploy über GitHub Actions) ist die Demo unter:

**https://13storiesphotography.github.io/vacation/**

Lokal ohne `basePath`:

```bash
npm install
npm run dev
```

Für denselben Build wie auf Pages:

```bash
GITHUB_PAGES=true npm run build
```

## Stack (geplant)

- Next.js + TypeScript
- Supabase (Postgres, Auth, RLS, MFA/TOTP)
