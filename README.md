# Vacation Planer

Gemeinsamer Vacation Planer mit Supabase Auth (inkl. MFA) und RLS.

## Lokal starten

```bash
cp .env.example .env.local
# NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY eintragen
# Optional: SUPABASE_SERVICE_ROLE_KEY für E-Mail-Invites + Invite-Guard bei Apple

npm install
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000).

## Erster Start (Invite-only)

Öffentliche Selbst-Registrierung ist absichtlich aus.

1. In Vercel Env-Vars: `NEXT_PUBLIC_SUPABASE_*` **ohne** Leerzeichen/Zeilenumbruch speichern (nicht als Sensitive markieren).
2. In Supabase → Authentication → Providers → Email: **Confirm email** aus, **Enable sign ups** aus.
3. Ersten Admin anlegen: Authentication → Users → **Add user** (E-Mail + Passwort).
4. Auf der App-URL anmelden → MFA einrichten → Urlaub anlegen.
5. Weitere Personen nur über **Einladen** im Urlaub.
6. Optional: **Apple Sign-In** aktivieren (siehe unten) — gleiche E-Mail wie bei der Einladung.

Im Supabase Dashboard unter **Authentication → URL Configuration** die Site URL und Redirect URLs setzen, z. B.:

- `http://localhost:3000`
- `http://localhost:3000/auth/callback`
- `https://vacation-bice.vercel.app`
- `https://vacation-bice.vercel.app/auth/callback`

Unter **Authentication → Settings** möglichst **Automatic linking** aktivieren, damit Apple-Konten mit derselben E-Mail an bestehende Invite-User andocken.

## Apple Sign-In

Login bietet „Mit Apple anmelden“ (OAuth über Supabase). Setup:

1. **Apple Developer** → Identifiers:
   - App ID mit „Sign In with Apple“
   - **Services ID** (für Web), Domain + Return URL:
     - Domain: `<project-ref>.supabase.co`
     - Return URL: `https://<project-ref>.supabase.co/auth/v1/callback`
2. **Keys** → Key mit „Sign In with Apple“ → `.p8` herunterladen (Team ID, Key ID notieren).
3. **Supabase** → Authentication → Providers → **Apple** einschalten:
   - Services ID als Client ID
   - Team ID, Key ID, private key (`.p8`-Inhalt)
4. In der App: Login → **Mit Apple anmelden**. MFA bleibt Pflicht (nach Schonfrist).

Hinweis: Ohne Einladung / bestehendes Konto schlägt die Anmeldung fehl (Invite-only).

## Routen

| Pfad | Inhalt |
| --- | --- |
| `/` | Landing |
| `/login`, `/signup` | Auth (Passwort + Apple) |
| `/app` | Geschützte App (MFA Pflicht) |
| `/app/vacations/new` | Urlaub anlegen |
| `/app/vacations/[id]` | Detail + Team-Invite |
| `/konzept` | Öffentliche Konzept-Demo |

## Stack

- Next.js + TypeScript
- Supabase (Postgres, Auth, RLS, MFA/TOTP, Apple OAuth, Edge Function `invite-member`)

## Konzept auf GitHub Pages

Die frühere statische Konzept-Demo bleibt unter  
https://13storiesphotography.github.io/vacation/  
(Stand vor dem Platform-Build). Der Pages-Workflow ist jetzt **manuell** (`workflow_dispatch`), weil die App Auth/API braucht und nicht mehr rein statisch ist.
