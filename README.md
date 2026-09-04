# Borivert

Osobni planer i dnevnik trail utrka. Boris + vertical.

## Razvoj

```bash
npm install
cp .env.example .env   # popuni Firebase vrijednostima (Firebase konzola -> Project settings -> Your apps)
npm run dev
```

## Firebase — postava (konzola)

1. Kreiraj projekt na https://console.firebase.google.com
2. Build -> Authentication -> Sign-in method -> uključi **Google** i **Email/Password**
3. Authentication -> Settings -> Multi-factor authentication -> uključi **SMS** (potrebno za `/admin/sigurnost`)
4. Build -> Firestore Database -> Create database
5. Build -> Storage -> Get started
6. Build -> App Check -> Apps -> registriraj web app -> **reCAPTCHA v3** -> kopiraj site key u `.env` kao `VITE_RECAPTCHA_SITE_KEY`
   (Enforce za Firestore/Storage/Functions uključi tek NAKON što je nova verzija sa App Check kodom live — inače blokiraš i sebe.)
7. Project settings -> General -> Your apps -> Add app -> Web -> kopiraj konfiguraciju u `.env`

## Firebase — postava (tvoje računalo, izvan ovog VM-a)

Ovaj sandboxed VM nema mrežni pristup Google/Firebase API-jima, pa sljedeće mora ići
s tvog pravog terminala:

```bash
npm install -g firebase-tools
firebase login
cd borivert
firebase use --add        # odaberi svoj Firebase projekt, alias "default"
firebase deploy --only firestore:rules,storage:rules,functions
```

Nakon prvog deploya funkcija provjeri: Authentication -> Settings -> Blocking functions —
`beforeCreate` bi trebao biti automatski registriran na `beforeCreate` funkciju; ako nije,
poveži ga ručno tu.

## Deploy web aplikacije

Push na `main` granu automatski builda i deploya na GitHub Pages (`.github/workflows/deploy.yml`).
Prije prvog uspješnog builda:

1. Repo -> Settings -> Pages -> Source: **GitHub Actions** (već postavljeno)
2. Repo -> Settings -> Secrets and variables -> Actions -> dodati 7 secreta:
   6x `VITE_FIREBASE_*` + `VITE_RECAPTCHA_SITE_KEY` (iste vrijednosti kao u `.env`)

## Sigurnosni model

- **Čitanje** (utrke/treninzi): smije svatko prijavljen — admin ili gost.
- **Pisanje**: samo vlasnik (`boris.kikelj@gmail.com`), i samo ako podaci prođu validaciju
  oblika (`firestore.rules`).
- **Kreiranje gostujućih naloga**: isključivo preko `/admin/korisnici`, koji poziva
  `createViewerAccount` Cloud Function (Admin SDK, provjerava da pozivatelj jest vlasnik).
- **Blokirana samoprijava**: `functions/index.js` → `beforeCreate` odbija svaki novi Firebase
  Auth nalog osim tvoje vlastite Google prijave. Zaobilazi ga samo Admin SDK (gornja funkcija),
  što je namjeravano.
- **App Check**: odbacuje pozive prema Firestore/Storage/Functions koji ne dolaze iz ove
  aplikacije (reCAPTCHA v3).
- **MFA**: `/admin/sigurnost` — SMS drugi faktor za tvoj račun.

## Uvoz početnih podataka

```bash
npm install firebase-admin
node scripts/import-races.mjs
```

Vidi komentar na vrhu `scripts/import-races.mjs` za pripremu service account ključa.

## Projektni zadatak

Puni nacrt (opseg, podatkovni model, arhitektura, faze) je u projektnom zadatku "Borivert" —
ovaj README pokriva samo tehničku postavu.
