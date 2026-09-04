const STYLES = {
  planirano: 'bg-surface-2 text-muted',
  prijavljeno: 'bg-good/15 text-good',
  mozda: 'bg-warn/15 text-warn',
  otrcano: 'bg-accent/15 text-accent',
  otkazano: 'bg-long/15 text-long',
}

const LABELS = {
  planirano: 'planirano',
  prijavljeno: 'prijavljeno',
  mozda: 'možda',
  otrcano: 'otrčano',
  otkazano: 'otkazano',
}

export default function StatusPill({ status }) {
  const style = STYLES[status] ?? STYLES.planirano
  const label = LABELS[status] ?? status
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-mono ${style}`}>
      {label}
    </span>
  )
}
