import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/auth-context'
import { ThemeProvider } from '@/context/theme-context'
import { AppShell } from '@/components/layout/app-shell'
import { ProtectedRoute } from '@/components/layout/protected-route'
import { GlassSurface } from '@/components/ui/glass-surface'
import { Skeleton } from '@/components/ui/skeleton'
// Eager: login must paint the seized banner immediately (no Suspense skeleton first).
import { LoginPage } from '@/pages/login-page'

const HomePage = lazy(() => import('@/pages/home-page').then((module) => ({ default: module.HomePage })))
const LeaderboardPage = lazy(() =>
  import('@/pages/leaderboard-page').then((module) => ({ default: module.LeaderboardPage }))
)
const ProfilePage = lazy(() =>
  import('@/pages/profile-page').then((module) => ({ default: module.ProfilePage }))
)
const PlayerProfilePage = lazy(() =>
  import('@/pages/player-profile-page').then((module) => ({ default: module.PlayerProfilePage }))
)

function RouteFallback() {
  return (
    <div className="app-atmosphere grid min-h-svh place-items-center p-4">
      <GlassSurface variant="regular" className="w-full max-w-sm rounded-3xl p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-2xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2.5 w-44 max-w-full" />
          </div>
        </div>
      </GlassSurface>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Login is eager so the seized banner is never blocked by RouteFallback */}
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route index element={<HomePage />} />
                  <Route path="leaderboard" element={<LeaderboardPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="profile/:intraUserId" element={<PlayerProfilePage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
