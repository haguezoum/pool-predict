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
        INELIGIBLE_CAMPUS: 'Your primary 42 campus is not enabled for this predictor.',
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

      <div className="absolute top-4 left-4 z-20 sm:top-6 sm:left-6">
        <ThemeToggle className="bg-black/25 text-white backdrop-blur-sm hover:bg-black/40 hover:text-white" />
      </div>

      <div className="absolute top-4 right-4 z-20 max-w-[min(100%-2rem,20rem)] sm:top-6 sm:right-6 sm:max-w-xs">
        <div className="rounded-md border border-white/15 bg-black px-3 py-2.5 font-mono text-[11px] leading-relaxed text-white shadow-lg sm:text-xs">
          <p className="mb-1.5 font-semibold tracking-wide text-white/90">
            ⚠️ notice for poolers
          </p>
          <p className="line-clamp-8 text-md">
            If anything here feels offensive, or you want your data or profile removed from this
            platform — including info that comes from the 42 Network API — just reach out with your
            login.
          </p>
          <p className="mt-2">
            Discord:{' '}
            <a
              href="https://discordapp.com/users/ops_up"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-white/40 underline-offset-2 hover:decoration-white"
            >
              @ops_up
            </a>
            <br />
            X / Twitter:{' '}
            <a
              href="https://x.com/hassan_aguezoum"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-white/40 underline-offset-2 hover:decoration-white"
            >
              @hassan_aguezoum
            </a>
          </p>
          <p className="mt-2 text-white/70">
            Your privacy matters. This app only uses 42 data to run predictions — ask anytime and
            we&apos;ll take care of it 🤷.
          </p>
        </div>
      </div>

      <div className="relative z-10 mt-28 flex w-full max-w-sm flex-col items-center gap-8 sm:mt-16 md:mt-0">
        <div className="flex flex-col items-center gap-10 text-center">
          <div className="flex items-center -mt-20 justify-center gap-3 sm:gap-4">
            <img
              src="/wa-validi.webp"
              alt="1337 Pool"
              className="h-32 w-auto object-contain object-top -mt-10 sm:h-40"
            />
            <span className="font-display text-3xl tracking-wide text-white sm:text-4xl">
              (1337X BET)
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-3xl">
            1337 Pool Predict
          </h1>
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
