import { useState } from 'react'
import type { Theme } from '../hooks/useTheme'
import { GITHUB_URL, ThemeButton } from './Header'

/** Mobile: the header links and theme toggle behind a menu button. */
export function MobileMenu({
  theme,
  onToggleTheme,
  onOpenOm,
  onOpenKolonner,
}: {
  theme: Theme
  onToggleTheme: () => void
  onOpenOm: () => void
  onOpenKolonner: () => void
}) {
  const [open, setOpen] = useState(false)
  const item = 'flex min-h-11 w-full cursor-pointer items-center px-4 text-left font-medium text-ink no-underline hover:bg-seg'
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Meny"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-card bg-surface text-ink shadow-float"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-12 right-0 w-56 overflow-hidden rounded-card border border-line bg-surface py-1 shadow-float">
          <button type="button" className={item} onClick={() => (setOpen(false), onOpenOm())}>
            Om dataene
          </button>
          <button type="button" className={item} onClick={() => (setOpen(false), onOpenKolonner())}>
            Kolonner
          </button>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={item}>
            GitHub
          </a>
          <div className="flex items-center justify-between px-4 py-1">
            <span className="text-ink-2">Tema</span>
            <ThemeButton theme={theme} onToggle={onToggleTheme} />
          </div>
        </div>
      )}
    </div>
  )
}
