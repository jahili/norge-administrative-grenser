import { useEffect, useMemo, useState } from 'react'
import { loadGrunnkretser } from '../lib/grunnkretser'
import type { GrunnkretsTopology } from '../lib/grunnkretser'

export interface GrunnkretsState {
  /** Loaded fylke files, by fylkesnummer. */
  topologies: Map<string, GrunnkretsTopology>
  /** Fylker still loading. */
  loading: string[]
  /** Fylker that failed to load, with the error message. */
  errors: Map<string, string>
}

/**
 * Loads the grunnkrets files for `fylkesnumre` (only when `enabled`). Files
 * stay cached for the session, so toggling back and forth is instant.
 */
export function useGrunnkretser(fylkesnumre: string[], enabled: boolean): GrunnkretsState {
  const [loaded, setLoaded] = useState<Map<string, GrunnkretsTopology>>(new Map())
  const [errors, setErrors] = useState<Map<string, string>>(new Map())
  const key = enabled ? [...fylkesnumre].sort().join(',') : ''

  useEffect(() => {
    if (!key) return
    let cancelled = false
    for (const fylkesnummer of key.split(',')) {
      loadGrunnkretser(fylkesnummer).then(
        (topology) => {
          if (cancelled) return
          setLoaded((prev) => (prev.get(fylkesnummer) === topology ? prev : new Map(prev).set(fylkesnummer, topology)))
          setErrors((prev) => {
            if (!prev.has(fylkesnummer)) return prev
            const next = new Map(prev)
            next.delete(fylkesnummer)
            return next
          })
        },
        (error: unknown) => {
          if (!cancelled) setErrors((prev) => new Map(prev).set(fylkesnummer, error instanceof Error ? error.message : String(error)))
        },
      )
    }
    return () => {
      cancelled = true
    }
  }, [key])

  // Stable between renders unless something actually changed, since callers
  // derive (expensive) grunnkrets features from it.
  return useMemo(() => {
    const wanted = key ? key.split(',') : []
    return {
      topologies: new Map(wanted.filter((nr) => loaded.has(nr)).map((nr) => [nr, loaded.get(nr)!])),
      loading: wanted.filter((nr) => !loaded.has(nr) && !errors.has(nr)),
      errors: new Map(wanted.filter((nr) => errors.has(nr)).map((nr) => [nr, errors.get(nr)!])),
    }
  }, [key, loaded, errors])
}
