import { useEffect } from 'react'

export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 pt-8 sm:p-4 sm:pt-16"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-line bg-surface p-4 shadow-lg sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Zatvori"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
