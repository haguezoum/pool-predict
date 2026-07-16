import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/auth-context'
import { ThemeProvider } from '@/context/theme-context'
import { AppShell } from '@/components/layout/app-shell'
import { ProtectedRoute } from '@/components/layout/protected-route'

const HomePage = lazy(() => import('@/pages/home-page').then((module) => ({ default: module.HomePage })))
const LeaderboardPage = lazy(() =>
  import('@/pages/leaderboard-page').then((module) => ({ default: module.LeaderboardPage }))
)
const LoginPage = lazy(() => import('@/pages/login-page').then((module) => ({ default: module.LoginPage })))
const ProfilePage = lazy(() =>
  import('@/pages/profile-page').then((module) => ({ default: module.ProfilePage }))
)
const PlayerProfilePage = lazy(() =>
  import('@/pages/player-profile-page').then((module) => ({ default: module.PlayerProfilePage }))
)

function RouteFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
      Loading…
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
