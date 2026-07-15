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

export function LoginPage() {
  const { isAuthenticated, isLoading, loginWith42 } = useAuth()
  const [searchParams] = useSearchParams()

  const error = searchParams.get('error')
  const errorMessage = error
    ? {
        INELIGIBLE_CAMPUS: 'Only active students from the 1337 MED Tetouan campus can join.',
        POOLER_ACCESS_DENIED: 'Current poolers cannot enter the prediction platform.',
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
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Atmosphere — logo navy + electric blue */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.55_0.14_241_/_0.18),transparent)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.45_0.14_241_/_0.35),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,oklch(0.45_0.08_258_/_0.12),transparent_50%)] dark:bg-[radial-gradient(circle_at_80%_80%,oklch(0.30_0.08_258_/_0.35),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <img
            src="/logo.png"
            alt="1337 Pool"
            className="size-20 rounded-2xl object-contain shadow-lg shadow-primary/25"
          />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              1337 Pool Predict
            </h1>
            <p className="max-w-xs text-sm text-muted-foreground leading-relaxed">
              Predict Piscine Exam 00–03 outcomes. Only active 42-core students
              from 1337 MED Tetouan can join.
            </p>
          </div>
        </div>

        <Card className="w-full shadow-xl shadow-black/5">
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

        <p className="text-center text-xs text-muted-foreground">
          Current poolers cannot access the platform.
        </p>
      </div>
    </div>
  )
}
