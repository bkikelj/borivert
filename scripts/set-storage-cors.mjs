// Jednokratna postavka: dopusti pregledniku (fetch iz browsera) da procita GPX
// datoteke sa Storage bucketa. Bez ovoga Google Cloud Storage po defaultu
// odbija cross-origin fetch s nase stranice ("NetworkError when attempting to
// fetch resource"), iako je link ispravan i dostupan (npr. direktno u novom
// tabu radi, ali fetch() iz JS-a ne).
//
// Pokretanje: node scripts/set-storage-cors.mjs

import { cert, initializeApp } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { readFileSync } from 'node:fs'

const serviceAccount = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url)))

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: 'borivert-9c814.firebasestorage.app',
})

const bucket = getStorage().bucket()

await bucket.setCorsConfiguration([
  {
    origin: ['https://bkikelj.github.io', 'http://localhost:5173'],
    method: ['GET'],
    maxAgeSeconds: 3600,
    responseHeader: ['Content-Type'],
  },
])

console.log('Gotovo — Storage bucket sad dopusta GET/fetch s https://bkikelj.github.io i http://localhost:5173.')
