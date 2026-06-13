"use client"

import { useCallback, useEffect, useState } from "react"
import { useIsLoggedIn } from "@dynamic-labs/sdk-react-core"
import { ApiError, getMe, type Me } from "@/lib/api"

/**
 * Loads the logged-in account from the backend (`GET /api/me`). Works for both
 * the Dynamic session and the import-key session (both set the web cookie), so
 * it always attempts a fetch and re-runs when the Dynamic login state flips.
 * A 401 is treated as "not linked yet" rather than a hard error.
 */
export function useMe() {
  const isLoggedIn = useIsLoggedIn()
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setMe(await getMe())
    } catch (e) {
      setMe(null)
      if (e instanceof ApiError && e.status === 401) {
        setError(null) // simply not authenticated yet
      } else {
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [isLoggedIn, refresh])

  return { me, loading, error, refresh, isLoggedIn }
}
