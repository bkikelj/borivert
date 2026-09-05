// Zajednicke funkcije za prikaz datuma u cijeloj aplikaciji (uvijek DD.MM.GGGG.,
// neovisno o uredjaju/pregledniku) i za kalendarski prikaz (kratice/puni nazivi mjeseci).

export const MJESEC_KRATICE = [
  'SIJ', 'VELJ', 'OŽU', 'TRA', 'SVI', 'LIP', 'SRP', 'KOL', 'RUJ', 'LIS', 'STU', 'PRO',
]

export const MJESEC_PUNI = [
  'Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
  'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac',
]

export function toDate(value) {
  if (!value) return null
  return value.toDate ? value.toDate() : new Date(value)
}

export function formatDate(value) {
  const d = toDate(value)
  if (!d) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}.`
}

// Za "znacku" datuma na kartici utrke (dan istaknut, mjesec skracen, godina sitno).
export function formatDateParts(value) {
  const d = toDate(value)
  if (!d) return null
  return {
    dan: String(d.getDate()).padStart(2, '0'),
    mjesec: MJESEC_KRATICE[d.getMonth()],
    godina: d.getFullYear(),
  }
}
