# Borivert

Osobni planer i dnevnik trail utrka. Boris + vertical.

## Razvoj

```bash
npm install
cp .env.example .env   # popuni Firebase vrijednostima (Firebase konzola -> Project settings -> Your apps)
npm run dev
```

## Firebase

1. Kreiraj projekt na https://console.firebase.google.com
2. Build -> Authentication -> Sign-in method -> uključi Google
3. Build -> Firestore Database -> Create database
4. Build -> Storage -> Get started
5. Project settings -> General -> Your apps -> Add app -> Web -> kopiraj konfiguraciju u `.env`
6. Deploy sigurnosnih pravila (`firestore.rules`, `storage.rules`) — ili ručno zalijepi njihov sadržaj
   u Firebase konzoli (Firestore -> Rules / Storage -> Rules), ili preko Firebase CLI:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init   # odaberi postojeći projekt, Firestore + Storage, prihvati postojeće .rules datoteke
   firebase deploy --only firestore:rules,storage:rules
   ```

## Deploy

Push na `main` grana automatski builda i deploya na GitHub Pages (`.github/workflows/deploy.yml`).
Prije prvog uspješnog builda potrebno je:

1. Repo -> Settings -> Pages -> Source: **GitHub Actions**
2. Repo -> Settings -> Secrets and variables -> Actions -> dodati 6 `VITE_FIREBASE_*` secreta
   (iste vrijednosti kao u `.env`)

## Uvoz pocetnih podataka

```bash
npm install firebase-admin
node scripts/import-races.mjs
```

Vidi komentar na vrhu `scripts/import-races.mjs` za pripremu service account kljuca.

## Projektni zadatak

Puni nacrt (opseg, podatkovni model, arhitektura, faze) je u projektnom zadatku "Borivert" —
ovaj README pokriva samo tehničku postavu.
