import { useEffect, useState } from "react"

export const useDebouncedValue = <T>(value: T, delay = 100) => {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(handle)
  }, [value, delay])

  return debounced
}
