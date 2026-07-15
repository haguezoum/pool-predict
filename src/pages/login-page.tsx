import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/auth-context'
import { FortyTwoLogo } from '@/components/icons/forty-two-logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const LOGIN_BACKGROUND_URL = '/login-background.jpg'

export function LoginPage() {
  const { isAuthenticated, isLoading, loginWith42 } = useAuth()
  const [searchParams] = useSearchParams()

  const error = searchParams.get('error')
  const errorMessage = error
    ? {
        INELIGIBLE_CAMPUS: 'Only active students from the 1337 MED Tetouan campus can join.',
        POOLER_ACCESS_DENIED: 'Current poolers cannot enter the prediction platform.',
        USER_KIND_NOT_ALLOWED: 'This type of 42 account is not allowed to join.',
        STAFF_ACCESS_DENIED: 'Staff accounts cannot join this student leaderboard.',
        INELIGIBLE_STUDENT: 'Only active 42-core students can join.',
        SOURCE_UNAVAILABLE: '42 is temporarily unavailable. Please try again shortly.',
        INVALID_OAUTH_STATE: 'The sign-in request expired. Please start again.',
      }[error] ?? 'Sign-in could not be completed. Please try again.'
    : null

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${LOGIN_BACKGROUND_URL}")` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/35 via-slate-950/50 to-slate-950/80"
      />

      <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
        <ThemeToggle className="bg-black/25 text-white backdrop-blur-sm hover:bg-black/40 hover:text-white" />
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <img
            src="/logo.png"
            alt="1337 Pool"
            className="size-20 rounded-2xl object-contain shadow-lg shadow-primary/25"
          />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-3xl">
              1337 Pool Predict
            </h1>
          </div>
        </div>

        <Card className="w-full bg-card/95 shadow-2xl shadow-black/30 backdrop-blur-md">
          <CardHeader className="text-center">
            <CardTitle className="text-base">Welcome back</CardTitle>
            <CardDescription>
              Sign in with your Intra 42 account to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage ? (
              <p className="mb-4 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            ) : null}
            <Button
              type="button"
              size="lg"
              className="h-11 w-full gap-2.5 text-sm font-medium"
              onClick={loginWith42}
              disabled={isLoading}
            >
              <FortyTwoLogo data-icon="inline-start" className="size-5" />
              {isLoading ? 'Checking session…' : 'Sign in and continue'}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-white/70 drop-shadow-sm">
          Current poolers cannot access the platform.
        </p>
      </div>
    </div>
  )
}
