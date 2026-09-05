// Analiza opterecenja i razmaka izmedju utrka.
//
// Dva sloja, namjerno odvojena:
// 1) Jednostavno, objasnjivo pravilo (ekvivalentna udaljenost + tablica preporucenog
//    oporavka) - radi uvijek, cak i bez ijednog uvezenog treninga.
// 2) Gruba procjena stvarnog opterecenja iz uvezenih Garmin aktivnosti (pojednostavljeni
//    TRIMP + acute:chronic omjer). Ovo je koristan signal, ali NE dokazana znanost -
//    acute:chronic omjer (Gabbett i dr.) je u sportskoj znanosti prilicno osporavan
//    zadnjih godina (kriticari: Impellizzeri, Bornn i dr. - "sweet spot" pragovi su se
//    dijelom pokazali kao statisticki artefakt). Koristimo ga kao grubi indikator naglog
//    skoka opterecenja, ne kao pouzdan prediktor ozljede.

import { procijeniTrajanjeMin } from './pace'

// --- Sloj 1: ekvivalentna udaljenost + preporuceni oporavak ---

// Gruba, u trail-trcanju cesto koristena varijanta Naismithovog pravila: svakih 100m
// uspona ~ dodatnih 1km ravnog terena.
export function ekvivalentnaUdaljenostKm(km, usponM) {
  if (!km) return 0
  return km + (usponM || 0) / 100
}

// Sidrisne tocke temeljem opcih coaching preporuka (McMillan Running, myMottiv i dr.)
// za minimalni oporavak prije sljedeceg teskog napora. Linearno interpoliramo izmedju
// njih. Ovo su okvirne vrijednosti za kalibrirati na temelju stvarnog osjecaja, ne
// kruta znanost.
const SIDRISTA_OPORAVKA = [
  [10, 4],
  [21, 8],
  [50, 12],
  [80, 18],
  [100, 24],
  [160, 40],
]

export function potrebanOporavakDana(eqKm) {
  if (eqKm <= SIDRISTA_OPORAVKA[0][0]) return SIDRISTA_OPORAVKA[0][1]
  for (let i = 1; i < SIDRISTA_OPORAVKA.length; i++) {
    const [x0, y0] = SIDRISTA_OPORAVKA[i - 1]
    const [x1, y1] = SIDRISTA_OPORAVKA[i]
    if (eqKm <= x1) {
      const t = (eqKm - x0) / (x1 - x0)
      return y0 + t * (y1 - y0)
    }
  }
  return SIDRISTA_OPORAVKA[SIDRISTA_OPORAVKA.length - 1][1]
}

