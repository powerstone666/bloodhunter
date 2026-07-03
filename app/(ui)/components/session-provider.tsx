"use client"

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import { useSyncExternalStore } from "react"

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  if (!mounted) {
    return <>{children}</>
  }

  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
}
