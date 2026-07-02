import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function storedTheme(): Theme | null {
  const value = localStorage.getItem(STORAGE_KEY)
  return value === 'light' || value === 'dark' ? value : null
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

/**
 * Follows the OS color scheme until the user makes an explicit choice with the
 * toggle; the choice is persisted in localStorage and wins on later visits.
 * (index.html applies the same logic inline before first paint to avoid a
 * flash of the wrong theme.)
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? systemTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Track OS changes only while the user hasn't overridden the theme.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (storedTheme() === null) setTheme(systemTheme())
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  return { theme, toggleTheme }
}
