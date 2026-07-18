import { motion, useReducedMotion } from 'motion/react'
import { InfoIcon, ShieldCheckIcon } from 'lucide-react'
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
import { GlassSurface } from '@/components/ui/glass-surface'

const LOGIN_BACKGROUND_URL = '/login-background.jpg'

export function LoginPage() {
  const { isAuthenticated, isLoading, loginWith42 } = useAuth()
  const [searchParams] = useSearchParams()
  const reducedMotion = useReducedMotion()

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

  const enter = reducedMotion
    ? { initial: false as const, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 14, filter: 'blur(4px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
      }

  return (
    <div className="app-atmosphere relative min-h-svh overflow-hidden bg-slate-950 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${LOGIN_BACKGROUND_URL}")` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,oklch(0.11_0.04_257/88%)_0%,oklch(0.15_0.05_255/68%)_44%,oklch(0.12_0.035_258/52%)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_74%_35%,oklch(0.61_0.17_244/20%),transparent_28rem)]"
      />

      <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-3 z-20 sm:top-5 sm:left-5">
        <GlassSurface variant="clear" className="rounded-2xl p-1">
          <ThemeToggle className="text-white hover:bg-white/12 hover:text-white" />
        </GlassSurface>
      </div>

      <main className="relative z-10 mx-auto grid min-h-svh w-full max-w-6xl items-center gap-8 px-5 py-20 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.72fr)] lg:px-10">
        <motion.section
          {...enter}
          transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.2, 0, 0, 1] }}
          className="flex flex-col items-center gap-7 text-center lg:items-start lg:text-left"
        >
          <div className="flex items-end gap-3">
            <img
              src="/wa-validi.webp"
              alt="1337 Pool"
              className="h-28 w-auto object-contain sm:h-36"
            />
            <div className="pb-3">
              <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-white/62 uppercase">
                42 Network · Tetouan
              </p>
              <p className="mt-1 text-xl font-semibold tracking-[-0.025em] sm:text-2xl">
                1337X Bet
              </p>
            </div>
          </div>

          <div className="max-w-xl">
            <h1 className="text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">
              Predict the pool.
              <span className="block text-white/58">Follow every result.</span>
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/68 sm:text-base">
              A private leaderboard for active 42 core students, built around live pool
              progress and exam outcomes.
            </p>
          </div>

          <GlassSurface
            variant="clear"
            className="max-w-xl rounded-[1.5rem] p-4 text-left text-white"
          >
            <div className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/82">
                <InfoIcon className="size-[1.05rem]" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">A note for poolers</p>
                <p className="mt-1 text-xs leading-5 text-white/66">
                  If anything feels offensive or you want your 42 data removed, send your
                  login to{' '}
                  <a
                    href="https://discordapp.com/users/ops_up"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-white underline decoration-white/35 underline-offset-2"
                  >
                    @ops_up
                  </a>
                  . We’ll take care of it.
                </p>
              </div>
            </div>
          </GlassSurface>
        </motion.section>

        <motion.section
          {...enter}
          transition={{
            duration: reducedMotion ? 0 : 0.3,
            delay: reducedMotion ? 0 : 0.08,
            ease: [0.2, 0, 0, 1],
          }}
          className="mx-auto w-full max-w-md"
        >
          <GlassSurface variant="elevated" className="rounded-[2rem] p-2 text-foreground">
            <Card className="rounded-[1.5rem] bg-card/86 shadow-none">
              <CardHeader className="gap-2 text-center">
                <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <ShieldCheckIcon className="size-5" />
                </span>
                <CardTitle className="text-xl">Welcome back</CardTitle>
                <CardDescription>
                  Continue with the Intra account connected to your 42 profile.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {errorMessage ? (
                  <div
                    role="alert"
                    className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive shadow-[0_0_0_1px_color-mix(in_oklch,var(--destructive),transparent_76%)_inset]"
                  >
                    {errorMessage}
                  </div>
                ) : null}
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  onClick={loginWith42}
                  disabled={isLoading}
                >
                  <FortyTwoLogo data-icon="inline-start" />
                  {isLoading ? 'Checking session…' : 'Sign in with 42'}
                </Button>
                <p className="text-center text-xs leading-5 text-muted-foreground">
                  Current poolers and staff accounts cannot access the platform.
                </p>
              </CardContent>
            </Card>
          </GlassSurface>
          <p className="mt-4 text-center text-[0.68rem] text-white/54">
            Predictions remain hidden from other players until each exam ends.
          </p>
        </motion.section>
      </main>
    </div>
  )
}
