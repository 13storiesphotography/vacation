# Vacation Planer

Gemeinsamer Vacation Planer mit Supabase Auth (inkl. MFA) und RLS.

## Lokal starten

```bash
cp .env.example .env.local
# NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY eintragen
# Optional: SUPABASE_SERVICE_ROLE_KEY für E-Mail-Invites
# Wenn leer, nutzt die App die Supabase Edge Function `invite-member` als Fallback.

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
6. Spots: Beliebigen Link unter **Link einfügen** pasten (Google Maps, Airbnb, Park4Night, Booking, …). Die App erkennt die Quelle und füllt Name, Bild, Kategorie und Position soweit möglich. Danach im Plan als Stop oder Übernachtung nutzbar.

Nach dem Deploy ggf. Migration anwenden:

```sql
alter type public.spot_category add value if not exists 'unterkunft';
```

(Datei: `supabase/migrations/20260721170000_spot_category_unterkunft.sql`)

Im Supabase Dashboard unter **Authentication → URL Configuration** die Site URL und Redirect URLs setzen, z. B.:

- `http://localhost:3000`
- `http://localhost:3000/auth/callback`
- `https://vacation-bice.vercel.app`
- `https://vacation-bice.vercel.app/auth/callback`

## Routen

| Pfad | Inhalt |
| --- | --- |
| `/` | Landing |
| `/login`, `/signup` | Auth (E-Mail + Passwort) |
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
