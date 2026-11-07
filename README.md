# MERT FBŐ napló

A MERT fegyveres biztonsági őrség (FBŐ) szolgálati naplóinak webalkalmazása.
A WordPress + Gravity Forms alapú rendszert váltja ki: telepíthető webalkalmazás
(PWA) asztali gépre, tabletre és mobilra, offline rögzítéssel.

Tervek:
- [Rendszerleltár és migrációs alap](https://claude.ai/artifact/XSpSucHgrEC8jkYxEZ79cW)
- [Architektúra- és adatmodell-terv](https://claude.ai/artifact/H13ph6PFeTP3Fc7CjqbuSd)

## Felépítés

| Mappa | Tartalom |
| --- | --- |
| `packages/shared` | Közös típusok és Zod-sémák: jogosultsági mátrix, rekord-életciklus, beosztás-konfiguráció |
| `apps/api` | Fastify-szerver: bejelentkezés, jogosultság, adatbázis (Drizzle + MariaDB), a PWA kiszolgálása |
| `apps/web` | React PWA (Vite, Tailwind, TanStack Query, service worker) |
| `docker/` | Docker-kép a későbbi költözéshez |

Az üzleti szabályok (ki mit tehet, milyen sorrendben írnak alá, mikor zárolt egy
rekord) a `packages/shared`-ben vannak, és a szerver érvényesíti őket. A felület
csak tükrözi ezeket.

## Fejlesztés

Kell: Node.js 22, pnpm 10, MariaDB 10.6+.

```bash
pnpm install
pnpm build                      # shared + api + web
pnpm test                       # minden teszt

cp .env.example apps/api/.env   # majd töltsd ki
export $(grep -v '^#' apps/api/.env | xargs)
pnpm db:migrate                 # adatbázis-táblák
FBO_NEW_PASSWORD='...' node apps/api/dist/cli/create-user.js --username admin --role admin

pnpm dev:api                    # http://127.0.0.1:3000
pnpm dev:web                    # http://127.0.0.1:5173 (az /api hívásokat a szerverre továbbítja)
```

Adatbázis-séma módosítása: `apps/api/src/db/schema.ts`, majd `pnpm db:generate`
új migrációt készít az `apps/api/migrations` mappába.

## Telepítés a cPanel-tárhelyre

1. A gépeden vagy a CI-ban: `pnpm install && pnpm build`.
2. cPanel → **MySQL Databases**: adatbázis és felhasználó létrehozása.
3. cPanel → **Setup Node.js App**: Node 20 (legalább 20.2), alkalmazásgyökér a
   feltöltött mappa, indítófájl `apps/api/dist/server.js`, URL `fbo.mert.enaplo.eu`.
   A környezeti változókat a `.env.example` alapján ott kell megadni.
4. A felület terminálján: `pnpm db:migrate`, első telepítéskor `create-user`.
5. **Restart**.

A szerver Node 20.2-n is fut (ezt a CI minden változásnál ellenőrzi). A buildhez
(Vite) Node 22 kell, ezért a build a fejlesztőgépen vagy a CI-ban készül.

## Offline működés

- Minden rögzítés előbb a készüléken (IndexedDB) kerül egy kimenő sorba, saját UUID-vel,
  és a `SyncEngine` (`apps/web/src/offline/sync.ts`) sorrendben küldi fel a `POST /api/sync`-re.
- A szerver a művelet azonosítója alapján felismeri az ismételt beküldést (`sync_op` tábla),
  így elveszett válasz esetén sem rögzít semmit kétszer.
- Új művelettípus: kezelő az `apps/api/src/sync/handlers.ts`-be; ugyanazt az üzleti
  logikát hívja, mint a közvetlen API-végpont.
- A törzsadat (`GET /api/bootstrap`) bejelentkezéskor és óránként letöltődik a készülékre.
- Kijelentkezéskor és 7 nap inaktivitás után a helyi adat törlődik; feltöltetlen rögzítés
  esetén a kilépés előtt figyelmeztet. Offline indulásnál a legutóbbi bejelentkezés
  legfeljebb 12 óráig használható.

## Biztonsági alapelvek

- Jelszó: scrypt (Node beépített, natív függőség nélkül), legalább 10 karakter, betű és szám.
- Munkamenet: véletlen token httpOnly, Secure, SameSite=Lax sütiben; az adatbázisban csak a hash-e.
- Bejelentkezés: 5 sikertelen próbálkozás / 15 perc / felhasználó + IP.
- Minden módosítás és bejelentkezés az `audit_log`-ba kerül.
- Az aláírt rekord a szerveren zárolt; hiba esetén helyesbítő rekord készül.
