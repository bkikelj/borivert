// Procjena trajanja utrke temeljem Borisovog stvarnog tempa iz proslih GPX
// aktivnosti (cesta: 21k + 10k utrke, ponderirano s 10k kruznim treningom;
// trail: Istria 69k, Ivancica 50k, Medvednica 63k utrke + trail trening na
// Sljemenu - izracunato 09/2026). Bez fiksnog "odsjecka" (0 km = 0 min) da
// ekstrapolacija na kracim/duljim stazama ne izade besmislena.
//
// ISTA vrijednost mora ostati usklađena s functions/index.js (koristi se i za
// .ics kalendarski feed) - promijeni na oba mjesta ako se model osvjezi.
export const TEMPO_CESTA_MIN_PO_KM = 4.504
export const TEMPO_TRAIL_MIN_PO_KM = 5.478
export const TEMPO_TRAIL_MIN_PO_M_USPONA = 0.0776

export function procijeniTrajanjeMin(tip, km, usponM) {
  if (!km || km <= 0) return null
  if (tip === 'cesta') return TEMPO_CESTA_MIN_PO_KM * km
  return TEMPO_TRAIL_MIN_PO_KM * km + TEMPO_TRAIL_MIN_PO_M_USPONA * (usponM || 0)
}

export function formatTrajanje(minute) {
  if (minute == null) return null
  const h = Math.floor(minute / 60)
  const m = Math.round(minute % 60)
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}
