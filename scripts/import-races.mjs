// Jednokratni uvoz pocetnih utrka iz Trail_2026_2027.xlsx u Firestore.
//
// Priprema prije pokretanja:
//   1. Firebase konzola -> Project settings -> Service accounts -> Generate new private key
//   2. Spremi preuzetu datoteku kao borivert/serviceAccountKey.json (vec je u .gitignore)
//   3. npm install firebase-admin
//   4. node scripts/import-races.mjs
//
// NAPOMENA: datum "Malinska trail" u izvornoj tablici pise 08.11.2025., iako je
// upisana pod razdjelnikom "Listopad 2026." — moguca je greska pri unosu u Excelu.
// Ovdje je prenesen doslovno kako pise; provjeri i po potrebi ispravi u aplikaciji.

import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'

const serviceAccount = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url)))

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const races = [
  {
    naziv: '2. kolo MTL - Maruševac trail',
    tip: 'trail',
    lokacija: 'Zagreb',
    datumPocetka: Timestamp.fromDate(new Date('2026-09-06T10:00:00+02:00')),
    vrijemePocetka: '10:00',
    duljinaKm: 11.3,
    visinaM: null,
    dugaUtrka: false,
    statusPrijave: 'prijavljeno',
    startninaPlacena: false,
    link: null,
    napomene: null,
  },
  {
    naziv: 'Rab trail',
    tip: 'trail',
    lokacija: 'Rab',
    datumPocetka: Timestamp.fromDate(new Date('2026-09-26T11:30:00+02:00')),
    vrijemePocetka: '11:30',
    duljinaKm: 23,
    visinaM: 500,
    dugaUtrka: false,
    statusPrijave: 'prijavljeno',
    startninaPlacena: false,
    link: 'https://www.outdoor.hr/rab',
    napomene: null,
  },
  {
    naziv: 'Malinska trail',
    tip: 'trail',
    lokacija: 'Malinska, Krk',
    datumPocetka: Timestamp.fromDate(new Date('2025-11-08T09:00:00+01:00')), // vidi napomenu gore
    vrijemePocetka: '09:00',
    duljinaKm: 24,
    visinaM: null,
    dugaUtrka: false,
    statusPrijave: 'planirano',
    startninaPlacena: false,
    link: null,
    napomene: null,
  },
]

for (const race of races) {
  const ref = await db.collection('races').add(race)
  console.log(`Dodano: ${race.naziv} -> ${ref.id}`)
}

console.log('Gotovo.')
