import { useCallback, useEffect, useState } from 'react'

/**
 * Loading / error / data for one API call, plus a reload().
 *
 * Every screen that fetches needs the same three states, and without this
 * they each end up doing it slightly differently.
 */
export function useAsync(fn, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const run = useCallback(() => {
    let alive = true
    setLoading(true)
    setError('')
    fn()
      .then((result) => alive && setData(result))
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(run, [run])

  return { data, error, loading, reload: run }
}
