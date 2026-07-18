import { lazy, startTransition, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import {
  CheckIcon,
  EyeIcon,
  ListChecksIcon,
  Maximize2Icon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
  TrophyIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import type {
  BetInput,
  BetView,
  ExamView,
  PredictionHistoryView,
  RevealedBetView,
} from '@shared/contracts'
import { useAuth } from '@/context/auth-context'
import {
  api,
  ApiError,
  POOLER_PROJECTS_CACHE_MS,
  poolerProjectsQueryKey,
} from '@/lib/api'
import type { Match } from '@/types'
import { PredictionHistory } from '@/components/prediction-history'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { GlassSurface } from '@/components/ui/glass-surface'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { useMobileViewport } from '@/lib/use-mobile-viewport'

const POOLER_BATCH_SIZE = 6
const MOBILE_POOLER_BATCH_SIZE = 3
const HIDE_CHARTS_STORAGE_KEY = 'pool-predict:hide-pooler-charts'
const FridayLineChart = lazy(() =>
  import('@/components/friday-line-chart').then((module) => ({
    default: module.FridayLineChart,
  }))
)
const loadPlayerDetailDialog = () => import('@/components/player-detail-dialog')
const PlayerDetailDialog = lazy(() =>
  loadPlayerDetailDialog().then((module) => ({
    default: module.PlayerDetailDialog,
  }))
)

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function examHasEnded(exam: ExamView) {
  return Date.now() >= new Date(exam.endsAt ?? exam.lockAt).getTime()
}

function validationPredictionLabel(predictedScore: number | null) {
  return predictedScore === null ? 'Validate' : `Validate · exact ${predictedScore}`
}

function predictionOutcome(
  bet: BetView,
  actualValidated: boolean | null,
  actualScore: number | null
): PredictionHistoryView['predictions'][number]['outcome'] {
  if (actualValidated === null) return null
  if ((bet.prediction === 'validate') !== actualValidated) return 'wrong'
  if (
    actualValidated &&
    bet.predictedScore !== null &&
    actualScore !== null &&
    bet.predictedScore === actualScore
  ) {
    return 'exact'
  }
  return 'correct'
}

function RevealedPredictions({
  exam,
  poolerIntraId,
  campusId,
}: {
  exam: ExamView
  poolerIntraId: number
  campusId: number
}) {
  const ended = examHasEnded(exam)
  const query = useQuery({
    queryKey: ['revealed-bets', campusId, exam.id],
    queryFn: () => api.revealedBets(exam.id, campusId),
    enabled: ended,
    staleTime: 60_000,
  })
  const rows = (query.data ?? []).filter((bet) => bet.poolerIntraId === poolerIntraId)
  if (!ended) return null

  return (
    <details className="rounded-xl bg-muted/34 px-3 py-1.5 text-xs shadow-[0_0_0_1px_var(--separator)_inset]">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 text-muted-foreground outline-none">
        <span className="flex items-center gap-1.5">
          <EyeIcon className="size-3.5" /> Revealed predictions
        </span>
        <span className="tabular-nums">{query.isPending ? '…' : rows.length}</span>
      </summary>
      <div className="mt-2 flex max-h-28 flex-col gap-1.5 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="text-muted-foreground">No predictions for this pooler.</p>
        ) : (
          rows.map((bet: RevealedBetView) => (
            <p key={bet.id} className="flex items-center justify-between gap-2">
              <span>@{bet.bettorLogin}</span>
              <span className="font-medium">
                {bet.prediction === 'validate'
                  ? validationPredictionLabel(bet.predictedScore)
                  : 'Not validate'}
              </span>
            </p>
          ))
        )}
      </div>
    </details>
  )
}

type MatchCardProps = {
  match: Match
  poolId: string
  campusId: number
  exam: ExamView
  bet: BetView | undefined
  sourceAvailable: boolean
  hideCharts: boolean
  optimizeForMobile: boolean
}

