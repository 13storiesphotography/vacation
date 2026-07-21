# Vacation Planer

Gemeinsamer Vacation Planer mit Supabase Auth (inkl. MFA) und RLS.

## Lokal starten

```bash
cp .env.example .env.local
# NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY eintragen
# Optional: SUPABASE_SERVICE_ROLE_KEY für E-Mail-Invites

npm install
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000).

## Erster Start

1. `/signup` – Admin-Konto anlegen
2. MFA (TOTP) einrichten
3. Urlaub anlegen unter `/app`
4. Team einladen (braucht `SUPABASE_SERVICE_ROLE_KEY` oder Dashboard-Invite)

Im Supabase Dashboard unter **Authentication → URL Configuration** die Site URL und Redirect URLs setzen, z. B.:

- `http://localhost:3000`
- `http://localhost:3000/auth/callback`

## Routen

| Pfad | Inhalt |
| --- | --- |
| `/` | Landing |
| `/login`, `/signup` | Auth |
| `/app` | Geschützte App (MFA Pflicht) |
| `/app/vacations/new` | Urlaub anlegen |
| `/app/vacations/[id]` | Detail + Team-Invite |
| `/konzept` | Öffentliche Konzept-Demo |

## Stack

- Next.js + TypeScript
- Supabase (Postgres, Auth, RLS, MFA/TOTP, Edge Function `invite-member`)

## Konzept auf GitHub Pages

Die frühere statische Konzept-Demo bleibt unter  
https://13storiesphotography.github.io/vacation/  
(Stand vor dem Platform-Build). Der Pages-Workflow ist jetzt **manuell** (`workflow_dispatch`), weil die App Auth/API braucht und nicht mehr rein statisch ist.
