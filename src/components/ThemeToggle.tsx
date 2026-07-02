import type { Theme } from '../hooks/useTheme'

interface ThemeToggleProps {
  theme: Theme
  onToggle: () => void
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'Bytt til lyst tema' : 'Bytt til mørkt tema'}
      aria-pressed={isDark}
      title={isDark ? 'Lyst tema' : 'Mørkt tema'}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:focus-visible:outline-slate-100"
    >
      {isDark ? (
        // Sun
        <svg className="h-4.5 w-4.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <circle cx="10" cy="10" r="3.5" />
          <path d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2M16 4l-1.4 1.4M5.4 14.6 4 16M16 16l-1.4-1.4M5.4 5.4 4 4" />
        </svg>
      ) : (
        // Moon
        <svg className="h-4.5 w-4.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 11.5A7 7 0 0 1 8.5 3 7 7 0 1 0 17 11.5Z" />
        </svg>
      )}
    </button>
  )
}
