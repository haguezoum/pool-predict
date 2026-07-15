import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import {
  CheckIcon,
  EyeIcon,
  Maximize2Icon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import type { BetInput, BetView, ExamCode, ExamView, RevealedBetView } from '@shared/contracts'
import { useAuth } from '@/context/auth-context'
import { api, ApiError } from '@/lib/api'
import type { Match } from '@/types'
import { FridayLineChart } from '@/components/friday-line-chart'
import { PlayerDetailDialog } from '@/components/player-detail-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function RevealedPredictions({ exam, poolerIntraId }: { exam: ExamView; poolerIntraId: number }) {
  const query = useQuery({
    queryKey: ['revealed-bets', exam.id],
    queryFn: () => api.revealedBets(exam.id),
    enabled: exam.locked,
    staleTime: 60_000,
  })
  const rows = (query.data ?? []).filter((bet) => bet.poolerIntraId === poolerIntraId)
  if (!exam.locked) return null

  return (
    <details className="rounded-lg border border-border px-3 py-2 text-xs">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-muted-foreground">
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
                  ? `Validate · ${bet.predictedScore}`
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
  exam: ExamView
  bet: BetView | undefined
  sourceAvailable: boolean
}

function MatchCard({ match, exam, bet, sourceAvailable }: MatchCardProps) {
  const queryClient = useQueryClient()
  const [decision, setDecision] = useState<'validate' | 'not_validate' | null>(
    bet?.prediction ?? null
  )
  const [score, setScore] = useState(bet?.predictedScore?.toString() ?? '')
  const [expanded, setExpanded] = useState(false)

  const mutation = useMutation({
    mutationFn: (input: BetInput) => api.saveBet(exam.id, match.intraUserId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bets'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteBet(exam.id, match.intraUserId),
    onSuccess: () => {
      setDecision(null)
      setScore('')
      void queryClient.invalidateQueries({ queryKey: ['bets'] })
    },
  })

  const disabled = exam.locked || !sourceAvailable || mutation.isPending || deleteMutation.isPending
  const error = mutation.error instanceof ApiError ? mutation.error.message : null

  function saveNotValidate() {
    setDecision('not_validate')
    setScore('')
    mutation.mutate({ prediction: 'not_validate', predictedScore: null })
  }

  function saveScore(event: React.FormEvent) {
    event.preventDefault()
    const parsed = Number(score)
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) return
    mutation.mutate({ prediction: 'validate', predictedScore: parsed })
  }

  return (
    <>
      <motion.div
        layout
        whileHover={disabled ? undefined : { y: -2 }}
        className="relative z-0 transition-[z-index] hover:z-30 focus-within:z-30"
      >
        <Card size="sm" className="relative h-full overflow-visible">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-2 right-2 z-10"
            aria-label={`Expand @${match.login} details`}
            onClick={() => setExpanded(true)}
          >
            <Maximize2Icon />
          </Button>

          <CardContent className="flex flex-col gap-4 pt-(--card-spacing)">
            <div className="flex items-center gap-3 pr-8">
              <Avatar className="size-14 shrink-0 sm:size-16">
                <AvatarImage src={match.avatarUrl} alt={match.login} />
                <AvatarFallback className="text-base">{initials(match.fullName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold tracking-tight">@{match.login}</p>
                <p className="truncate text-sm text-muted-foreground">{match.fullName}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant={decision === 'validate' ? 'default' : 'outline'}
                className={cn(
                  decision === 'validate' &&
                    'bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-500'
                )}
                onClick={() => setDecision('validate')}
                disabled={disabled}
              >
                <CheckIcon data-icon="inline-start" /> Validate
              </Button>
              <Button
                type="button"
                size="sm"
                variant={decision === 'not_validate' ? 'default' : 'outline'}
                className={cn(
                  decision === 'not_validate' &&
                    'bg-red-600 text-white hover:bg-red-600/90 dark:bg-red-500'
                )}
                onClick={saveNotValidate}
                disabled={disabled}
              >
                <XIcon data-icon="inline-start" /> Not validate
              </Button>
            </div>

            {decision === 'validate' && !exam.locked ? (
              <form onSubmit={saveScore} className="flex flex-col gap-2 rounded-lg border p-3">
                <Label htmlFor={`score-${exam.id}-${match.id}`} className="text-xs">
                  Exact score · 0–100
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
                    className="h-8"
                    disabled={disabled}
                  />
                  <Button type="submit" size="sm" disabled={disabled || score === ''}>
                    {mutation.isPending ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </form>
            ) : null}

            {bet ? (
              <div className="flex items-center justify-between gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                <span>
                  Saved · {bet.prediction === 'validate' ? `score ${bet.predictedScore}` : 'not validate'}
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
            <RevealedPredictions exam={exam} poolerIntraId={match.intraUserId} />
          </CardContent>

          <CardFooter className="relative z-10 flex-col items-stretch overflow-visible">
            <FridayLineChart fridays={match.fridays} login={match.login} />
          </CardFooter>
        </Card>
      </motion.div>

      <PlayerDetailDialog match={match} open={expanded} onOpenChange={setExpanded} />
    </>
  )
}

export function HomePage() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [selectedCode, setSelectedCode] = useState<ExamCode>('00')

  const poolQuery = useQuery({ queryKey: ['pool', 'current'], queryFn: api.currentPool })
  const pool = poolQuery.data
  const poolersQuery = useQuery({
    queryKey: ['poolers', pool?.id],
    queryFn: () => api.poolers(pool!.id),
    enabled: Boolean(pool?.id && pool.sourceAvailable),
  })
  const betsQuery = useQuery({
    queryKey: ['bets', pool?.id],
    queryFn: () => api.myBets(pool!.id),
    enabled: Boolean(pool?.id),
  })

  const selectedExam = pool?.exams.find((exam) => exam.code === selectedCode) ?? pool?.exams[0]
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
    return matches
      .filter(
        (match) =>
          !normalized ||
          match.login.toLowerCase().includes(normalized) ||
          match.fullName.toLowerCase().includes(normalized)
      )
      .toSorted((left, right) => left.login.localeCompare(right.login))
  }, [matches, query])

  if (poolQuery.isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
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
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Hey, <span className="text-primary">@{user?.login}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Make at least one prediction before the exam locks or receive −2 points.
          </p>
        </div>
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <Link to="/leaderboard">View leaderboard</Link>
        </Button>
      </section>

      <section className="flex flex-wrap items-end gap-8 sm:gap-12">
        <p className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Rank</span>
          <span className="font-display text-5xl leading-none text-blue-500 sm:text-6xl">#{user?.rank}</span>
        </p>
        <p className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Total score</span>
          <span className="text-3xl font-semibold tabular-nums text-blue-500 sm:text-4xl">
            {user?.totalScore.toLocaleString()}
          </span>
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {pool.exams.map((exam) => (
            <Button
              key={exam.id}
              type="button"
              size="sm"
              variant={exam.code === selectedExam?.code ? 'default' : 'outline'}
              onClick={() => setSelectedCode(exam.code)}
            >
              Exam {exam.code}
            </Button>
          ))}
        </div>
      </section>

      {!pool.sourceAvailable ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          42 is temporarily unavailable. Existing bets and scores are safe, but new betting is paused.
        </p>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Poolers</h2>
            <span className="text-xs text-muted-foreground">{filteredMatches.length} total</span>
          </div>
          <div className="relative sm:w-64">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search login or name…"
              className="h-9 pl-8"
            />
          </div>
        </div>

        {poolersQuery.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-80" />
            ))}
          </div>
        ) : poolersQuery.error ? (
          <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            Live pooler data is unavailable. New bets remain paused until 42 responds.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {selectedExam
              ? filteredMatches.map((match) => (
                  <MatchCard
                    key={`${selectedExam.id}-${match.id}`}
                    match={match}
                    exam={selectedExam}
                    bet={betsByPooler.get(match.intraUserId)}
                    sourceAvailable={pool.sourceAvailable}
                  />
                ))
              : null}
          </div>
        )}
      </section>
    </div>
  )
}
