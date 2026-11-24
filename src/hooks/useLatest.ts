import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * A stable callback that always runs the latest version of `fn` — for event
 * handlers handed to the map, which binds them once per drawn layer.
 */
export function useLatest<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn)
  useLayoutEffect(() => {
    ref.current = fn
  })
  return useCallback((...args: A) => ref.current(...args), [])
}