function PoolerChart({
  fridays,
  login,
  defer,
}: {
  fridays: Match['fridays']
  login: string
  defer: boolean
}) {
  const targetRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const shouldRender = ready || !defer

  useEffect(() => {
    if (shouldRender) return
    const target = targetRef.current
    if (!target) return

    let idleCallbackId: number | undefined
    let timeoutId: number | undefined

    const mountChart = () => {
      startTransition(() => setReady(true))
    }
    const scheduleMount = () => {
      const requestIdle = Reflect.get(window, 'requestIdleCallback') as
        | ((callback: () => void, options: { timeout: number }) => number)
        | undefined
      if (requestIdle) {
        idleCallbackId = requestIdle(mountChart, { timeout: 900 })
      } else {
        timeoutId = window.setTimeout(mountChart, 48)
      }
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        observer.disconnect()
        scheduleMount()
      },
      { rootMargin: '420px 0px' }
    )

    observer.observe(target)
    return () => {
      observer.disconnect()
      if (idleCallbackId !== undefined) window.cancelIdleCallback(idleCallbackId)
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [shouldRender])

  return (
    <div ref={targetRef} className="min-h-44">
      {shouldRender ? (
        <Suspense fallback={<Skeleton className="h-44 w-full" />}>
          <FridayLineChart fridays={fridays} login={login} />
        </Suspense>
      ) : (
        <Skeleton className="h-44 w-full" />
      )}
    </div>
  )
}

function MatchCard({
  match,
  poolId,
  campusId,
  exam,
  bet,
  sourceAvailable,
  hideCharts,
  optimizeForMobile,
}: MatchCardProps) {
  const reducedMotion = useReducedMotion()
  const queryClient = useQueryClient()
  const [decision, setDecision] = useState<'validate' | 'not_validate' | null>(
    bet?.prediction ?? null
  )
  const [score, setScore] = useState(bet?.predictedScore?.toString() ?? '')
  const [expanded, setExpanded] = useState(false)

  const mutation = useMutation({
    mutationFn: (input: BetInput) => api.saveBet(exam.id, match.intraUserId, campusId, input),
    onSuccess: (saved) => {
      setDecision(saved.prediction)
      setScore(saved.predictedScore?.toString() ?? '')
      void queryClient.invalidateQueries({ queryKey: ['bets'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteBet(exam.id, match.intraUserId, campusId),
    onSuccess: () => {
      setDecision(null)
      setScore('')
      void queryClient.invalidateQueries({ queryKey: ['bets'] })
    },
  })

  const disabled = exam.locked || !sourceAvailable || mutation.isPending || deleteMutation.isPending
  const error = mutation.error instanceof ApiError ? mutation.error.message : null

  function prefetchPlayerDetails() {
    void loadPlayerDetailDialog()
    void queryClient.prefetchQuery({
      queryKey: poolerProjectsQueryKey(campusId, poolId, match.intraUserId),
      queryFn: () => api.poolerProjects(poolId, match.intraUserId, campusId),
      staleTime: POOLER_PROJECTS_CACHE_MS,
    })
  }

  function saveNotValidate() {
    setDecision('not_validate')
    setScore('')
    mutation.mutate({ prediction: 'not_validate', predictedScore: null })
  }

  function saveValidate() {
    if (decision === 'validate') return
    setDecision('validate')
    setScore('')
    mutation.mutate({ prediction: 'validate', predictedScore: null })
  }

  function saveScore(event: React.FormEvent) {
    event.preventDefault()
    const parsed = Number(score)
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) return
    mutation.mutate({ prediction: 'validate', predictedScore: parsed })
  }

  function removeExactScore() {
    setScore('')
    mutation.mutate({ prediction: 'validate', predictedScore: null })
  }

  return (
    <>
      <motion.div
        layout={!optimizeForMobile && !reducedMotion}
        whileHover={disabled || reducedMotion || optimizeForMobile ? undefined : { y: -3 }}
        transition={{ type: 'spring', duration: 0.24, bounce: 0 }}
        className="mobile-scroll-card mobile-scroll-card-tall relative z-0 hover:z-30 focus-within:z-30"
      >
        <Card
          size="sm"
          className="relative h-full overflow-visible"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-3 right-3 z-10"
            aria-label={`Expand @${match.login} details`}
            onMouseEnter={prefetchPlayerDetails}
            onPointerDown={prefetchPlayerDetails}
            onFocus={prefetchPlayerDetails}
            onClick={() => {
              prefetchPlayerDetails()
              setExpanded(true)
            }}
          >
            <Maximize2Icon />
          </Button>

          <CardContent className="flex flex-col gap-4 pt-(--card-spacing)">
            <div className="flex items-center gap-3 pr-11">
              <Avatar className="size-14 shrink-0 sm:size-16">
                <AvatarImage
                  src={match.avatarUrl}
                  alt={match.login}
                  loading="lazy"
                  decoding="async"
                />
                <AvatarFallback className="text-base">{initials(match.fullName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold tracking-tight">@{match.login}</p>
                <p className="truncate text-sm text-muted-foreground">{match.fullName}</p>
                <p className="mt-0.5 text-xs font-medium tabular-nums text-primary">
                  Lvl {match.level?.toFixed(2) ?? '—'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant={decision === 'validate' ? 'success' : 'outline'}
                onClick={saveValidate}
                disabled={disabled}
                aria-label={`Predict that @${match.login} validates`}
              >
                <CheckIcon data-icon="inline-start" /> Validate
              </Button>
              <Button
                type="button"
                size="sm"
                variant={decision === 'not_validate' ? 'destructive-solid' : 'outline'}
                onClick={saveNotValidate}
                disabled={disabled}
                aria-label={`Predict that @${match.login} does not validate`}
              >
                <XIcon data-icon="inline-start" /> Not validate
              </Button>
            </div>

            {decision === 'validate' && !exam.locked ? (
              <form
                onSubmit={saveScore}
                className="flex flex-col gap-2 rounded-xl bg-muted/34 p-3 shadow-[0_0_0_1px_var(--separator)_inset]"
              >
                <Label htmlFor={`score-${exam.id}-${match.id}`} className="text-xs">
                  Optional exact score · 0–100 · +1 bonus
                </Label>
                <div className="flex gap-2">
                  <Input
                    id={`score-${exam.id}-${match.id}`}
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={score}
                    onChange={(event) => setScore(event.target.value)}
                    disabled={disabled}
                  />
                  <Button type="submit" size="sm" disabled={disabled || score === ''}>
                    {mutation.isPending ? 'Saving…' : 'Save exact'}
                  </Button>
                </div>
                {bet?.prediction === 'validate' && bet.predictedScore !== null ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={removeExactScore}
                    disabled={disabled}
                  >
                    Remove exact score
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {mutation.isPending
                      ? 'Saving validation-only prediction…'
                      : 'Validation-only prediction is saved for +2.'}
                  </p>
                )}
              </form>
            ) : null}

            {bet ? (
              <div className="flex min-h-10 items-center justify-between gap-2 rounded-xl bg-success/8 pl-3 text-xs text-success">
                <span className="flex items-center gap-1.5">
                  <CheckIcon className="size-3.5" />
                  Saved · {bet.prediction === 'validate'
                    ? validationPredictionLabel(bet.predictedScore)
                    : 'Not validate'}
                </span>
                {!exam.locked ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Delete prediction"
                    onClick={() => deleteMutation.mutate()}
                    disabled={disabled}
                  >
                    <Trash2Icon />
                  </Button>
                ) : null}
              </div>
            ) : null}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <RevealedPredictions
              exam={exam}
              poolerIntraId={match.intraUserId}
              campusId={campusId}
            />
          </CardContent>

          {!hideCharts ? (
            <CardFooter className="relative z-10 mt-auto flex-col items-stretch overflow-hidden sm:overflow-visible">
              <PoolerChart
                fridays={match.fridays}
                login={match.login}
                defer={optimizeForMobile}
              />
            </CardFooter>
          ) : null}
        </Card>
      </motion.div>

      {expanded ? (
        <Suspense fallback={null}>
          <PlayerDetailDialog
            match={match}
            poolId={poolId}
            campusId={campusId}
            open
            onOpenChange={setExpanded}
          />
        </Suspense>
      ) : null}
    </>
  )
}

export function HomePage() {
  const { user } = useAuth()
  const reducedMotion = useReducedMotion()
  const mobileViewport = useMobileViewport()
  const streamlinedMotion = Boolean(reducedMotion) || mobileViewport
  const poolerBatchSize = mobileViewport ? MOBILE_POOLER_BATCH_SIZE : POOLER_BATCH_SIZE
  const [activeTab, setActiveTab] = useState<'poolers' | 'predictions'>('poolers')
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<'login' | 'level-desc' | 'level-asc'>('level-desc')
  const [memeOpen, setMemeOpen] = useState(false)
  const [visiblePoolerCount, setVisiblePoolerCount] = useState(poolerBatchSize)
  const [hideCharts, setHideCharts] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(HIDE_CHARTS_STORAGE_KEY) === '1'
  })
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const poolQuery = useQuery({
    queryKey: ['pool', user?.campusId, 'current'],
    queryFn: () => api.currentPool(user!.campusId),
    enabled: Boolean(user?.campusId),
    staleTime: 5 * 60_000,
  })
  const pool = poolQuery.data
  const poolersQuery = useQuery({
    queryKey: ['poolers', user?.campusId, pool?.id],
    queryFn: () => api.poolers(pool!.id, user!.campusId),
    enabled: Boolean(pool?.id && pool.sourceAvailable),
    staleTime: 5 * 60_000,
  })
  const betsQuery = useQuery({
    queryKey: ['bets', user?.campusId, pool?.id],
    queryFn: () => api.myBets(pool!.id, user!.campusId),
    enabled: Boolean(pool?.id),
    staleTime: 60_000,
  })

  const selectedExam = pool?.exams.find((exam) => !exam.locked) ?? pool?.exams.at(-1)
  const betsByPooler = useMemo(() => {
    const map = new Map<number, BetView>()
    if (!selectedExam) return map
    for (const bet of betsQuery.data ?? []) {
      if (bet.examId === selectedExam.id) map.set(bet.poolerIntraId, bet)
    }
    return map
  }, [betsQuery.data, selectedExam])

  const matches = useMemo<Match[]>(() => {
    return (poolersQuery.data ?? []).map((pooler, index) => ({
      id: String(pooler.intraUserId),
      intraUserId: pooler.intraUserId,
      login: pooler.login,
      fullName: pooler.displayName,
      avatarUrl: pooler.avatarUrl,
      level: pooler.level,
      rank: index + 1,
      results: pooler.results,
      fridays: pooler.results.map((result) => ({
        label: `Exam ${result.code}`,
        validated: result.validated === true,
        value: result.validated ? result.score : null,
        score: result.score?.toString(),
      })),
    }))
  }, [poolersQuery.data])

  const filteredMatches = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const filtered = matches.filter(
      (match) =>
        !normalized ||
        match.login.toLowerCase().includes(normalized) ||
        match.fullName.toLowerCase().includes(normalized)
    )
    return filtered.toSorted((left, right) => {
      const loginOrder = left.login.localeCompare(right.login)
      if (sortBy === 'login') return loginOrder
      if (left.level === null) return right.level === null ? loginOrder : 1
      if (right.level === null) return -1
      const levelOrder = left.level - right.level
      return (sortBy === 'level-asc' ? levelOrder : -levelOrder) || loginOrder
    })
  }, [matches, query, sortBy])

  const visibleMatches = filteredMatches.slice(0, visiblePoolerCount)
  const hasMorePoolers = visibleMatches.length < filteredMatches.length

  const initialPredictionHistory = useMemo<PredictionHistoryView | undefined>(() => {
    if (!user || !pool || !poolersQuery.data || !betsQuery.data) return undefined
    const poolerById = new Map(
      poolersQuery.data.map((pooler) => [pooler.intraUserId, pooler])
    )
    const examById = new Map(pool.exams.map((exam) => [exam.id, exam]))
    return {
      user: {
        intraUserId: user.intraUserId,
        login: user.login,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      isViewer: true,
      predictions: betsQuery.data.flatMap((bet) => {
        const exam = examById.get(bet.examId)
        if (!exam) return []
        const pooler = poolerById.get(bet.poolerIntraId)
        const result = pooler?.results.find((entry) => entry.code === exam.code)
        const actualValidated = result?.validated ?? null
        const actualScore = result?.score ?? null
        return [{
          ...bet,
          examCode: exam.code,
          examEnded: examHasEnded(exam),
          actualValidated,
          actualScore,
          outcome: predictionOutcome(bet, actualValidated, actualScore),
          poolerLogin: pooler?.login ?? `user-${bet.poolerIntraId}`,
          poolerDisplayName: pooler?.displayName ?? `42 user ${bet.poolerIntraId}`,
          poolerAvatarUrl: pooler?.avatarUrl ?? '',
        }]
      }),
    }
  }, [betsQuery.data, pool, poolersQuery.data, user])

  useEffect(() => {
    if (!pool?.id) return
    void queryClient.invalidateQueries({ queryKey: ['me'], exact: true })
  }, [pool?.id, queryClient])

  useEffect(() => {
    const target = loadMoreRef.current
    if (!target || !hasMorePoolers || activeTab !== 'poolers') return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        startTransition(() => {
          setVisiblePoolerCount((count) =>
            Math.min(count + poolerBatchSize, filteredMatches.length)
          )
        })
      },
      { rootMargin: '300px 0px' }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [activeTab, filteredMatches.length, hasMorePoolers, poolerBatchSize])

  if (poolQuery.isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: poolerBatchSize }, (_, index) => (
          <Skeleton key={index} className="h-80" />
        ))}
      </div>
    )
  }

  if (poolQuery.error || !pool) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <RefreshCwIcon className="size-7 text-muted-foreground" />
          <p className="font-medium">The current pool could not be loaded.</p>
          <Button onClick={() => poolQuery.refetch()}>Try again</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      className="flex flex-col gap-7"
      initial={streamlinedMotion ? false : 'hidden'}
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: streamlinedMotion ? 0 : 0.07 },
        },
      }}
    >
      <motion.section
        variants={{
          hidden: { opacity: 0, y: 12, filter: 'blur(3px)' },
          visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
        }}
        transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
      >
        <GlassSurface
          variant="standard"
          className="grid gap-6 rounded-[2rem] p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6"
        >
          <div>
            <Badge variant="secondary" className="mb-3">
              Current pool
            </Badge>
            <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
              Hey, <span className="text-primary">@{user?.login}</span>
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              Make at least one prediction before the exam locks or receive −2 points.
            </p>
            <Button asChild variant="secondary" className="mt-4 w-full sm:w-auto">
              <Link to="/leaderboard">
                <TrophyIcon data-icon="inline-start" />
                View leaderboard
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-28 rounded-2xl bg-primary/9 p-4">
              <p className="text-xs text-muted-foreground">Your rank</p>
              <p className="mt-1 text-3xl font-semibold tracking-[-0.045em] text-primary tabular-nums sm:text-4xl">
                {user?.rank ? `#${user.rank}` : '—'}
              </p>
            </div>
            <div className="min-w-28 rounded-2xl bg-muted/48 p-4">
              <p className="text-xs text-muted-foreground">Total score</p>
              <p className="mt-1 text-3xl font-semibold tracking-[-0.045em] tabular-nums sm:text-4xl">
                {user?.totalScore.toLocaleString()}
              </p>
            </div>
          </div>

          <label
            htmlFor="hide-pooler-charts"
            className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-muted-foreground sm:col-span-2"
          >
            <input
              id="hide-pooler-charts"
              type="checkbox"
              checked={hideCharts}
              onChange={(event) => {
                const next = event.target.checked
                setHideCharts(next)
                localStorage.setItem(HIDE_CHARTS_STORAGE_KEY, next ? '1' : '0')
              }}
              className="native-check"
            />
            Hide charts on pooler cards
          </label>
        </GlassSurface>
      </motion.section>

      <motion.div
        variants={{
          hidden: { opacity: 0, y: 10 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
      >
        <SegmentedControl
          id="home-pool-view"
          value={activeTab}
          onValueChange={setActiveTab}
          ariaLabel="Pool views"
          items={[
            {
              value: 'poolers',
              label: 'Poolers',
              icon: UsersIcon,
              controls: 'poolers-panel',
            },
            {
              value: 'predictions',
              label: 'My predictions',
              icon: ListChecksIcon,
              controls: 'my-predictions-home-panel',
            },
          ]}
        />
      </motion.div>

      {activeTab === 'poolers' ? (
        <motion.div
          id="poolers-panel"
          role="tabpanel"
          className="flex flex-col gap-5"
          initial={streamlinedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: streamlinedMotion ? 0 : 0.2 }}
        >
          {!pool.sourceAvailable ? (
            <p className="rounded-2xl bg-warning/13 px-4 py-3 text-sm text-warning-foreground shadow-[0_0_0_1px_color-mix(in_oklch,var(--warning),transparent_68%)_inset] dark:text-warning">
              42 is temporarily unavailable. Existing bets and scores are safe, but new betting is paused.
            </p>
          ) : null}

          <section className="flex flex-col gap-5">
            <GlassSurface
              variant="regular"
              className="flex flex-col gap-3 rounded-[1.5rem] p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-[-0.015em]">Poolers</h2>
                <Badge variant="secondary" className="tabular-nums">
                  {filteredMatches.length}
                </Badge>
                {selectedExam ? (
                  <Badge variant={selectedExam.locked ? 'secondary' : 'success'}>
                    Exam {selectedExam.code}
                  </Badge>
                ) : null}
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <label htmlFor="pooler-sort" className="sr-only">Sort poolers</label>
                <select
                  id="pooler-sort"
                  value={sortBy}
                  onChange={(event) => {
                    const nextSort = event.target.value
                    if (nextSort === 'female-to-male' || nextSort === 'male-to-female') {
                      setMemeOpen(true)
                      return
                    }

                    setSortBy(nextSort as typeof sortBy)
                    setVisiblePoolerCount(poolerBatchSize)
                  }}
                  className="native-select px-3 text-sm sm:w-56"
                >
                  <option value="login">Login A–Z</option>
                  <option value="level-desc">Level high–low</option>
                  <option value="level-asc">Level low–high</option>
                  <option value="female-to-male">Female → male</option>
                  <option value="male-to-female">Male → female</option>
                </select>
                <div className="relative sm:w-64">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setVisiblePoolerCount(poolerBatchSize)
                    }}
                    placeholder="Search login or name…"
                    className="pl-8"
                  />
                </div>
              </div>
            </GlassSurface>

            {poolersQuery.isPending ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: poolerBatchSize }, (_, index) => (
                  <Skeleton key={index} className="h-80" />
                ))}
              </div>
            ) : poolersQuery.error ? (
              <p className="rounded-[1.75rem] border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
                Live pooler data is unavailable. New bets remain paused until 42 responds.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {selectedExam
                    ? visibleMatches.map((match) => (
                        <MatchCard
                          key={`${selectedExam.id}-${match.id}`}
                          match={match}
                          poolId={pool.id}
                          campusId={pool.campusId}
                          exam={selectedExam}
                          bet={betsByPooler.get(match.intraUserId)}
                          sourceAvailable={pool.sourceAvailable}
                          hideCharts={hideCharts}
                          optimizeForMobile={mobileViewport}
                        />
                      ))
                    : null}
                </div>
                <div
                  ref={loadMoreRef}
                  className="flex min-h-10 items-center justify-center text-xs text-muted-foreground tabular-nums"
                  aria-live="polite"
                >
                  {hasMorePoolers
                    ? `Showing ${visibleMatches.length} of ${filteredMatches.length} · scroll for more`
                    : filteredMatches.length > 0
                      ? `All ${filteredMatches.length} poolers loaded`
                      : 'No poolers match your search'}
                </div>
              </>
            )}
          </section>
        </motion.div>
      ) : user ? (
        <motion.div
          id="my-predictions-home-panel"
          role="tabpanel"
          initial={streamlinedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: streamlinedMotion ? 0 : 0.2 }}
        >
          <PredictionHistory
            poolId={pool.id}
            campusId={pool.campusId}
            intraUserId={user.intraUserId}
            initialData={initialPredictionHistory}
          />
        </motion.div>
      ) : null}
      <Dialog open={memeOpen} onOpenChange={setMemeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nice try 😄</DialogTitle>
            <DialogDescription>
              That filter is just for laughs — your pooler order did not change.
            </DialogDescription>
          </DialogHeader>

          <a
            href="https://imgflip.com/i/aww7hf"
            target="_blank"
            rel="noreferrer"
            className="overflow-hidden rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
          >
            <img
              src="https://i.imgflip.com/aww7hf.jpg"
              alt="Tom meme saying “We don’t do that in here”"
              className="media-outlined block h-auto w-full rounded-2xl object-cover"
            />
          </a>

          <DialogFooter>
            {/* <Button asChild variant="outline">
              <a href="https://imgflip.com/memegenerator" target="_blank" rel="noreferrer">
                Imgflip Meme Generator
              </a>
            </Button> */}
            <DialogClose asChild>
              <Button className="bg-transparent text-primary border border-primary hover:text-white hover:bg-primary/90">
                Okay 🗿
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
