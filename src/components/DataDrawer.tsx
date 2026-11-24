import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/** Map overlay, bottom left: opens the column table, with the key column in one line. */
export function DataButton({ nokkel, open, onToggle }: { nokkel: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="data-skuff"
      className="flex cursor-pointer items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 text-left text-ink shadow-float hover:bg-surface-2"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-accent" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M9 10v10" />
      </svg>
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold">Data i filen</span>
        <span className="truncate text-xs text-muted">
          Nøkkel: <span className="font-mono">{nokkel}</span> (tekst, behold ledende null)
        </span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`shrink-0 text-ink-2 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">
        <path d="M6 15l6-6 6 6" />
      </svg>
    </button>
  )
}

/**
 * Drawer over the lower part of the map, holding the column table. Takes the
 * focus when it opens, and gives it back to whatever opened it when closed.
 */
export function DataDrawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    // Safari doesn't focus a clicked button; fall back to «Data i filen».
    const active = document.activeElement
    openerRef.current =
      active instanceof HTMLButtonElement ? active : document.querySelector<HTMLElement>('[aria-controls="data-skuff"]')
    closeRef.current?.focus({ preventScroll: true })
  }, [])

  function close() {
    onClose()
    openerRef.current?.focus({ preventScroll: true })
  }

  return (
    <section
      id="data-skuff"
      aria-labelledby="data-skuff-tittel"
      onKeyDown={(e) => {
        if (e.key === 'Escape') close()
      }}
      className="absolute inset-x-4 bottom-4 z-[1002] flex max-h-[min(70%,640px)] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-[0_8px_32px_rgba(21,32,30,0.2)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-2">
        <h2 id="data-skuff-tittel" className="text-[15px] font-semibold">
          Data i filen
        </h2>
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="Lukk data i filen"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-field text-ink-2 hover:bg-seg"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="overflow-auto px-5 py-4">{children}</div>
    </section>
  )
}
