import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import type { User } from '@/types'

type AuthContextValue = {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  loginWith42: () => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { data, isPending } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.me()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    staleTime: 15_000,
  })

  const loginWith42 = useCallback(() => {
    window.location.assign('/api/auth/42')
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    queryClient.setQueryData(['me'], null)
    queryClient.removeQueries({ queryKey: ['pool'] })
    queryClient.removeQueries({ queryKey: ['bets'] })
  }, [queryClient])

  const value = useMemo(
    () => ({
      user: data ?? null,
      isAuthenticated: Boolean(data),
      isLoading: isPending,
      loginWith42,
      logout,
    }),
    [data, isPending, loginWith42, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with provider
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