function datumUtrke(utrka) {
  const v = utrka?.datumPocetka
  if (!v) return null
  const d = v.toDate ? v.toDate() : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

// Usporedi dvije KRONOLOSKI UZASTOPNE utrke (A prije B). Ako je B puno laksa od A
// (manje od ~40% ekvivalentne udaljenosti), tretiramo je kao lagan/oporavni napor i
// trazimo samo mali sigurnosni razmak umjesto punog oporavka.
export function analizirajRazmakPara(utrkaA, utrkaB) {
  const datumA = datumUtrke(utrkaA)
  const datumB = datumUtrke(utrkaB)
  if (!datumA || !datumB) return null

  const eqA = ekvivalentnaUdaljenostKm(utrkaA.duljinaKm, utrkaA.visinaM)
  const eqB = ekvivalentnaUdaljenostKm(utrkaB.duljinaKm, utrkaB.visinaM)
  if (!eqA || !eqB) return null

  const gapDana = Math.round((datumB - datumA) / 86400000)
  const omjer = eqB / eqA
  const punOporavak = potrebanOporavakDana(eqA)
  const lagan = omjer < 0.4
  const potrebnoDana = Math.round(lagan ? Math.max(3, punOporavak * 0.25) : punOporavak)

  return { gapDana, potrebnoDana, upozorenje: gapDana < potrebnoDana, lagan }
}

// Prodji kroz sve utrke (kronoloski) i vrati Map raceId -> upozorenje, za svaku utrku
// kojoj je susjedna utrka (prije ili poslije) prebliza s obzirom na procijenjeni oporavak.
export function analizirajRazmakSvihUtrka(utrke) {
  const sortirane = [...utrke]
    .filter((u) => datumUtrke(u))
    .sort((a, b) => datumUtrke(a) - datumUtrke(b))

  const rezultati = new Map()
  for (let i = 1; i < sortirane.length; i++) {
    const a = sortirane[i - 1]
    const b = sortirane[i]
    const analiza = analizirajRazmakPara(a, b)
    if (!analiza || !analiza.upozorenje) continue
    if (!rezultati.has(b.id)) rezultati.set(b.id, { ...analiza, susjed: a, smjer: 'prije' })
    if (!rezultati.has(a.id)) rezultati.set(a.id, { ...analiza, susjed: b, smjer: 'poslije' })
  }
  return rezultati
}

// --- Sloj 2: opterecenje iz stvarnih (uvezenih) aktivnosti ---

// Vrste aktivnosti koje racunamo kao trcacko opterecenje (ne biciklizam, hodanje...).
const TRCACKE_VRSTE = /trčanje|trcanje/i

export function jeTrcanje(aktivnost) {
  return TRCACKE_VRSTE.test(aktivnost.vrstaAktivnosti || '')
}

// Ako nema podataka o pulsu, koristimo razumnu zadanu vrijednost (190) dok se ne
// uveze prvi CSV - inace uzimamo najvisi zabiljezeni puls iz stvarnih aktivnosti.
export function procijeniOsobniMaxPuls(aktivnosti) {
  const maxevi = aktivnosti
    .map((a) => a.maksimalniPuls)
    .filter((v) => typeof v === 'number' && v > 0)
  return maxevi.length ? Math.max(...maxevi, 190) : 190
}

// Pojednostavljeni TRIMP: trajanje x relativni intenzitet (prosjecni puls / osobni max).
export function izracunajOpterecenjeAktivnosti(aktivnost, osobniMaxPuls) {
  if (!aktivnost.trajanjeMin || !aktivnost.prosjecniPuls) return null
  return aktivnost.trajanjeMin * (aktivnost.prosjecniPuls / osobniMaxPuls)
}

// Relativni intenzitet buduce (jos neodradjene) utrke - nema stvarnog pulsa pa
// procjenjujemo iz tipa staze (kalibrirano grubo iz Borisovih podataka: kratke/cestovne
// utrke su blize maksimalnom naporu, ultra trail se vozi konzervativnije).
const RELATIVNI_INTENZITET_PO_TIPU = { cesta: 0.88, trail: 0.75 }

export function procijeniOpterecenjeUtrke(utrka) {
  const trajanje = procijeniTrajanjeMin(utrka.tip, utrka.duljinaKm, utrka.visinaM)
  if (trajanje == null) return null
  const intenzitet = RELATIVNI_INTENZITET_PO_TIPU[utrka.tip] || 0.8
  return trajanje * intenzitet
}

// Acute:chronic stil (Gabbett i dr.) - akutno (zbroj zadnjih 7 dana) naspram kronicnog
// (prosjecno tjedno opterecenje zadnjih 28 dana). NIJE pouzdan prediktor ozljede (vidi
// napomenu na vrhu datoteke) - koristi se samo kao grub signal naglog skoka.
export function izracunajTjednoOpterecenje(dogadjaji, referentniDatum = new Date()) {
  const dan = 86400000
  const razlikaDana = (d) => (referentniDatum - d.datum) / dan

  const akutno = dogadjaji
    .filter((d) => razlikaDana(d) >= 0 && razlikaDana(d) < 7)
    .reduce((s, d) => s + d.opterecenje, 0)

  const kronicnoZbroj = dogadjaji
    .filter((d) => razlikaDana(d) >= 0 && razlikaDana(d) < 28)
    .reduce((s, d) => s + d.opterecenje, 0)
  const kronicnoTjedno = kronicnoZbroj / 4

  if (!kronicnoTjedno) return { akutno, kronicnoTjedno, omjer: null, status: 'nedovoljno podataka' }

  const omjer = akutno / kronicnoTjedno
  let status = 'uravnoteženo'
  if (omjer < 0.8) status = 'nisko'
  else if (omjer > 1.5) status = 'visoko'
  else if (omjer > 1.3) status = 'povišeno'

  return { akutno, kronicnoTjedno, omjer, status }
}

// Pretvori uvezene aktivnosti (i odradjene utrke koje se pojave medju njima, jer ih
// Garmin snima kao obicnu aktivnost) u niz dogadjaja opterecenja za gornju funkciju.
export function aktivnostiUDogadjaje(aktivnosti) {
  const osobniMaxPuls = procijeniOsobniMaxPuls(aktivnosti)
  return aktivnosti
    .filter(jeTrcanje)
    .map((a) => ({ datum: a.datum, opterecenje: izracunajOpterecenjeAktivnosti(a, osobniMaxPuls) }))
    .filter((d) => d.opterecenje != null)
}

// Za buducu utrku: kakav bi acute:chronic omjer bio na dan utrke, ako se doda njena
// procijenjena projekcija opterecenja na postojece (stvarne) dogadjaje.
export function procijeniOmjerZaBuducuUtrku(utrka, dogadjaji) {
  const datum = datumUtrke(utrka)
  const projekcija = procijeniOpterecenjeUtrke(utrka)
  if (!datum || projekcija == null) return null

  const referentniDatum = new Date(datum.getTime() + 86400000) // dan nakon utrke
  const prosireni = [...dogadjaji, { datum, opterecenje: projekcija }]
  return izracunajTjednoOpterecenje(prosireni, referentniDatum)
}
